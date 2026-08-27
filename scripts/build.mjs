#!/usr/bin/env node
/* ============================================================
   Docket - static site builder
   `node scripts/build.mjs` reads the product registry + data/**\/*.md
   and emits the whole site to dist/. Zero npm dependencies.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "./templates.mjs";
import config from "../lib/config.mjs";
import { dataRoot } from "../lib/data-root.mjs";
import { isOfficialAuthor, isTeamMember } from "../lib/team.mjs";
import { platformOf } from "../lib/platform.mjs";
import { isUnknownGlyph, GLYPH_NAMES } from "../lib/glyphs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

/* Your content lives in data/. A fresh clone has none yet, so the build
   falls back to the shipped example content, exactly like config and the
   product registry do. The moment you create data/, yours wins and this
   directory is never read again.

   Docket never writes to data/ during an update. That boundary is what
   keeps updates a clean merge.

   The exact rule for when the examples apply lives in lib/data-root.mjs,
   because getting it slightly wrong makes a buyer's first build fail. */
const DATA_ROOT = dataRoot(ROOT).dir;
const SITE_URL = T.SITE;

/* ================= Frontmatter parser =================
   Format: a `---` fenced YAML-lite block of `key: value` lines,
   then the body. Values may be quoted; votes/order/stars parse
   as numbers, true/false as booleans. */

function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!mm) continue;
    let value = mm[2].trim();
    // Strip trailing comments only when the value is unquoted
    const quoted = /^".*"$/.test(value) || /^'.*'$/.test(value);
    if (!quoted) {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    } else {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (/^-?\d+$/.test(value) && ["votes", "order", "stars"].includes(mm[1])) value = parseInt(value, 10);
    meta[mm[1]] = value;
  }
  return { meta, body: text.slice(m[0].length).trim() };
}

/* Split a bug/feature body into description + replies.
   `## Replies` separates; each `### <Author> - <YYYY-MM-DD>` starts a reply. */
function splitReplies(body) {
  const parts = body.split(/^## Replies\s*$/m);
  const desc = parts[0].trim();
  const replies = [];
  if (parts[1]) {
    const chunks = parts[1].split(/^### (.+?) - (\d{4}-\d{2}-\d{2})\s*$/m);
    // chunks: [preamble, author, date, text, author, date, text, ...]
    for (let i = 1; i + 2 < chunks.length + 1; i += 3) {
      const author = chunks[i];
      const date = chunks[i + 1];
      const text = (chunks[i + 2] || "").trim();
      if (!author) continue;
      replies.push({ author: author.trim(), date, text });
    }
  }
  return { desc, replies };
}

/* ================= Minimal markdown -> HTML =================
   Supports: paragraphs, bullet lists, bold, italic, links,
   inline code, and hard line breaks. Enough for support posts. */

function inlineMd(s) {
  let out = T.esc(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener nofollow">$1</a>');
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  return out;
}

function mdToHtml(src) {
  if (!src) return "";
  const blocks = src.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === "");
    if (isList && lines.some((l) => l.trim() !== "")) {
      const items = lines.filter((l) => l.trim() !== "").map((l) => `<li>${inlineMd(l.replace(/^\s*[-*]\s+/, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^#{1,4}\s+/.test(lines[0])) {
      out.push(`<p><strong>${inlineMd(lines[0].replace(/^#{1,4}\s+/, ""))}</strong></p>`);
    } else {
      out.push(`<p>${lines.map(inlineMd).join("<br>")}</p>`);
    }
  }
  return out.join("\n");
}

function mdToText(src) {
  if (!src) return "";
  return src
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/[`*_#]/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text, n = 180) {
  if (text.length <= n) return text;
  const cut = text.slice(0, n);
  const at = cut.lastIndexOf(" ");
  return cut.slice(0, at > 60 ? at : n).trim() + "…";
}

/* ================= Dates ================= */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function fmtShort(s) {
  const d = parseDate(s);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` : "";
}

function fmtMonthYear(s) {
  const d = parseDate(s);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
}

const NOW = new Date();
const TODAY_UTC = Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

function relLabel(s) {
  const d = parseDate(s);
  if (!d) return "";
  const days = Math.round((TODAY_UTC - d.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} Days Ago`;
  if (days < 60) return `${Math.round(days / 7)} Weeks Ago`;
  return fmtShort(s);
}

/* ================= Country helpers ================= */

const countryNames = (() => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; }
})();

function countryName(code) {
  if (!code) return "";
  try { return countryNames ? countryNames.of(code.toUpperCase()) : code; } catch { return code; }
}

function countryFlag(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/* ================= Data loading ================= */

const STATUS_MAP = {
  "under-review": "review",
  planned: "planned",
  "in-progress": "progress",
  completed: "done",
  declined: "declined"
};

/* "Open" = still needs attention. Bug/feature counts (overview cards, sidebar,
   board headers, all-boards totals) show only these; completed and declined
   items still live on the board, grouped in their own columns. */
const OPEN_ST = new Set(["review", "planned", "progress"]);
const isOpenPost = (p) => OPEN_ST.has(p.st);

function readDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
}

function loadProduct(reg) {
  const dataDir = join(DATA_ROOT, reg.id);

  // Resolve icon path: prefer the registry path; fall back between .png/.svg.
  // An icon is optional. When there is no file, iconPath stays empty and the
  // templates render a coloured monogram instead of a broken image.
  let iconRel = reg.icon || `assets/favicons/${reg.id}.png`;
  if (!existsSync(join(ROOT, iconRel))) {
    const alt = iconRel.endsWith(".png") ? iconRel.replace(/\.png$/, ".svg") : iconRel.replace(/\.svg$/, ".png");
    iconRel = existsSync(join(ROOT, alt)) ? alt : "";
  }
  const darkRel = `assets/favicons/${reg.id}-dark.png`;

  const product = {
    ...reg,
    iconPath: iconRel ? "/" + iconRel : "",
    iconDarkPath: existsSync(join(ROOT, darkRel)) ? "/" + darkRel : "",
    posts: [],
    changelog: [],
    testimonials: [],
    faqs: []
  };

  for (const kind of ["bugs", "features"]) {
    for (const file of readDir(join(dataDir, kind))) {
      const { meta, body } = parseFrontmatter(readFileSync(join(dataDir, kind, file), "utf8"));
      const { desc, replies } = splitReplies(body);
      const descText = mdToText(desc);
      const post = {
        id: meta.id || file.replace(/\.md$/, ""),
        product: reg.id,
        type: meta.type || (kind === "bugs" ? "bug" : "feature"),
        title: String(meta.title || "Untitled"),
        status: meta.status || "under-review",
        st: STATUS_MAP[meta.status] || "review",
        votes: typeof meta.votes === "number" ? meta.votes : 0,
        author: String(meta.author || "Anonymous"),
        created: meta.created || "",
        updated: meta.updated || meta.created || "",
        roadmap: meta.roadmap || "none",
        pinned: meta.pinned === true,
        sourceUrl: meta.sourceUrl || "",
        descHtml: mdToHtml(desc),
        descText,
        excerpt: excerpt(descText),
        dateLabel: fmtShort(meta.created),
        replies: replies.map((r) => ({
          author: r.author,
          official: isOfficialAuthor(r.author),
          /* A reply from a PERSON keeps their name; one from the company
             shows the configured label. Deciding it here rather than in the
             template is what lets the template stay ignorant of the team. */
          officialName: isTeamMember(r.author)
            ? r.author
            : (config.brand.officialLabel || "Support Team"),
          date: r.date,
          dateLabel: fmtShort(r.date),
          html: mdToHtml(r.text),
          text: mdToText(r.text)
        })),
        productRefLater: true
      };
      product.posts.push(post);
    }
  }

  for (const file of readDir(join(dataDir, "changelog"))) {
    const { meta, body } = parseFrontmatter(readFileSync(join(dataDir, "changelog", file), "utf8"));
    const blocks = body.split(/\n{2,}/);
    const firstIsPara = blocks.length && !/^\s*[-*]\s+/.test(blocks[0]);
    const subText = firstIsPara ? mdToText(blocks[0]) : "";
    const rest = firstIsPara ? blocks.slice(1).join("\n\n") : body;
    product.changelog.push({
      product: reg.id,
      version: meta.version || "",
      date: meta.date || "",
      dateLabel: fmtShort(meta.date),
      title: String(meta.title || `Version ${meta.version || ""}`),
      subText,
      notesHtml: rest.trim() ? mdToHtml(rest) : "",
      bodyText: mdToText(body),
      // Which requests this release closed. Resolved against real items
      // later, so a mistyped id renders nothing rather than a dead link.
      shipped: String(meta.shipped || "").split(",").map((x) => x.trim()).filter(Boolean)
    });
  }
  product.changelog.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));

  for (const file of readDir(join(dataDir, "testimonials"))) {
    const { meta, body } = parseFrontmatter(readFileSync(join(dataDir, "testimonials", file), "utf8"));
    if (meta.approved !== true) continue;
    product.testimonials.push({
      id: meta.id || file.replace(/\.md$/, ""),
      product: reg.id,
      stars: typeof meta.stars === "number" ? Math.min(5, Math.max(1, meta.stars)) : 5,
      author: String(meta.author || "Anonymous"),
      country: meta.country || "",
      countryName: countryName(meta.country || ""),
      flag: countryFlag(meta.country || ""),
      created: meta.created || "",
      dateLabel: fmtMonthYear(meta.created),
      quote: mdToText(body)
    });
  }
  product.testimonials.sort((a, b) => String(b.created).localeCompare(String(a.created)));

  for (const file of readDir(join(dataDir, "faq"))) {
    const { meta, body } = parseFrontmatter(readFileSync(join(dataDir, "faq", file), "utf8"));
    const answerText = mdToText(body);
    product.faqs.push({
      id: meta.id || file.replace(/\.md$/, ""),
      product: reg.id,
      category: meta.category || "General",
      question: String(meta.question || "Untitled"),
      order: typeof meta.order === "number" ? meta.order : 999,
      updated: meta.updated || "",
      answerHtml: mdToHtml(body),
      answerText,
      sub: meta.subtitle ? String(meta.subtitle) : excerpt(answerText, 92)
    });
  }
  product.faqs.sort((a, b) => a.order - b.order);

  const activeRoadmap = ["consideration", "planned", "in-progress"];
  product.counts = {
    bugs: product.posts.filter((p) => p.type === "bug" && isOpenPost(p)).length,
    features: product.posts.filter((p) => p.type === "feature" && isOpenPost(p)).length,
    roadmap: product.posts.filter((p) => activeRoadmap.includes(p.roadmap)).length,
    changelog: product.changelog.length,
    testimonials: product.testimonials.length,
    faq: product.faqs.length
  };

  return product;
}

import { products as registryProducts } from "../lib/products.mjs";
import { validateData } from "./validate-data.mjs";
const registry = { products: registryProducts };

/* A mistyped glyph name silently renders a letter, which looks exactly like
   not having set one. Say so, with the list, rather than letting somebody
   wonder why their icon never appeared. */
for (const p of registryProducts) {
  if (isUnknownGlyph(p.icon)) {
    console.error(`\n  "${p.icon}" on product "${p.id}" is not a glyph Docket knows, so it is showing a letter instead.`);
    console.error(`  Available: ${GLYPH_NAMES.join(", ")}\n`);
  }
}
const products = registry.products.map(loadProduct);
const byId = Object.fromEntries(products.map((p) => [p.id, p]));
products.forEach((p) => p.posts.forEach((post) => { post.productRef = p; }));
products.forEach((p) => p.changelog.forEach((e) => { e.productRef = p; }));

/* Link a release to the requests it closed.

   This is the join that makes a changelog worth reading: "we shipped
   1.4.2" means little, and "we shipped the thing you asked for in
   1.4.2" means a great deal to the person who asked. The ids are
   resolved to real items here, so a typo in a changelog file produces no
   link rather than a broken one, and the reverse link is derived rather
   than stored, which means the two can never disagree. */
for (const p of products) {
  const byId = new Map(p.posts.map((post) => [post.id, post]));
  for (const entry of p.changelog) {
    entry.shippedItems = entry.shipped
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((post) => ({
        id: post.id,
        title: post.title,
        url: `/${p.id}/${post.type === "bug" ? "bugs" : "features"}/${post.id}/`,
        type: post.type,
      }));
    // The other direction, for free.
    for (const item of entry.shippedItems) {
      const post = byId.get(item.id);
      if (post) post.shippedIn = { version: entry.version, title: entry.title, url: `/${p.id}/changelog/` };
    }
  }
}
products.forEach((p) => p.testimonials.forEach((t) => { t.productRef = p; }));

const totals = {};
for (const key of ["bugs", "features", "roadmap", "changelog", "testimonials", "faq"]) {
  totals[key] = products.reduce((n, p) => n + p.counts[key], 0);
}

const site = { products, byId, totals };

/* ================= Derivations ================= */

function entriesOf(product, type) {
  return product.posts.filter((p) => p.type === type).map((post) => ({ post, productRef: product }));
}

function allEntries(type) {
  const out = [];
  products.forEach((p) => { out.push(...entriesOf(p, type)); });
  out.sort((a, b) => b.post.created.localeCompare(a.post.created));
  return out;
}

function roadmapEntries(product) {
  return product.posts
    .filter((p) => p.roadmap && p.roadmap !== "none")
    .map((post) => ({ post, productRef: product }));
}

/* Recent Activity: newest creations, status changes, and releases */
function buildActivity() {
  // Recent Activity shows official app updates only (shipped releases), not
  // user submissions, comments, or status changes.
  const events = [];
  for (const p of products) {
    for (const entry of p.changelog) {
      events.push({
        date: entry.date,
        product: p,
        title: entry.title,
        url: `/${p.id}/changelog/`,
        sub: entry.version ? `Shipped in version ${entry.version}.` : "New release notes published."
      });
    }
  }
  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return events.slice(0, 8);
}

/* ================= Page content builders ================= */

/* Home stats-strip icons: a matched line-icon family (stroke ~1.75) that
   sits in the green accent chip beside each figure. */
const STAT_ICONS = {
  updates: '<svg class="rf-i" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 L13.9 10.1 L20.5 12 L13.9 13.9 L12 20.5 L10.1 13.9 L3.5 12 L10.1 10.1 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>',
  requests: '<svg class="rf-i" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75"/><path d="M8.3 12.2 L10.8 14.7 L15.7 9.3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  issues: '<svg class="rf-i" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.4 L18.5 6 V11.2 C18.5 15.7 15.6 18.6 12 20.4 C8.4 18.6 5.5 15.7 5.5 11.2 V6 Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M9.2 11.7 L11.2 13.8 L15 9.6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reply: '<svg class="rf-i" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75"/><path d="M12 7.4 V12 L15.2 13.9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* "<1h" wants the "<" small and quiet, sitting beside the figure rather
   than reading as part of it. Written as plain text in config ("<1h",
   "<2h", "<24h") and shaped here, so nobody has to know any markup.
   Everything after the symbol is escaped as usual. */
function figureHtml(fig) {
  const s = String(fig);
  return s.startsWith("<")
    ? `<span class="rf-lt">&lt;</span>${T.esc(s.slice(1))}`
    : T.esc(s);
}

function statCell(icon, fig, cap) {
  return '<div class="rf-cell"><div class="rf-row">' +
    `<span class="rf-ico">${icon}</span>` +
    `<span class="rf-body"><span class="rf-fig">${fig}</span><span class="rf-cap">${cap}</span></span>` +
    "</div></div>";
}

/* Live stats for the home strip. Computed from the loaded product data,
   never hardcoded, so the numbers track the real boards and changelogs. */
/* How long people actually wait for a first answer.

   This used to be the hardcoded string "<1h", which was a promise the
   board had no evidence for and, on a hand-answered install, was simply
   false. A support centre whose headline number is untrue is worse than
   one with no number at all, because it is the first thing a customer
   compares against their own experience.

   So it is measured: the median days from an item being created to its
   first official reply. Day granularity, because that is what a reply
   carries. A board that answers within the day says so and is believed;
   one that takes three days says three days, which is still a promise
   worth making and one it can keep. */
function typicalFirstReply() {
  /* An install may state its own figure. Empty means measured, which is the
     honest default: true by construction, and it stays true as the board
     gets faster or slower without anybody remembering to edit it. */
  const stated = String(config.brand.typicalReply || "").trim();
  if (stated) return { fig: stated, cap: "Typical First Reply" };

  const gaps = [];
  for (const p of products) {
    for (const post of p.posts) {
      const asked = parseDate(post.created);
      const first = (post.replies || []).find((r) => r.official);
      if (!asked || !first) continue;
      const answered = parseDate(first.date);
      if (!answered) continue;
      const days = Math.round((answered.getTime() - asked.getTime()) / 86400000);
      if (days >= 0 && days <= 60) gaps.push(days);
    }
  }
  if (gaps.length < 3) return null;          // too little to claim anything
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 0) return { fig: "Same day", cap: "Typical First Reply" };
  if (median === 1) return { fig: "1 day", cap: "Typical First Reply" };
  return { fig: `${median} days`, cap: "Typical First Reply" };
}

function homeStats() {
  let updates30 = 0, requestsShipped = 0, issuesResolved = 0;
  for (const p of products) {
    for (const e of p.changelog) {
      const d = parseDate(e.date);
      if (!d) continue;
      const days = (TODAY_UTC - d.getTime()) / 86400000;
      if (days >= 0 && days <= 30) updates30++;
    }
    for (const post of p.posts) {
      if (post.type === "feature" && post.st === "done") requestsShipped++;
      else if (post.type === "bug" && post.st === "done") issuesResolved++;
    }
  }
  return { updates30, requestsShipped, issuesResolved };
}

/* "Products" -> "Product", "Clients" -> "Client". Only ever used for the
   picker heading, so a naive trailing-s rule is enough and a label that
   does not pluralise simply keeps its own shape. */
function singularOf(label) {
  const l = String(label || "Products").trim();
  return /s$/i.test(l) && l.length > 2 ? l.slice(0, -1) : l;
}


function homeContent() {
  let html = '<header class="home-head"><h1>Support Centre</h1>' +
    '<p class="home-sub">Report a bug, request a feature, or see what’s shipping.</p></header>';


  /* Stats strip: four tiles, each = green accent icon chip + number + caption,
     the number+caption block fitted to the chip height, tiles the same height
     as the app cards below. First three numbers are live; reply time is a
     stated commitment.

     The strip is a track record, so it is only shown once there is one. On a
     board with nothing shipped and nothing resolved it would open with three
     zeros, which reads as neglect on the very day the owner is proudest of the
     thing. It returns on its own the moment any of the three moves. */
  const s = homeStats();
  const reply = typicalFirstReply();
  const hasRecord = s.updates30 > 0 || s.requestsShipped > 0 || s.issuesResolved > 0;

  if (hasRecord) {
    html += '<div class="rf-stats">' +
      statCell(STAT_ICONS.updates, String(s.updates30), "30-Day Updates") +
      statCell(STAT_ICONS.requests, String(s.requestsShipped), "Requests Shipped") +
      statCell(STAT_ICONS.issues, String(s.issuesResolved), "Issues Resolved") +
      (reply ? statCell(STAT_ICONS.reply, figureHtml(reply.fig), reply.cap) : "") +
      "</div>";
  }

  /* App picker: one horizontal card per product. No version, no status bar.
     Each shows an accent "Active" that cross-fades to "Get Help" on hover;
     hover warms the card in the product accent (wash + icon lift + name). */
  html += `<div class="d1-wrap"><div class="d1-label">Choose ${T.esc(singularOf(config.brand.productsLabel))}</div><div class="d1-grid">`;
  for (const p of products) {
    html += `<a class="d1-card" href="/${p.id}/" data-product="${p.id}" style="--pc: var(--c-${p.id})">` +
      T.iconImg(p).replace('alt=""', `alt="${T.esc(p.name)} App Icon"`) +
      '<span class="d1-text">' +
      `<span class="d1-name">${T.esc(p.name)}${T.platformPill(p)}</span>` +
      // cardTagline is the shorter variant tuned for this grid; falls back to
      // the full tagline (used elsewhere for board headers and metadata).
      `<span class="d1-tag">${T.esc(p.cardTagline || p.tagline)}</span>` +
      "</span>" +
      '<span class="d1-meta"><span class="rf-status">Active</span><span class="d1-help">Get Help</span></span>' +
      "</a>";
  }
  html += "</div></div>";

  /* Recent Activity: a plain eyebrow above the panel (matching the picker),
     no header bar. Rows carry no coloured dot; the product name is tinted in
     that product's accent. */
  const activity = buildActivity();

  /* A heading over an empty box is the worst thing a new board can show: it
     looks like the page failed rather than like the board is new. Every
     section page already answers this properly, so the home page does too. */
  if (!activity.length) {
    html += '<div class="d1-label">Recent Activity</div>' +
      '<section class="activity is-empty" aria-label="Recent Activity">' +
      T.panelEmptyHtml(
        "Nothing Here Yet",
        "Reports, requests and releases all land here as they happen.",
        null
      ) +
      "</section>";
    return html;
  }

  html += '<div class="d1-label">Recent Activity</div>' +
    '<section class="activity" aria-label="Recent Activity"><ul class="activity-list">';
  activity.forEach((ev, i) => {
    html += `<li class="activity-row" style="--i: ${i}; --pc: var(--c-${ev.product.id})" data-product="${ev.product.id}">` +
      `<span class="activity-product">${T.esc(ev.product.name)}</span>` +
      '<span class="activity-main">' +
      `<a class="activity-title" href="${ev.url}">${T.esc(ev.title)}</a>` +
      `<span class="activity-sub">${T.esc(ev.sub)}</span>` +
      "</span>" +
      `<span class="activity-date">${relLabel(ev.date)}</span>` +
      "</li>";
  });
  html += "</ul></section>";
  return html;
}

/* --- Product overview (6-panel kanban) --- */

const ADD_LABELS = { bugs: "Report a Bug", features: "Request a Feature", testimonials: "Add New Testimonial" };
const ADD_KINDS = { bugs: "bug", features: "feature", testimonials: "testimonial" };

function ovPanelHtml(product, sec, count, bodyHtml, index) {
  const addLabel = ADD_LABELS[sec];
  return `<section class="ov-panel${addLabel ? " can-add" : ""}" data-sec="${sec}" style="--i: ${index}" aria-label="${T.SECTION_LABELS[sec]}">` +
    `<a class="ov-head" href="/${product.id}/${sec}/" aria-label="View All ${T.SECTION_LABELS[sec]}">` +
    /* No count. The panel shows the items directly underneath, so a number
       beside the name is telling you what you are already looking at. */
    `<h2>${T.SECTION_LABELS[sec]}</h2>` +
    '<span class="ov-all">View All</span>' +
    "</a>" +
    (addLabel ? `<button class="ov-add" type="button" data-add="${ADD_KINDS[sec]}" title="${addLabel}" aria-label="${addLabel}">${T.ICON.plus}</button>` : "") +
    `<div class="ov-body">${bodyHtml}</div>` +
    "</section>";
}

function ovMainHtml(title, sub, href) {
  const titleInner = href ? `<a class="ov-card-link" href="${href}">${T.esc(title)}</a>` : T.esc(title);
  return `<span class="ov-main"><span class="ov-title">${titleInner}</span><span class="ov-sub">${T.esc(sub)}</span></span>`;
}

function overviewContent(product) {
  /* Overview cards show OPEN work only (Under Review / Planned / In Progress).
     Completed and declined items still exist on the board (grouped there),
     but a card counting them reads as unresolved work when it isn't. */
  const bugs = product.posts.filter((p) => p.type === "bug" && isOpenPost(p)).sort((a, b) => b.created.localeCompare(a.created));
  const features = product.posts.filter((p) => p.type === "feature" && isOpenPost(p)).sort((a, b) => b.created.localeCompare(a.created));
  const resolvedBugs = product.posts.filter((p) => p.type === "bug" && !isOpenPost(p)).length;
  const resolvedFeatures = product.posts.filter((p) => p.type === "feature" && !isOpenPost(p)).length;
  const activeRoadmap = product.posts
    .filter((p) => ["consideration", "planned", "in-progress"].includes(p.roadmap))
    .sort((a, b) => b.created.localeCompare(a.created));

  function postRows(list) {
    if (!list.length) return null;
    return list.slice(0, 3).map((post) => {
      const pill = T.PILLS[post.st];
      return '<div class="ov-card">' +
        ovMainHtml(post.title, post.excerpt, T.detailUrl(post)) +
        `<span class="pill ${pill.cls}">${pill.label}</span>` +
        `<button class="ov-vote" type="button" data-id="${T.esc(post.id)}" aria-pressed="false" aria-label="Upvote ${T.esc(post.title)}">${T.ICON.up}<span class="vote-n num">${post.votes}</span></button>` +
        "</div>";
    }).join("");
  }

  const quotes = product.testimonials;
  const tHtml = quotes.length === 0 ? T.ovEmptyHtml("testimonials") :
    quotes.slice(0, 2).map((t) =>
      '<div class="ov-t">' +
      `<div class="tstars" aria-label="${t.stars} Out Of 5 Stars">${T.starsHtml(t.stars)}</div>` +
      `<p class="ov-quote">&ldquo;${T.esc(t.quote)}&rdquo;</p>` +
      `<div class="ov-t-foot"><span class="ov-t-name">${T.esc(t.author)}</span><span class="ov-t-date num">${t.dateLabel}</span>${T.flagHtml(t)}</div>` +
      "</div>").join("");
  const roadmapHtml = activeRoadmap.length === 0 ? T.ovEmptyHtml("roadmap") :
    activeRoadmap.slice(0, 3).map((post) => {
      const pill = T.PILLS[post.st];
      return '<div class="ov-card">' + ovMainHtml(post.title, post.excerpt, T.detailUrl(post)) +
        `<span class="pill ${pill.cls}">${pill.label}</span></div>`;
    }).join("");
  const logHtml = product.changelog.length === 0 ? T.ovEmptyHtml("changelog") :
    product.changelog.slice(0, 3).map((e) =>
      '<div class="ov-card">' +
      ovMainHtml(e.title, e.subText || e.bodyText, `/${product.id}/changelog/`) +
      (e.version ? `<span class="ver-tag num">v${T.esc(e.version)}</span>` : "") +
      `<span class="gdate num" style="font-size:11.5px;color:var(--ink-3)">${e.dateLabel}</span></div>`).join("");
  const fHtml = product.faqs.length === 0 ? T.ovEmptyHtml("faq") :
    product.faqs.slice(0, 4).map((f) =>
      `<a class="ov-faq" href="/${product.id}/faq/">` +
      `<span class="ov-main"><span class="ov-title">${T.esc(f.question)}</span><span class="ov-sub">${T.esc(f.sub)}</span></span>` +
      T.ICON.arrow + "</a>").join("");
  /* The order is the reading order, not the order the pieces were built in.
     Top row is where work comes in and where it is going: bugs, features,
     roadmap. Bottom row is the record: what shipped, what people ask, what
     they said. The index is the stagger, so it follows the layout. */
  let html = '<div class="ov-grid">';
  html += ovPanelHtml(product, "bugs", bugs.length, postRows(bugs) || T.ovEmptyHtml("bugs", resolvedBugs > 0), 0);
  html += ovPanelHtml(product, "features", features.length, postRows(features) || T.ovEmptyHtml("features", resolvedFeatures > 0), 1);
  html += ovPanelHtml(product, "roadmap", activeRoadmap.length, roadmapHtml, 2);
  html += ovPanelHtml(product, "changelog", product.changelog.length, logHtml, 3);
  html += ovPanelHtml(product, "faq", product.faqs.length, fHtml, 4);
  html += ovPanelHtml(product, "testimonials", quotes.length, tHtml, 5);
  html += "</div>";
  return html;
}

/* --- Section pages --- */

function productBoardContent(product, sec) {
  const type = sec === "bugs" ? "bug" : "feature";
  const entries = entriesOf(product, type);
  if (!entries.length) {
    const empty = sec === "bugs"
      ? T.panelEmptyHtml("No Bugs Reported", `Nothing reported for ${product.name}. A quiet board is a happy app.`, { kind: "bug", label: "Report a Bug" })
      : T.panelEmptyHtml("No Requests Yet", `Be the first to suggest something for ${product.name}.`, { kind: "feature", label: "Request a Feature" });
    return { tools: "", body: empty };
  }
  const tools = T.searchSlotHtml(`Search ${T.SECTION_LABELS[sec]}`);
  /* The board page IS the "all" view. The columns became the chooser, so a
     status is one click away and nothing shows the same items twice in two
     shapes. The Roadmap keeps the kanban, which is the page whose job that
     actually is. */
  const base = `/${product.id}/${sec}/`;
  return {
    tools,
    count: entries.filter((e) => isOpenPost(e.post)).length,
    body: T.statusChooserHtml(T.boardCols(entries), entries, null, base, T.SECTION_LABELS[sec]) +
      T.statusListHtml(entries, { badge: false, showStatus: true, emptyCopy: "Nothing here yet." }),
  };
}

/* The empty state has to say something true about THIS status rather than
   one generic line, because "nothing here yet" on a page somebody chose to
   open reads like the page is broken. */
const STATUS_EMPTY = {
  all: "Nothing has been reported yet.",
  review: "Nothing is waiting to be read. Everything reported has been picked up.",
  planned: "Nothing is planned yet. Anything under review is still being weighed up.",
  progress: "Nothing is being worked on right now.",
  done: "Nothing has been completed yet.",
  declined: "Nothing has been declined.",
};

/* Every status the chooser offers, plus "All", which is one of them rather
   than a way out. It shows the same list in the same layout; the only thing
   that changes is how much of it. */
function statusCols(entries) {
  return T.boardCols(entries).map((c) => ({ ...c, slug: T.STATUS_SLUG[c.key] }));
}

/* One page per status, for the board it belongs to. */
function statusPageContent(entries, col, sec, base, withBadge) {
  const mine = entries.filter((e) => e.post.st === col.key);
  const type = sec === "bugs" ? "bug" : "feature";
  const tools = T.searchSlotHtml(`Search ${T.SECTION_LABELS[sec]}`);
  return {
    tools,
    count: mine.length,
    body: T.statusChooserHtml(T.boardCols(entries), entries, col.key, base, T.SECTION_LABELS[sec]) +
      T.statusListHtml(mine, { badge: withBadge, emptyCopy: STATUS_EMPTY[col.key] || "Nothing here yet." }),
  };
}

function productRoadmapContent(product) {
  const entries = roadmapEntries(product);
  if (!entries.length) {
    return { tools: "", body: T.panelEmptyHtml("Nothing Planned Yet", `The ${product.name} roadmap is a blank page for now. Planned work will appear here.`) };
  }
  return { tools: T.searchSlotHtml("Search Roadmap"), count: entries.length, body: T.kanbanHtml(entries, { cols: T.COLS_ROADMAP, badge: false, typeTag: true, by: "roadmap" }) };
}

function productChangelogContent(product) {
  if (!product.changelog.length) {
    return { tools: "", body: T.panelEmptyHtml("Nothing Shipped Yet", `The first ${product.name} release notes will land here.`) };
  }
  return { tools: T.searchSlotHtml("Search Changelog"), body: T.timelineHtml(product.changelog, false) };
}

function productTestimonialsContent(product) {
  if (!product.testimonials.length) {
    return {
      tools: "",
      body: T.panelEmptyHtml("No Testimonials Yet", `Be the first. When people share kind words about ${product.name}, they will live here.`, { kind: "testimonial", label: "Add New Testimonial" }),
    };
  }
  let body = '<div class="tgrid">';
  product.testimonials.forEach((t, i) => { body += T.tcardHtml(t, i, false); });
  body += "</div>";
  return { tools: T.searchSlotHtml("Search Testimonials"), add: { kind: "testimonial", label: "Add New Testimonial" }, count: product.testimonials.length, body };
}

const FAQ_CAT_ORDER = ["Getting Started", "Features", "Licensing", "Troubleshooting", "Privacy"];

function faqCats(faqs) {
  const cats = [];
  for (const c of FAQ_CAT_ORDER) if (faqs.some((f) => f.category === c)) cats.push(c);
  for (const f of faqs) if (!cats.includes(f.category)) cats.push(f.category);
  return cats;
}

function productFaqContent(product) {
  if (!product.faqs.length) {
    return { tools: "", body: T.panelEmptyHtml("No Questions Yet", `Answers for ${product.name} are being written and will appear here soon. Email ${config.contact.supportEmail} with anything in the meantime.`) };
  }
  let body = "";
  let gi = 0;
  for (const cat of faqCats(product.faqs)) {
    const items = product.faqs.filter((f) => f.category === cat);
    body += `<div class="faq-cat" style="--i: ${gi}">` +
      `<div class="faq-cat-label">${T.esc(cat)}</div>` +
      '<div class="faq-list">';
    items.forEach((f, j) => { body += T.faqItemHtml(f, `faq-${product.id}-${gi}-${j}`, false); });
    body += "</div></div>";
    gi++;
  }
  body += '<div class="search-empty faq-no-match">No questions match your search. Try a different term or clear the search.</div>';
  return { tools: T.searchSlotHtml("Search Questions"), count: product.faqs.length, body };
}

/* --- Consolidated sections --- */

const ALL_TAGLINES = {
  bugs: `Open and resolved bugs across all ${T.BRAND_NAME} products`,
  features: `Feature requests across all ${T.BRAND_NAME} products`,
  roadmap: "What is planned and in progress, app by app",
  changelog: "Everything that has shipped, app by app",
  testimonials: "Kind words from the people using them",
  faq: "Answers to common questions, app by app"
};

function allBoardContent(sec) {
  const type = sec === "bugs" ? "bug" : "feature";
  const entries = allEntries(type);
  if (!entries.length) {
    const empty = sec === "bugs"
      ? T.panelEmptyHtml("No Bugs Reported", "Nothing reported across any app. A quiet board is a happy fleet.", { kind: "bug", label: "Report a Bug" })
      : T.panelEmptyHtml("No Requests Yet", "Have an idea? Be the first.", { kind: "feature", label: "Request a Feature" });
    return { tools: "", body: empty };
  }
  const tools = T.searchSlotHtml(`Search ${T.SECTION_LABELS[sec]}`);
  return {
    tools,
    count: entries.filter((e) => isOpenPost(e.post)).length,
    body: T.statusChooserHtml(T.boardCols(entries), entries, null, `/${sec}/`, T.SECTION_LABELS[sec]) +
      T.statusListHtml(entries, { badge: true, showStatus: true, emptyCopy: "Nothing here yet." }),
  };
}

function allRoadmapContent() {
  const entries = [];
  products.forEach((p) => entries.push(...roadmapEntries(p)));
  if (!entries.length) {
    return { tools: "", body: T.panelEmptyHtml("Nothing Planned Yet", "The roadmap is a blank page for now. Planned work will appear here.") };
  }
  return { tools: T.searchSlotHtml("Search Roadmap"), count: entries.length, body: T.kanbanHtml(entries, { cols: T.COLS_ROADMAP, badge: true, typeTag: true, by: "roadmap" }) };
}

function allChangelogContent() {
  const entries = [];
  products.forEach((p) => entries.push(...p.changelog));
  entries.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
  if (!entries.length) {
    return { tools: "", body: T.panelEmptyHtml("Nothing Shipped Yet", "The first release notes will land here.") };
  }
  return { tools: T.searchSlotHtml("Search Changelog"), body: T.timelineHtml(entries, true) };
}

function allTestimonialsContent() {
  const all = [];
  products.forEach((p) => all.push(...p.testimonials));
  all.sort((a, b) => String(b.created).localeCompare(String(a.created)));
  if (!all.length) {
    return {
      tools: "",
      body: T.panelEmptyHtml("No Testimonials Yet", `Be the first. Tell us what you think and your words will live here.`, { kind: "testimonial", label: "Add New Testimonial" }),
    };
  }
  let body = '<div class="tgrid">';
  all.forEach((t, i) => { body += T.tcardHtml(t, i, true); });
  body += "</div>";
  return { tools: T.searchSlotHtml("Search Testimonials"), add: { kind: "testimonial", label: "Add New Testimonial" }, count: all.length, body };
}

function allFaqContent() {
  const withFaqs = products.filter((p) => p.faqs.length);
  if (!withFaqs.length) {
    return { tools: "", body: T.panelEmptyHtml("No Questions Yet", "Answers are being written and will appear here soon. Email ${config.contact.supportEmail} with anything in the meantime.") };
  }
  let body = "";
  withFaqs.forEach((p, gi) => {
    body += `<div class="group" style="--i: ${gi}">` +
      `<div class="group-head">${T.iconImg(p)}<h2>${T.esc(p.name)}</h2><span class="gcount num">${p.faqs.length}</span></div>` +
      '<div class="faq-list">';
    p.faqs.forEach((f, j) => { body += T.faqItemHtml(f, `faq-all-${p.id}-${j}`, true); });
    body += "</div></div>";
  });
  body += '<div class="search-empty faq-no-match">No questions match your search. Try a different term or clear the search.</div>';
  return { tools: T.searchSlotHtml("Search Questions"), count: withFaqs.reduce((n, p) => n + p.faqs.length, 0), body };
}

/* ================= Page emission ================= */

const pages = [];

function emit(path, html) {
  const file = path === "/404.html" ? join(DIST, "404.html") : join(DIST, path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  if (path !== "/404.html") pages.push(path);
}

/* Report malformed files, loudly, and still publish.

   A malformed file does not crash the build, it renders wrongly: a mistyped
   status puts an item in no column at all, so it is committed, present, and
   invisible forever to the person who reported it. That has to be surfaced.

   It must NOT stop the site publishing, though, and an earlier version of
   this got that wrong. One hand-edited file with a typo would refuse the
   whole build, which on a push-to-deploy host means every OTHER report,
   including ones that arrived correctly this morning, silently stops
   appearing. The board looks abandoned because of one bad row, and the
   owner only finds out if they happen to be watching deploys.

   So the site always builds, every bad file is named on every build, and
   `npm run validate` is the hard gate for anyone who wants one: it exits
   non-zero, so an agent or a CI step can refuse deliberately rather than
   having the decision made for them here. */
{
  const { problems, badFiles } = validateData({ quiet: true });
  if (problems.length) {
    const n = badFiles.length;
    console.error(`\n  ${n} data file${n === 1 ? "" : "s"} may not appear correctly:\n`);
    for (const p of problems) console.error(`  ${p}\n`);
    console.error("  The site has still been built. Run `npm run validate` for the full list.\n");
  }
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

/* --- Home --- */
emit("/", T.renderPage({
  site,
  product: null,
  view: "home",
  nav: "home",
  title: T.SITE_NAME,
  desc: `Report a bug, request a feature, or see what is shipping across ${T.BRAND_NAME}: ` + products.map((p) => p.name).join(", ") + ".",
  path: "/",
  contentHtml: homeContent(),
  jsonld: [T.websiteJsonld()]
}));

/* --- Consolidated sections --- */
const CONSOLIDATED_DESC = {
  bugs: `Every open and resolved bug report across ${T.BRAND_NAME}, with live statuses from Under Review to Completed.`,
  features: `Feature requests across all ${T.BRAND_NAME} products. Vote for what you want built next and follow each request's status.`,
  roadmap: `What is planned, in progress, and shipped across ${T.BRAND_NAME}, product by product.`,
  changelog: `Release notes for every ${T.BRAND_NAME} product, newest first.`,
  testimonials: `Kind words from people using ${T.BRAND_NAME}.`,
  faq: `Answers to common questions about ${T.BRAND_NAME}: getting started, licensing, troubleshooting, and privacy.`
};

const CONSOLIDATED_BUILDERS = {
  bugs: () => allBoardContent("bugs"),
  features: () => allBoardContent("features"),
  roadmap: allRoadmapContent,
  changelog: allChangelogContent,
  testimonials: allTestimonialsContent,
  faq: allFaqContent
};

for (const sec of ["bugs", "features", "roadmap", "changelog", "testimonials", "faq"]) {
  const { tools, count, body } = CONSOLIDATED_BUILDERS[sec]();
  const allFaqs = products.flatMap((p) => p.faqs);
  emit(`/${sec}/`, T.renderPage({
    site,
    product: null,
    view: "consolidated",
    nav: sec,
    title: `${T.SECTION_LABELS[sec]} - Support Centre`,
    desc: CONSOLIDATED_DESC[sec],
    path: `/${sec}/`,
    contentHtml: T.allHeadHtml(T.SECTION_LABELS[sec], ALL_TAGLINES[sec], tools, {
      label: "All Apps",
      add: ADD_KINDS[sec] ? { kind: ADD_KINDS[sec], label: ADD_LABELS[sec] || "Add" } : null,
    }, sec) + body,
    jsonld: sec === "faq" && allFaqs.length ? [T.faqJsonld(allFaqs)] : []
  }));

  /* And a page per status underneath the two boards that have statuses. */
  if (sec !== "bugs" && sec !== "features") continue;
  const entries = allEntries(sec === "bugs" ? "bug" : "feature");
  if (!entries.length) continue;
  for (const col of statusCols(entries)) {
    const s = statusPageContent(entries, col, sec, `/${sec}/`, true);
    emit(`/${sec}/${col.slug}/`, T.renderPage({
      site,
      product: null,
      view: "consolidated",
      nav: sec,
      title: `${col.label} ${T.SECTION_LABELS[sec]} - Support Centre`,
      desc: col.key === "all"
        ? `Every ${T.BRAND_NAME} ${sec === "bugs" ? "bug report" : "feature request"}, in full, newest first.`
        : `Every ${T.BRAND_NAME} ${sec === "bugs" ? "bug report" : "feature request"} currently ${col.label.toLowerCase()}, in full, newest first.`,
      path: `/${sec}/${col.slug}/`,
      contentHtml: T.allHeadHtml(T.SECTION_LABELS[sec], ALL_TAGLINES[sec], s.tools, {
        label: "All Apps", add: { kind: sec === "bugs" ? "bug" : "feature", label: ADD_LABELS[sec] },
      }, sec) + s.body,
      jsonld: []
    }));
  }
}

/* --- Legal pages (privacy, terms) ---
   OFF by default. Docket deliberately ships no legal templates: the
   wording has to be yours, and wrong legal copy is worse than none.

   To turn them on, set legal.enabled in config.js and paste your own
   HTML into legal.privacyHtml / legal.termsHtml. To link to pages you
   already have instead, set legal.privacyUrl / legal.termsUrl and leave
   these off. LEGAL-CHECKLIST.md lists what you need to cover, including
   the fact that this board stores your customers' email addresses. */

function legalPage(kind, title, bodyHtml) {
  emit(`/${kind}/`, T.renderPage({
    site,
    product: null,
    view: "home",
    nav: "",
    title: `${title} - ${T.SITE_NAME}`,
    desc: `${title} for ${T.SITE_NAME}.`,
    path: `/${kind}/`,
    contentHtml: T.docPageHtml({ title, updated: config.legal.updated || "", bodyHtml }),
    jsonld: []
  }));
}

if (config.legal.enabled && config.legal.privacyHtml) legalPage("privacy", "Privacy Policy", config.legal.privacyHtml);
if (config.legal.enabled && config.legal.termsHtml) legalPage("terms", "Terms of Use", config.legal.termsHtml);

/* --- Product pages --- */

const SECTION_DESC = (p) => ({
  bugs: `Bug reports for ${p.name} and their status, from Under Review to Completed. Report a bug and follow the fix.`,
  features: `Feature requests for ${p.name}. Vote for what you want built next and follow each request's progress.`,
  roadmap: `The ${p.name} roadmap: what is under consideration, planned, in progress, and shipped.`,
  changelog: `${p.name} release notes, newest first. Every update, improvement, and refinement.`,
  testimonials: `What people say about ${p.name}. ${p.tagline}`,
  faq: `Answers to common ${p.name} questions: getting started, licensing, troubleshooting, and privacy.`
});

for (const p of products) {
  emit(`/${p.id}/`, T.renderPage({
    site,
    product: p,
    view: "board",
    nav: "overview",
    title: `${p.name} - Support Centre`,
    desc: `${p.name} support hub: report bugs, request features, and follow the roadmap, changelog, and FAQ. ${p.tagline}`,
    path: `/${p.id}/`,
    contentHtml: T.boardHeadHtml(p, "", { nav: "overview" }) + overviewContent(p),
    jsonld: [T.softwareAppJsonld(p)]
  }));

  const builders = {
    bugs: () => productBoardContent(p, "bugs"),
    features: () => productBoardContent(p, "features"),
    roadmap: () => productRoadmapContent(p),
    changelog: () => productChangelogContent(p),
    testimonials: () => productTestimonialsContent(p),
    faq: () => productFaqContent(p)
  };

  for (const sec of ["bugs", "features", "roadmap", "changelog", "testimonials", "faq"]) {
    const { tools, count, body } = builders[sec]();
    emit(`/${p.id}/${sec}/`, T.renderPage({
      site,
      product: p,
      view: "board",
      nav: sec,
      title: `${p.name} ${T.SECTION_LABELS[sec]} - Support Centre`,
      desc: SECTION_DESC(p)[sec],
      path: `/${p.id}/${sec}/`,
      /* Bugs and Features carry no count here: the chooser directly below
         holds one per status and the total, and two totals on one screen is
         how a board stops being trusted. */
      contentHtml: T.boardHeadHtml(p, tools, {
        nav: sec,
        toolbar: {
          label: T.SECTION_LABELS[sec],
          add: ADD_KINDS[sec] ? { kind: ADD_KINDS[sec], label: ADD_LABELS[sec] || "Add" } : null,
        },
      }) + body,
      jsonld: sec === "faq" && p.faqs.length ? [T.faqJsonld(p.faqs)] : []
    }));

    if (sec !== "bugs" && sec !== "features") continue;
    const entries = entriesOf(p, sec === "bugs" ? "bug" : "feature");
    if (!entries.length) continue;
    for (const col of statusCols(entries)) {
      const base = `/${p.id}/${sec}/`;
      const s = statusPageContent(entries, col, sec, base, false);
      /* The heading stays "Bugs" and carries no number of its own. The
         chooser sits directly beneath it holding every count, so a second
         figure up here would be a different number next to "All 4" on the
         same screen, and numbers that do not reconcile are a real bug on
         anything whose job is to be trusted. */
      emit(`${base}${col.slug}/`, T.renderPage({
        site,
        product: p,
        view: "board",
        nav: sec,
        title: `${p.name} ${col.label} ${T.SECTION_LABELS[sec]} - Support Centre`,
        desc: col.key === "all"
          ? `Every ${p.name} ${sec === "bugs" ? "bug report" : "feature request"}, in full, newest first.`
          : `Every ${p.name} ${sec === "bugs" ? "bug report" : "feature request"} currently ${col.label.toLowerCase()}, in full, newest first.`,
        path: `${base}${col.slug}/`,
        contentHtml: T.boardHeadHtml(p, s.tools, {
          nav: sec,
          toolbar: { label: T.SECTION_LABELS[sec], add: { kind: sec === "bugs" ? "bug" : "feature", label: ADD_LABELS[sec] } },
        }) + s.body,
        jsonld: []
      }));
    }
  }

  /* Item detail pages */
  for (const post of p.posts) {
    const secDir = post.type === "bug" ? "bugs" : "features";
    emit(`/${p.id}/${secDir}/${post.id}/`, T.renderPage({
      site,
      product: p,
      view: "board",
      nav: secDir,
      title: `${post.title} - ${p.name} Support Centre`,
      desc: excerpt(post.descText, 155) || `${post.title} - a ${p.name} ${post.type === "bug" ? "bug report" : "feature request"} on ${T.SITE_NAME}.`,
      path: `/${p.id}/${secDir}/${post.id}/`,
      contentHtml: T.boardHeadHtml(p, "", { headingTag: "p", nav: secDir }) + T.detailHtml({ post, productRef: p }),
      jsonld: []
    }));
  }
}

/* --- 404 --- */
emit("/404.html", T.renderPage({
  site,
  product: null,
  view: "home",
  nav: "",
  title: "Page Not Found - Support Centre",
  desc: `That page is not here. Head back to the ${T.SITE_NAME} home.`,
  path: "/404.html",
  contentHtml: notFound404(),
  jsonld: []
}));

function notFound404() {
  return T.notFoundHtml();
}

/* ================= Static assets ================= */

/* Every asset here is optional. A fresh install has no icons and no share
   image yet, and the site must still build and look correct without them. */
function copyDir(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) {
    const src = join(from, f);
    if (statSync(src).isDirectory()) copyDir(src, join(to, f));
    else copyFileSync(src, join(to, f));
  }
}

function copyIfPresent(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

copyDir(join(ROOT, "site", "css"), join(DIST, "css"));
copyDir(join(ROOT, "site", "js"), join(DIST, "js"));
copyDir(join(ROOT, "site", "fonts"), join(DIST, "fonts"));
copyDir(join(ROOT, "assets"), join(DIST, "assets"));
copyIfPresent(join(ROOT, "site", "og-image.png"), join(DIST, "og-image.png"));
// Legacy favicon at the site root, so /favicon.ico resolves (200) for the
// browsers and bots that request it by convention instead of 404ing.
copyIfPresent(join(ROOT, "site", "favicon.ico"), join(DIST, "favicon.ico"));

/* ================= sitemap.xml / robots.txt / llms.txt ================= */

function lastmodFor(path) {
  // Detail pages: the item's updated date. Product/section pages: newest change in that product.
  const m = path.match(/^\/([a-z0-9-]+)\/(bugs|features)\/([a-z0-9-]+)\/$/);
  if (m) {
    const post = byId[m[1]] && byId[m[1]].posts.find((x) => x.id === m[3]);
    if (post) return post.updated || post.created;
  }
  const pm = path.match(/^\/([a-z0-9-]+)\//);
  const dates = [];
  const collect = (p) => {
    p.posts.forEach((x) => dates.push(x.updated || x.created));
    p.changelog.forEach((x) => dates.push(x.date));
    p.testimonials.forEach((x) => dates.push(x.created));
    p.faqs.forEach((x) => dates.push(x.updated));
  };
  if (pm && byId[pm[1]]) collect(byId[pm[1]]);
  else products.forEach(collect);
  const max = dates.filter(Boolean).sort().pop();
  return max || new Date().toISOString().slice(0, 10);
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${lastmodFor(p)}</lastmod></url>`).join("\n") +
  "\n</urlset>\n";
writeFileSync(join(DIST, "sitemap.xml"), sitemap);

const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web",
  "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bytespider",
  "Amazonbot", "FacebookBot", "cohere-ai", "YouBot", "CCBot"
];

const robots = "User-agent: *\nAllow: /\n\n" +
  AI_CRAWLERS.map((c) => `User-agent: ${c}\nAllow: /`).join("\n\n") +
  `\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
writeFileSync(join(DIST, "robots.txt"), robots);

const legalLinks = [
  config.legal.enabled && config.legal.privacyHtml ? `- [Privacy Policy](${SITE_URL}/privacy/): what this board collects, where it goes, and your rights` : "",
  config.legal.enabled && config.legal.termsHtml ? `- [Terms of Use](${SITE_URL}/terms/): the house rules for posting on the board` : "",
].filter(Boolean).join("\n");

const llms = `# ${T.SITE_NAME}

> The public support hub for ${T.BRAND_NAME} (${products.map((p) => p.name).join(", ")}). Bug reports, feature requests with voting, per-product roadmaps, changelogs, testimonials, and FAQs. All content is server-rendered static HTML.

## Priority Pages

- [Home](${SITE_URL}/): all products with recent activity
${products.map((p) => `- [${p.name} Support](${SITE_URL}/${p.id}/): ${p.tagline} Bugs, feature requests, roadmap, changelog, and FAQ.`).join("\n")}

## Cross-Product Views

- [All Bugs](${SITE_URL}/bugs/): open and resolved bug reports across every product
- [All Feature Requests](${SITE_URL}/features/): what people are asking for, with votes
- [Roadmap](${SITE_URL}/roadmap/): what is planned, in progress, and shipped
- [Changelog](${SITE_URL}/changelog/): release notes for every product
- [Testimonials](${SITE_URL}/testimonials/): kind words from real users
- [FAQ](${SITE_URL}/faq/): common questions and answers, product by product
${legalLinks ? `\n## Legal\n\n${legalLinks}\n` : ""}
## About

${config.brand.homeUrl ? `- ${T.BRAND_NAME}: ${config.brand.homeUrl}/\n` : ""}- Support email: ${config.contact.supportEmail}
- Full page list: ${SITE_URL}/sitemap.xml
`;
writeFileSync(join(DIST, "llms.txt"), llms);

/* ================= Done ================= */

const detailCount = products.reduce((n, p) => n + p.posts.length, 0);
console.log(`Built ${pages.length} pages (+404) to dist/`);
console.log(`  products: ${products.length}, items: ${detailCount}, changelog entries: ${products.reduce((n, p) => n + p.changelog.length, 0)}, testimonials: ${products.reduce((n, p) => n + p.testimonials.length, 0)}, faqs: ${products.reduce((n, p) => n + p.faqs.length, 0)}`);
