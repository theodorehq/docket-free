/* ============================================================
   Docket - HTML templates
   Plain JS template-literal functions, no template engine.
   Every page is fully server-rendered: all content is present
   in the initial HTML so search engines and AI crawlers can
   read it without JavaScript.

   Nothing studio-specific belongs in this file. Every name, URL and
   address comes from config. See config.example.js.
   ============================================================ */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../lib/config.mjs";
import { glyphFor, isUnknownGlyph } from "../lib/glyphs.mjs";
import { showsBadge } from "../lib/edition.mjs";

/* ---------- Cache busting ----------

   Browsers cache a stylesheet by its address, so /css/style.css stays the
   version it was first served until the cache decides otherwise. That is
   not a preview inconvenience: an owner merges an update, their site
   deploys, and the people already using it keep the old CSS against the
   new markup for as long as their browser feels like it.

   The fix is that the address changes when the file does. A short hash of
   the file's own contents, so it is stable across rebuilds that changed
   nothing and different the moment one byte moves. */
const HERE = dirname(fileURLToPath(import.meta.url));

function assetHash(rel) {
  try {
    return createHash("sha256")
      .update(readFileSync(join(HERE, "..", "site", rel)))
      .digest("hex")
      .slice(0, 8);
  } catch {
    /* Missing at render time is not worth failing a build over: the page
       still works, it is just cacheable by address again. */
    return "0";
  }
}

const V = {
  style: assetHash("css/style.css"),
  fonts: assetHash("css/fonts.css"),
  app: assetHash("js/app.js"),
};

export const SITE = config.brand.siteUrl;
export const SITE_NAME = config.brand.siteName;
export const BRAND_NAME = config.brand.name;

/* The wordmark sets the last word of the brand name at a lighter weight
   than the rest, which is what gives it its shape. Works for any number
   of words, and falls back cleanly to a single span for one-word names. */
export function brandWordHtml() {
  const words = String(BRAND_NAME).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return `<span class="brand-word"><span class="bw-lead">${esc(words[0] || "")}</span></span>`;
  }
  const tail = words.pop();
  return '<span class="brand-word">' +
    `<span class="bw-lead">${esc(words.join(" "))}</span> ` +
    `<span class="bw-tail">${esc(tail)}</span></span>`;
}

/* The mark beside the wordmark. Optional: with no favicon configured the
   wordmark stands alone rather than leaving a broken image. */
function brandMarkHtml() {
  const src = config.theme.favicon;
  return src ? `<img class="brand-mark" src="/${String(src).replace(/^\/+/, "")}" alt="">` : "";
}

/* ---------- Escaping ---------- */

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[c]));
}

/* Serialise a JSON-LD object for embedding inside a <script> element.
   JSON.stringify does NOT escape < > & or the line/paragraph separators, so a
   value containing "</script>" would close the block and allow markup to run.
   Escaping these as unicode sequences keeps the JSON valid while making a
   breakout impossible, whatever the content. */
export function jsonLdSafe(obj) {
  return JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, (c) => (
    { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" }[c]
  ));
}

/* ---------- Inline SVG icons (lifted from the mockup) ---------- */

export const ICON = {
  arrow: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7h9M8 3.5 11.5 7 8 10.5"/></svg>',
  chevLeft: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.6 3.2 4.8 7l3.8 3.8"/></svg>',
  chevDown: '<svg class="chev" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 5.5 3.5 3.5 3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9"/></svg>',
  close: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg>',
  search: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="6.2" cy="6.2" r="4.2"/><path d="m12.5 12.5-3.3-3.3"/></svg>',
  star: '<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M7 1.3l1.75 3.57 3.95.57-2.86 2.78.68 3.93L7 10.3l-3.52 1.85.68-3.93L1.3 5.44l3.95-.57z"/></svg>',
  up: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 7.5 3.5-3.5 3.5 3.5"/></svg>',
  spark: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 1.8 8.2 5.2 11.6 6.4 8.2 7.6 7 11 5.8 7.6 2.4 6.4 5.8 5.2z"/></svg>',
  check: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7.4 2.6 2.6L11 4.4"/></svg>',
  menu: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2.5 5h13M2.5 9h13M2.5 13h13"/></svg>',
  external: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3.5H3.6A1.1 1.1 0 0 0 2.5 4.6v5.8A1.1 1.1 0 0 0 3.6 11.5h5.8a1.1 1.1 0 0 0 1.1-1.1V8.5"/><path d="M8 2.5h3.5V6M11.5 2.5 6.7 7.3"/></svg>'
};

export const NAV_ICON = {
  home: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 6.6 8 2.6l5.2 4v6a1 1 0 0 1-1 1H3.8a1 1 0 0 1-1-1v-6z"/><path d="M6.3 13.5V9.4h3.4v4.1"/></svg>',
  overview: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1.3"/><rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1.3"/><rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1.3"/><rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1.3"/></svg>',
  bugs: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="9" r="4.2"/><path d="M8 7v2.2M8 11.4v.1"/><path d="M4.9 5.9 3.5 4.5M11.1 5.9l1.4-1.4"/></svg>',
  features: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2l1.5 3.4 3.7.4-2.8 2.5.8 3.6L8 10.2l-3.2 1.9.8-3.6L2.8 6l3.7-.4z"/></svg>',
  roadmap: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h8M2.5 12h5"/></svg>',
  changelog: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2V8l1.8 1.4"/></svg>',
  testimonials: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8.6c0 2.5-2.5 4.4-5.5 4.4-.8 0-1.6-.1-2.3-.4L2.5 13.5l.9-2.4c-.6-.7-.9-1.6-.9-2.5 0-2.5 2.5-4.4 5.5-4.4s5.5 1.9 5.5 4.4z"/></svg>',
  faq: '<svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M6.3 6.3c.2-.9 1-1.5 1.9-1.4.9.1 1.6.9 1.5 1.7-.1.9-1 1.2-1.5 1.8-.2.2-.2.4-.2.7"/><path d="M8 11.3v.1"/></svg>'
};

/* Status glyph family: 13px circles, 1.5px strokes */
function stSvg(inner, dash) {
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="5.7"' + (dash ? ' stroke-dasharray="2.9 2.9"' : "") + '/>' + inner + '</svg>';
}

export const ST_GLYPHS = {
  all: stSvg('<circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>'),
  review: stSvg("", true),
  planned: stSvg('<path d="M8 5.4V8l1.9 1.3"/>'),
  progress: stSvg('<path d="M8 2.3a5.7 5.7 0 0 1 0 11.4z" fill="currentColor" stroke="none"/>'),
  done: stSvg('<path d="m5.4 8.3 1.8 1.8 3.4-4"/>'),
  declined: stSvg('<path d="M5.5 8h5"/>')
};

export const PILLS = {
  review: { cls: "pill-review", label: "Under Review" },
  planned: { cls: "pill-planned", label: "Planned" },
  progress: { cls: "pill-progress", label: "In Progress" },
  done: { cls: "pill-done", label: "Completed" },
  declined: { cls: "pill-declined", label: "Declined" }
};

export const SECTION_LABELS = {
  overview: "Overview", bugs: "Bugs", features: "Features",
  roadmap: "Roadmap", changelog: "Changelog", testimonials: "Testimonials", faq: "FAQ"
};

/* The label on an official reply. It used to be the hardcoded string
   "Support Team", which was wrong twice over: every buyer's board said it
   regardless of their brand, and a reply signed by an individual lost that
   person's name entirely, so the one feature Studio sells was invisible on
   the page it happens on. The name now arrives already decided. */
const officialBadge = (name) =>
  `<span class="official-badge">${esc(name || 'Support Team')}</span>`;

/* ---------- Small shared pieces ---------- */

export function iconImg(product, cls = "picon") {
  /* A glyph named in config, on the product's own accent. One word of setup
     and the board stops looking like a spreadsheet. */
  const glyph = glyphFor(product.icon);
  if (glyph) {
    return `<svg class="${cls} picon-glyph" data-icon="${esc(product.id)}" viewBox="0 0 32 32" aria-hidden="true">` +
      '<rect width="32" height="32" rx="7.5" fill="currentColor" opacity="0.13"/>' +
      glyph + '</svg>';
  }

  /* No icon at all. Rather than a bare letter on a flat square, this is
     the monogram treated like a real app icon: a soft vertical gradient,
     a hairline rim and a highlight along the top edge. A fresh install
     has no icons by definition, and the first thing anyone sees should
     look deliberate rather than unfinished. */
  if (!product.iconPath) {
    const letter = String(product.name || product.id || "?").trim().charAt(0).toUpperCase();
    const gid = `pm-${esc(product.id)}`;
    return `<svg class="${cls} picon-mono" data-icon="${esc(product.id)}" viewBox="0 0 32 32" aria-hidden="true">` +
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
      '<stop offset="0" stop-color="currentColor" stop-opacity="0.26"/>' +
      '<stop offset="1" stop-color="currentColor" stop-opacity="0.13"/></linearGradient></defs>' +
      `<rect width="32" height="32" rx="8.6" fill="url(#${gid})"/>` +
      '<rect x="0.5" y="0.5" width="31" height="31" rx="8.3" fill="none" stroke="currentColor" stroke-opacity="0.16"/>' +
      '<path d="M8 1.2h16a8 8 0 0 1 7 4A8 8 0 0 0 24 3H8a5 5 0 0 0-5 5v2a6.8 6.8 0 0 1 5-8.8z" fill="#fff" opacity="0.5"/>' +
      `<text x="16" y="17.4" text-anchor="middle" dominant-baseline="central" ` +
      `font-size="16.5" font-weight="750" letter-spacing="-0.5" ` +
      `fill="currentColor" fill-opacity="0.92">${esc(letter)}</text></svg>`;
  }
  // When a product ships a dark icon variant, carry both paths so the theme
  // script can swap the card/sidebar icon to match the appearance (like the
  // favicon already does). Single-icon products just render the one src.
  const darkAttrs = product.iconDarkPath
    ? ` data-icon-light="${esc(product.iconPath)}" data-icon-dark="${esc(product.iconDarkPath)}"`
    : "";
  return `<img class="${cls}" data-icon="${esc(product.id)}" src="${esc(product.iconPath)}"${darkAttrs} alt="" loading="lazy">`;
}

export function badgeHtml(product) {
  return `<span class="prod-badge" style="--pc: var(--c-${esc(product.id)})">${iconImg(product)}${esc(product.name)}</span>`;
}

export function starsHtml(n) {
  let out = "";
  for (let s = 1; s <= 5; s++) out += `<span${s > n ? ' class="star-off"' : ""}>${ICON.star}</span>`;
  return out;
}

export function flagHtml(t) {
  if (!t.flag) return "";
  return `<span class="tflag" role="img" title="${esc(t.countryName)}" aria-label="${esc(t.countryName)}">${t.flag}</span>`;
}

function voteChipHtml(post) {
  return `<button class="ov-vote" type="button" data-id="${esc(post.id)}" aria-pressed="false" aria-label="Upvote ${esc(post.title)}">` +
    ICON.up + `<span class="vote-n num">${post.votes}</span></button>`;
}

export function detailUrl(post) {
  return `/${post.product}/${post.type === "bug" ? "bugs" : "features"}/${post.id}/`;
}

/* ---------- Search slot + add button ---------- */

export function searchSlotHtml(placeholder) {
  return '<div class="search-slot">' +
    `<button class="search-hint" type="button" aria-label="${esc(placeholder)}" aria-keyshortcuts="/">` +
    ICON.search + '<span>Search</span><kbd class="keycap">/</kbd></button>' +
    '<div class="search">' + ICON.search +
    `<input type="text" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">` +
    '<kbd>esc</kbd></div></div>';
}

/* A square beside the section name, the height of the heading it sits next
   to. Theo's call over a labelled button: a plus next to "Bugs" says add a
   bug, and the row stops being a heading at one end and a filled block at
   the other. It keeps its label where labels still count, in the title
   attribute and for a screen reader. */
export function addSquareHtml(kind, label) {
  return `<button class="section-add-sq" type="button" data-add="${kind}" title="${esc(label)}" aria-label="${esc(label)}">${ICON.plus}</button>`;
}

export function addBtnHtml(kind, label) {
  return `<button class="section-add" type="button" data-add="${kind}" aria-label="${esc(label)}">${ICON.plus}${esc(label)}</button>`;
}

/* ---------- Empty states ---------- */

export function panelEmptyHtml(title, copy, cta) {
  return '<div class="product-empty" style="display:flex">' +
    `<div class="empty-orb">${ICON.spark}</div>` +
    `<h3>${esc(title)}</h3><p>${esc(copy)}</p>` +
    (cta ? `<button class="empty-cta" type="button" data-add="${cta.kind}" aria-label="${esc(cta.label)}">${ICON.plus}${esc(cta.label)}</button>` : "") +
    "</div>";
}

export const OV_EMPTY_COPY = {
  bugs: "No bugs reported. A quiet board is a happy app.",
  features: "No requests yet. Have an idea? Be the first.",
  roadmap: "Nothing planned just yet. Watch this space.",
  changelog: "First release notes are on their way.",
  testimonials: "No kind words yet. Early days.",
  faq: "Answers are being written and will appear here soon."
};

/* Shown when a board has no OPEN items but does carry resolved ones, so the
   empty state reads as "all handled" rather than "nothing was ever here". */
export const OV_RESOLVED_COPY = {
  bugs: "All clear. Every reported bug has been resolved.",
  features: "All caught up. No open requests right now."
};

export function ovEmptyHtml(kind, resolved) {
  const copy = (resolved && OV_RESOLVED_COPY[kind]) ? OV_RESOLVED_COPY[kind] : OV_EMPTY_COPY[kind];
  return `<div class="ov-empty"><span class="ov-empty-mark">${ICON.spark}</span><span>${copy}</span></div>`;
}

/* ---------- Kanban ---------- */

export const COLS_BOARD = [
  { key: "review", glyph: "review", label: "Under Review" },
  { key: "planned", glyph: "planned", label: "Planned" },
  { key: "progress", glyph: "progress", label: "In Progress" },
  { key: "done", glyph: "done", label: "Completed" }
];

export const COLS_ROADMAP = [
  { key: "consideration", glyph: "review", label: "Under Consideration" },
  { key: "planned", glyph: "planned", label: "Planned" },
  { key: "in-progress", glyph: "progress", label: "In Progress" },
  { key: "shipped", glyph: "done", label: "Shipped" }
];

export function boardCols(entries) {
  const hasDeclined = entries.some((e) => e.post.st === "declined");
  return hasDeclined ? COLS_BOARD.concat([{ key: "declined", glyph: "declined", label: "Declined" }]) : COLS_BOARD;
}

function kcardHtml(entry, j, opts) {
  const post = entry.post;
  return `<article class="kcard" style="--j: ${j}">` +
    `<h3 class="kcard-title"><a class="kcard-link" href="${detailUrl(post)}" aria-label="View Details For ${esc(post.title)}">${esc(post.title)}</a></h3>` +
    `<p class="kcard-sub">${esc(post.excerpt)}</p>` +
    '<div class="kcard-foot">' +
    (opts.badge ? badgeHtml(entry.productRef) : "") +
    (opts.typeTag ? `<span class="tag tag-${post.type}">${post.type === "bug" ? "Bug" : "Feature"}</span>` : "") +
    `<span class="kcard-byline"><span class="byline-name">${esc(post.author)}</span> - ${post.dateLabel}</span>` +
    voteChipHtml(post) +
    "</div></article>";
}

/* The URL segment each status gets its own page under. Written out rather
   than derived from the column key, because these are addresses: `progress`
   would be a worse URL than `in-progress`, and a key rename must never
   silently move a page somebody has linked to. */
export const STATUS_SLUG = {
  review: "under-review",
  planned: "planned",
  progress: "in-progress",
  done: "completed",
  declined: "declined",
};

export function kanbanHtml(entries, opts) {
  let html = `<div class="kanban" style="--cols: ${opts.cols.length}">`;
  opts.cols.forEach((col, i) => {
    const items = entries
      .filter((e) => (opts.by === "roadmap" ? e.post.roadmap : e.post.st) === col.key)
      .sort((a, b) => b.post.created.localeCompare(a.post.created));
    /* Only the bug and feature boards have status pages to point at, so the
       heading is a link there and plain text on the roadmap. A heading that
       looks clickable on one board and is not on another is worse than
       neither. */
    const slug = opts.statusBase && STATUS_SLUG[col.key];
    const headInner =
      `<span class="st-glyph">${ST_GLYPHS[col.glyph]}</span>` +
      `<h3>${esc(col.label)}</h3>` +
      `<span class="kcount num">${items.length}</span>`;
    html += `<section class="kcol st-${col.glyph}" style="--i: ${i}" aria-label="${esc(col.label)}">` +
      (slug
        ? `<a class="kcol-head is-link" href="${opts.statusBase}${slug}/" aria-label="See All ${esc(col.label)} ${esc(opts.statusNoun || "Items")}">${headInner}</a>`
        : `<div class="kcol-head">${headInner}</div>`) +
      '<div class="kcards">';
    items.forEach((e, j) => { html += kcardHtml(e, j, opts); });
    html += `<div class="kempty"${items.length ? ' style="display:none"' : ""}>Nothing here yet</div>`;
    html += "</div></section>";
  });
  html += "</div>";
  return html;
}

/* ---------- Status pages ----------

   One page per status, under the board it belongs to. The board answers
   "where is everything", these answer "show me the four that are still
   being read", which is the question somebody actually arrives with and
   the one a two-line card on a quarter-width column cannot answer.

   Every chip is a real link to a real page rather than a filter, so the
   back button works, the address bar always matches what is on screen,
   and the URL can be pasted into a support reply. That is the whole
   argument for building it this way. */

export function statusChooserHtml(cols, entries, currentKey, base, sectionLabel) {
  const count = (key) => entries.filter((e) => e.post.st === key).length;
  const chip = (cls, href, current, inner) =>
    `<a class="stc ${cls}${current ? " is-active" : ""}" href="${href}"` +
    (current ? ' aria-current="page"' : "") + `>${inner}</a>`;

  /* "All" is a status page like the others, not a link back to the board.
     The board page IS All: the columns became these chips, so there is no
     second page showing everything in a different shape. */
  let html = `<nav class="stchoose" aria-label="${esc(sectionLabel)} By Status">`;
  html += chip("stc-all", base, !currentKey,
    `All <span class="stc-n num">${entries.length}</span>`);
  for (const col of cols) {
    const slug = STATUS_SLUG[col.key];
    if (!slug) continue;
    html += chip(
      `st-${col.glyph} s-${col.glyph}`,
      `${base}${slug}/`,
      col.key === currentKey,
      `<span class="st-glyph">${ST_GLYPHS[col.glyph]}</span>${esc(col.label)}` +
      `<span class="stc-n num">${count(col.key)}</span>`
    );
  }
  return html + "</nav>";
}

/* A row rather than a card, because the whole point of arriving here is
   width: the description reads in full and the first official reply comes
   with it, so the common case needs no click at all. */
const STATUS_PILL = {
  review: "Under Review",
  planned: "Planned",
  progress: "In Progress",
  done: "Completed",
  declined: "Declined",
};

function statusRowHtml(entry, i, withBadge, showStatus) {
  const post = entry.post;
  const reply = (post.replies || []).find((r) => r.official);
  return `<a class="sl-row" style="--i: ${i}" href="${detailUrl(post)}">` +
    '<span class="sl-main">' +
      '<span class="sl-head">' +
        `<span class="sl-title">${esc(post.title)}</span>` +
        `<span class="sl-by">${esc(post.author)}</span>` +
      "</span>" +
      /* descText, not excerpt. The excerpt exists because a card is a
         quarter of a board wide; this page exists precisely so the report
         does not have to be cut off, so cutting it off here would leave
         the page with no reason to exist. */
      `<span class="sl-sub">${esc(post.descText)}</span>` +
      (reply
        ? `<span class="sl-reply"><b>${esc(reply.officialName)}</b> ${esc(reply.text)}</span>`
        : "") +
    "</span>" +
    /* Everything that says where the item STANDS is on the right, together:
       its status, when it came in, how many people are behind it. Who wrote
       it belongs with what they wrote, so the name sits by the title. */
    /* Two lines, both right-aligned: when it came in and how many people are
       behind it on the first, what state it is in on the second. One line
       put a coloured pill between the title and the date and read as
       clutter. */
    '<span class="sl-side">' +
      `<span class="sl-meta"><span class="sl-date">${post.dateLabel}</span>` +
        voteChipHtml(post) +
      "</span>" +
      ((withBadge || (showStatus && STATUS_PILL[post.st]))
        ? '<span class="sl-meta">' +
            (withBadge ? badgeHtml(entry.productRef) : "") +
            (showStatus && STATUS_PILL[post.st]
              ? `<span class="pill pill-${post.st}">${STATUS_PILL[post.st]}</span>`
              : "") +
          "</span>"
        : "") +
    "</span></a>";
}

export function statusListHtml(entries, opts) {
  if (!entries.length) {
    return `<div class="sl-list sl-list-empty"><p class="sl-empty">${esc(opts.emptyCopy)}</p></div>`;
  }
  const sorted = entries.slice().sort((a, b) => b.post.created.localeCompare(a.post.created));
  return '<div class="sl-list">' +
    sorted.map((e, i) => statusRowHtml(e, i, opts.badge, opts.showStatus)).join("") +
    "</div>";
}

/* ---------- Changelog timeline ---------- */

export function timelineHtml(entries, withBadge) {
  let html = '<div class="timeline">';
  entries.forEach((e, i) => {
    html += `<article class="tl-entry" style="--i: ${i}">` +
      '<div class="tl-meta">' +
      (e.version ? `<span class="ver-tag num">v${esc(e.version)}</span>` : "") +
      `<span class="tl-date num">${e.dateLabel}</span>` +
      (withBadge ? badgeHtml(e.productRef) : "") +
      "</div>" +
      `<h3 class="tl-title">${esc(e.title)}</h3>` +
      (e.subText ? `<p class="tl-sub">${esc(e.subText)}</p>` : "") +
      (e.notesHtml ? `<div class="tl-notes">${e.notesHtml}</div>` : "") +
      shippedHtml(e) +
      "</article>";
  });
  html += "</div>";
  return html;
}

/* ---------- Testimonials ---------- */

export function tcardHtml(t, i, withBadge) {
  return `<figure class="tcard" style="--i: ${i}">` +
    `<div class="tstars" aria-label="${t.stars} Out Of 5 Stars">${starsHtml(t.stars)}</div>` +
    `<blockquote class="tquote">&ldquo;${esc(t.quote)}&rdquo;</blockquote>` +
    '<figcaption class="tfoot">' +
    `<span class="tname">${esc(t.author)}</span>` +
    `<span class="tdate num">${t.dateLabel}</span>` +
    (withBadge ? badgeHtml(t.productRef) : "") +
    flagHtml(t) +
    "</figcaption></figure>";
}

/* ---------- FAQ ---------- */

export function faqItemHtml(f, id, withChip) {
  return '<div class="faq-item">' +
    `<button class="faq-q" type="button" aria-expanded="false" aria-controls="${id}">` +
    '<span class="faq-q-main">' +
    `<span>${esc(f.question)}</span>` +
    `<span class="faq-sub">${esc(f.sub)}</span>` +
    "</span>" +
    (withChip ? `<span class="faq-chip">${esc(f.category)}</span>` : "") +
    ICON.chevDown +
    "</button>" +
    `<div class="faq-a" id="${id}" role="region" aria-hidden="true"><div class="faq-a-inner">${f.answerHtml}</div></div>` +
    "</div>";
}

/* ---------- Sidebar + chrome ---------- */

const BROWSE_SECTIONS = ["bugs", "features", "roadmap", "changelog", "testimonials", "faq"];

function sideItem({ href, label, icon, count, active, add }) {
  /* The "+" is a sibling of the link, not inside it: a button nested in an
     anchor is invalid, and it would inherit the row's click. */
  return `<li${add ? ' class="has-add"' : ""}><a class="side-item${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>` +
    icon + esc(label) +
    (count != null ? `<span class="count num">${count}</span>` : "") +
    "</a>" +
    (add ? `<button class="side-add" type="button" data-add="${add.kind}" aria-label="${esc(add.label)}" title="${esc(add.label)}">${ICON.plus}</button>` : "") +
    "</li>";
}

/* The three sections anybody can add to, and what the "+" beside each of
   them opens. Roadmap, changelog and FAQ are ours to write, so they carry
   no plus: the affordance appears exactly where it means something. */
const SECTION_ADD = {
  bugs: { kind: "bug", label: "Report a Bug" },
  features: { kind: "feature", label: "Request a Feature" },
  testimonials: { kind: "testimonial", label: "Leave a Testimonial" },
};

export function sidebarHtml(ctx) {
  const { site, product, view, nav } = ctx;
  const isBoard = view === "board";

  let html = '<aside class="sidebar" id="drawer">';
  html += '<a class="brand" href="/" aria-label="Go To Home">' +
    brandMarkHtml() + brandWordHtml() + '</a>';

  /* Everything that navigates goes in one scrolling region, so that a board
     with a lot of products can never push the section links off the bottom
     of the window with no way to reach them. New Request sits below it and
     stays put, which is the point of putting it there. */
  html += '<div class="side-scroll">';

  /* Home carries no active pill. It is the one destination in the column
     that is always one click away from everywhere, so highlighting it on
     the home page only adds a second filled shape to the column. */
  html += '<div class="home-block"><ul class="side-list">' +
    sideItem({ href: "/", label: "Home", icon: NAV_ICON.home }) +
    "</ul></div>";

  let shown = site.products;


  html += '<div class="products-block"><div class="side-label">' + esc(config.brand.productsLabel || "Products") + '</div><ul class="side-list" id="productList">';
  shown.forEach((p) => {
    html += `<li><a class="side-item${isBoard && product.id === p.id ? " is-active" : ""}" href="/${p.id}/" data-product="${p.id}" style="--pc: var(--c-${p.id})"${isBoard && product.id === p.id ? ' aria-current="page"' : ""}>${iconImg(p)}${esc(p.name)}</a></li>`;
  });
  html += "</ul></div>";

  html += '<div class="board-nav" id="boardNav">' +
    `<div class="side-label">${isBoard ? esc(product.name) : "Browse"}</div><ul class="side-list">`;
  if (isBoard) {
    html += sideItem({ href: `/${product.id}/`, label: "Overview", icon: NAV_ICON.overview, active: nav === "overview" });
  }
  /* No counts on these rows. Three of them carry a "+" and three do not,
     so the counts landed at two different distances from the edge and
     read as misaligned, which they were. The number was never the reason
     anybody clicked Bugs, and the board says it the moment you arrive. */
  BROWSE_SECTIONS.forEach((sec) => {
    html += sideItem({
      href: isBoard ? `/${product.id}/${sec}/` : `/${sec}/`,
      label: SECTION_LABELS[sec],
      icon: NAV_ICON[sec],
      active: nav === sec,
      add: SECTION_ADD[sec]
    });
  });
  html += "</ul></div>";

  /* The badge closes the sidebar, under the navigation and pinned to the
     bottom of the column. Outside .side-scroll so a long product list
     scrolls past it rather than pushing it off. */
  html += "</div>" + POWERED_BY + "</aside>";
  return html;
}

function mobileBarHtml(ctx) {
  const { product, view } = ctx;
  let html = '<header class="mobile-bar">' +
    `<button class="mb-menu" type="button" id="menuBtn" aria-label="Open Menu" aria-expanded="false" aria-controls="drawer">${ICON.menu}</button>` +
    '<a class="mb-brand" href="/" aria-label="Go To Home">' +
    brandMarkHtml() + brandWordHtml() + '</a>';
  if (view === "board") {
    const site = product.url || "";
    if (site) {
      html += `<a class="mb-product" href="${esc(site)}" target="_blank" rel="noopener" title="Visit the ${esc(product.name)} Website" aria-label="Visit the ${esc(product.name)} Website">${iconImg(product)}<span>${esc(product.name)}</span></a>`;
    } else {
      html += `<span class="mb-product">${iconImg(product)}<span>${esc(product.name)}</span></span>`;
    }
  }
  html += '</header><div class="drawer-scrim" id="drawerScrim" aria-hidden="true"></div>';
  return html;
}

/* ---------- Board head ---------- */

/* Section toolbar: its own row BELOW the product identity. The left
   side names the section (with a count chip); the tools cluster
   (search slot + add button) is right-anchored. The expanded search
   field claims flex space inside this row, so it can never sit on
   top of the identity or any other header content. */
export function sectionToolbarHtml(context, toolsHtml) {
  /* The row used to exist only to hold tools, so the changelog, which has
     neither a search box nor an add button, got no toolbar and therefore no
     heading. Naming the section is reason enough for the row on its own. */
  if (!toolsHtml && !(context && (context.back || context.label))) return "";
  /* On a status page the section name is where you came from, so it is the
     way back rather than a caption. Same control as the one above an item,
     because it does the same job and a second shape for it would be a
     second thing to learn. */
  /* A caption, and nothing else on most pages. The sidebar sits alongside
     with every section in it and the browser has a back button, so a third
     way to leave was a control earning its place by being available rather
     than by being needed. `back` stays supported for the item pages. */
  const back = context && context.back
    ? `<a class="detail-back toolbar-back" href="${context.back.href}">${ICON.chevLeft}${esc(context.back.label)}</a>`
    : "";
  const caption = context && context.label
    ? `<h2 class="toolbar-label">${esc(context.label)}` +
      (context.count != null ? `<span class="toolbar-count num">${context.count}</span>` : "") +
      (context.add ? addSquareHtml(context.add.kind, context.add.label) : "") +
      "</h2>"
    : "";
  const label = back + caption;
  return `<div class="section-toolbar">${label}${toolsHtml ? `<div class="head-tools">${toolsHtml}</div>` : ""}</div>`;
}

export function boardHeadHtml(product, toolsHtml, opts) {
  /* On item detail pages the item title is the page's h1, so the
     product name renders as a styled paragraph instead. */
  const tag = opts && opts.headingTag ? opts.headingTag : "h1";
  const site = product.url || "";
  const visitLabel = `Visit ${product.name}`;
  const identityTitle = `Visit the ${product.name} Website`;
  /* Pattern 1: the icon + name are a link to the product's marketing
     site. A tooltip names the target; the explicit Visit button carries
     the discoverability, so the identity link itself stays clean. */
  const identity = site
    ? `<a class="board-identity" href="${esc(site)}" target="_blank" rel="noopener" title="${esc(identityTitle)}" aria-label="${esc(identityTitle)}">` +
        iconImg(product) +
        `<span class="board-id-text"><${tag} class="board-title">${esc(product.name)}${platformPill(product)}</${tag}>` +
        `<span class="board-tagline">${esc(product.tagline)}</span></span></a>`
    : iconImg(product) +
        `<div><${tag} class="board-title">${esc(product.name)}${platformPill(product)}</${tag}><p class="board-tagline">${esc(product.tagline)}</p></div>`;
  /* Pattern 2: an explicit Visit link at the top-right. Quiet accent
     tint (not a filled button) so the section's primary action - the
     add button in the toolbar row - is the one filled accent button. */
  const visitBtn = site
    ? `<a class="board-visit" href="${esc(site)}" target="_blank" rel="noopener" aria-label="${esc(visitLabel)}">${esc(visitLabel)}</a>`
    : "";
  /* The header row holds brand-level things only (identity + Visit);
     section tools live on their own toolbar row beneath, so nothing
     can crowd or overlap the product name and tagline. */
  return '<header class="board-head">' +
    identity +
    visitBtn +
    "</header>" +
    sectionToolbarHtml(opts && opts.toolbar, toolsHtml);
}

export function allHeadHtml(title, tagline, toolsHtml, toolbar) {
  return '<header class="board-head">' +
    `<div><h1>${esc(title)}</h1><p class="board-tagline">${esc(tagline)}</p></div>` +
    "</header>" +
    sectionToolbarHtml(toolbar, toolsHtml);
}

/* ---------- Submission modal ---------- */

export function modalHtml({ site, product }) {
  const productField = product
    ? ""
    : '<div class="field" data-f="product"><label for="mfProduct">App</label>' +
      '<select id="mfProduct" name="product"><option value="">Choose an App</option>' +
      site.products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("") +
      '</select><span class="field-err">Please choose an app.</span></div>';

  return `<div class="modal" id="submitModal" hidden data-kind="">` +
    '<div class="modal-scrim" data-modal-close></div>' +
    '<div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
    '<div class="modal-head"><div>' +
    '<h2 class="modal-title" id="modalTitle">Report a Bug</h2>' +
    '<p class="modal-sub" id="modalSub"></p>' +
    "</div>" +
    `<button class="modal-close" type="button" data-modal-close aria-label="Close">${ICON.close}</button>` +
    "</div>" +
    `<form class="modal-form" id="modalForm" novalidate${product ? ` data-product="${product.id}"` : ""}>` +
    productField +
    '<div class="field" data-f="title"><label for="mfTitle">Title</label><input id="mfTitle" name="title" type="text" maxlength="120" placeholder="A short, clear summary"><span class="field-err">Please add a short title.</span></div>' +
    '<div class="field" data-f="stars" hidden><label id="mfStarsLabel">Rating</label><div class="star-picker" role="radiogroup" aria-labelledby="mfStarsLabel">' +
    [1, 2, 3, 4, 5].map((n) => `<button class="star-btn" type="button" data-star="${n}" role="radio" aria-checked="false" aria-label="${n} Star${n > 1 ? "s" : ""}">${ICON.star}</button>`).join("") +
    '</div><span class="field-err">Please pick a star rating.</span></div>' +
    '<div class="field" data-f="body"><label for="mfBody" id="mfBodyLabel">Description</label><textarea id="mfBody" name="body" rows="4" placeholder="What happened, and what did you expect?"></textarea><span class="field-err" id="mfBodyErr">Please add a description.</span></div>' +
    '<div class="form-grid">' +
    '<div class="field" data-f="name"><label for="mfName">Name</label><input id="mfName" name="name" type="text" autocomplete="name" placeholder="Your name"><span class="field-err">Please add your name.</span></div>' +
    '<div class="field"><label for="mfEmail">Email (Optional)</label><input id="mfEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
    "</div>" +
    '<div class="field" data-f="country" hidden><label for="mfCountry">Country (Optional)</label><select id="mfCountry" name="country"><option value="">Prefer Not to Say</option></select></div>' +
    '<div class="field hp-field" aria-hidden="true"><label for="mfWebsite">Website</label><input id="mfWebsite" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<div class="form-actions"><span class="form-error-note" id="modalErr">Please check the highlighted fields.</span><button class="form-submit" type="submit" id="modalSubmit">Submit Report</button></div>' +
    "</form>" +
    '<div class="modal-success" id="modalSuccess" hidden>' +
    '<div class="ms-anim"><div class="ms-disc">' +
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="m4.6 8.4 2.3 2.3 4.5-5.3"/></svg>' +
    "</div></div>" +
    '<div class="ms-foot">' +
    '<p class="ms-line" id="msLine" role="status"></p>' +
    '<p class="ms-sub" id="msSub"></p>' +
    '<div class="ms-actions">' +
    '<a class="ms-view" id="msView" href="/">View</a>' +
    '<button class="ms-done" type="button" data-modal-close>Done</button>' +
    "</div></div></div></div></div>";
}

/* ---------- Comment form (item detail) ---------- */

export function commentFormHtml(post) {
  return `<form class="comment-form" novalidate aria-label="Add A Comment" data-product="${post.product}" data-item="${post.id}" data-type="${post.type}">` +
    '<h3 class="form-title">Add a Comment</h3>' +
    '<div class="form-grid">' +
    '<div class="field" data-f="name"><label for="cfName">Name</label><input id="cfName" name="name" type="text" autocomplete="name" placeholder="Your name"><span class="field-err">Please add your name.</span></div>' +
    '<div class="field"><label for="cfEmail">Email (Optional)</label><input id="cfEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
    "</div>" +
    '<div class="field" data-f="body"><label for="cfText">Comment</label><textarea id="cfText" name="body" rows="3" placeholder="Add detail, context, or a workaround"></textarea><span class="field-err">Please write a comment first.</span></div>' +
    '<div class="field hp-field" aria-hidden="true"><label for="cfWebsite">Website</label><input id="cfWebsite" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<div class="form-actions"><span class="form-error-note">Please check the highlighted fields.</span><button class="form-submit" type="submit">Post Comment</button></div>' +
    "</form>";
}

/* ---------- Item detail ---------- */

export function replyHtml(r, i) {
  return `<article class="reply${r.official ? " is-official" : ""}" style="--i: ${i}">` +
    '<div class="reply-head">' +
    (r.official ? officialBadge(r.officialName) : `<span class="byline-name">${esc(r.author)}</span>`) +
    `<span class="reply-date num">${r.dateLabel}</span>` +
    "</div>" +
    `<div class="reply-text">${r.html}</div>` +
    "</article>";
}

export function detailHtml(entry) {
  const post = entry.post;
  const product = entry.productRef;
  const pill = PILLS[post.st];
  const replies = post.replies || [];
  const sectionLabel = post.type === "bug" ? "Bugs" : "Features";
  const backHref = `/${post.product}/${post.type === "bug" ? "bugs" : "features"}/`;

  let html = `<nav class="detail-nav" aria-label="Back To ${sectionLabel}">` +
    `<a class="detail-back" href="${backHref}">${ICON.chevLeft}${sectionLabel}</a>` +
    "</nav>";

  html += '<header class="detail-head">' +
    '<div class="detail-title-row">' +
    `<h1 class="detail-title">${esc(post.title)}</h1>` +
    `<button class="vote" type="button" data-id="${esc(post.id)}" aria-pressed="false" aria-label="Upvote ${esc(post.title)}">` +
    ICON.up + `<span class="vote-n num">${post.votes}</span></button>` +
    "</div>" +
    '<div class="detail-meta">' +
    `<span class="tag tag-${post.type}">${post.type === "bug" ? "Bug" : "Feature"}</span>` +
    `<span class="pill ${pill.cls}">${pill.label}</span>` +
    shippedInHtml(post) +
    "</div>" +
    "</header>";

  html += '<article class="detail-post">' +
    '<div class="reply-head">' +
    `<span class="byline-name">${esc(post.author)}</span>` +
    `<span class="reply-date num">${post.dateLabel}</span>` +
    "</div>" +
    `<div class="reply-text">${post.descHtml}</div>` +
    "</article>";

  html += '<section class="thread" aria-label="Replies">' +
    `<div class="thread-head">${replies.length} ${replies.length === 1 ? "Reply" : "Replies"}</div>` +
    (replies.length
      ? replies.map((r, i) => replyHtml(r, i)).join("")
      : '<div class="thread-empty">No replies yet. Start the conversation below.</div>') +
    "</section>";

  html += commentFormHtml(post);
  return html;
}

/* ---------- Document pages (privacy, terms) ---------- */

export function docPageHtml({ title, updated, bodyHtml }) {
  return '<article class="doc">' +
    '<header class="doc-head">' +
    `<h1>${esc(title)}</h1>` +
    `<p class="doc-updated">Last updated: <span class="num">${esc(updated)}</span></p>` +
    "</header>" +
    bodyHtml +
    "</article>";
}

/* What a release closed.

   "We shipped 1.4.2" means little. "We shipped the thing you asked for"
   means a great deal to the person who asked, and it is the single
   cheapest way to show a board is actually read. Rendered only when the
   changelog file names ids that resolve to real items, so a typo shows
   nothing rather than a dead link. */
export function shippedHtml(entry) {
  const items = entry.shippedItems || [];
  if (!items.length) return "";
  return '<div class="tl-shipped">' +
    `<span class="tl-shipped-lab">${items.length === 1 ? "This closed" : "This closed"}</span>` +
    items.map((i) => `<a class="tl-shipped-item" href="${i.url}">${esc(i.title)}</a>`).join("") +
    "</div>";
}

/* And the other way: an item that shipped says where. Derived from the
   changelog rather than stored on the item, so the two cannot disagree. */
export function shippedInHtml(post) {
  if (!post.shippedIn) return "";
  return `<a class="shipped-in" href="${post.shippedIn.url}">` +
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3.4 8.4 6.6 11.6 12.8 5"/></svg>' +
    `Shipped in ${esc(post.shippedIn.version)}</a>`;
}

/* ---------- Site footer (every page) ---------- */

/* Legal links appear only when there is somewhere for them to go: a
   generated page, or a URL you already have. Otherwise the nav is
   omitted entirely rather than linking to a 404. */
function legalLinksHtml() {
  const links = [];
  const privacy = config.legal.privacyUrl || (config.legal.enabled && config.legal.privacyHtml ? "/privacy/" : "");
  const terms = config.legal.termsUrl || (config.legal.enabled && config.legal.termsHtml ? "/terms/" : "");
  if (privacy) links.push(`<a href="${esc(privacy)}">Privacy</a>`);
  if (terms) links.push(`<a href="${esc(terms)}">Terms</a>`);
  if (!links.length) return "";
  return '<nav class="sf-links" aria-label="Legal">' + links.join("") + "</nav>";
}

/* The free edition carries a badge, at the far end of the footer, opposite
   the customer's own name. A pill rather than a line of text, the same
   shape as New Request in the sidebar, so the two bottom corners answer
   each other instead of one of them looking like an afterthought.

   "Powered by" stays quiet and the name is what carries: it is a credit,
   not a call to action, and a support centre is still the customer's
   page. See lib/edition.mjs. */
const POWERED_BY = showsBadge
  ? '<a class="sf-badge" href="https://theodorehq.com/docket/" ' +
    'target="_blank" rel="noopener">' +
    '<span class="sf-badge-by">Powered by</span>' +
    '<span class="sf-badge-name"><span class="sf-badge-mark" aria-hidden="true"></span>Docket</span>' +
    "</a>"
  : "";

/* The badge is NOT in here.

   .main-scroll carries a mask-image for its top and bottom scroll fades, and
   a mask applies to everything inside the element, fixed positioning
   included. So the badge sat in the corner with the bottom fade painted
   across it, greying out the lower half of a pill that is supposed to be
   solid slate. It is emitted as a sibling of <main> instead, where nothing
   is fading it. */
function footerHtml() {
  return '<footer class="site-footer">' + legalLinksHtml() + "</footer>";
}

/* ---------- 404 ---------- */

export function notFoundHtml() {
  return '<div class="notfound">' +
    `<div class="empty-orb">${ICON.spark}</div>` +
    "<h1>This Page Has Moved On</h1>" +
    "<p>The page you are after is not here. It may have shipped, been renamed, or never existed. The Support Centre home has everything, freshly organised.</p>" +
    `<a class="empty-cta" href="/">Back to Support Centre</a>` +
    "</div>";
}

/* ---------- Page shell ---------- */

// Umami only. The Vercel Web Analytics tag (the window.va stub + the
// /_vercel/insights/script.js loader) was removed 2026-07-07: Vercel Web
// Analytics isn't enabled for this project, so the loader 404'd on every
// page (showed up as bot 404s in the analytics dashboard).
const ANALYTICS = config.analytics.scriptUrl
  ? `<script defer src="${esc(config.analytics.scriptUrl)}"` +
    (config.analytics.websiteId ? ` data-website-id="${esc(config.analytics.websiteId)}"` : "") +
    `></script>`
  : "";

const THEME_SNIPPET =
  '<script>(function(){try{var d=window.matchMedia("(prefers-color-scheme: dark)").matches;' +
  'document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();</script>';

function accentStyle(site) {
  const vars = site.products.map((p) => `--c-${p.id}:${p.accent};`).join("");
  const rules = site.products.map((p) => `body[data-product="${p.id}"]{--accent:var(--c-${p.id})}`).join("");
  return `<style>:root{${vars}}${rules}</style>`;
}

/**
 * Render a full page.
 * opts: { site, product, view ("home"|"consolidated"|"board"), nav,
 *         title, desc, path, contentHtml, jsonld: [] }
 *
 * The submit dialog is on every page, because the sidebar's New Request
 * button is on every page. It used to be conditional, from when the only
 * way to open it was a section's own "+".
 */
export function renderPage(opts) {
  const { site, product, view, nav, title, desc, path, contentHtml } = opts;
  const canonical = SITE + path;
  const pid = view === "board" ? product.id : "home";
  const favicon = view === "board" ? product : null;
  // THQ-branded pages (non-board) use the chrome-bloom favicon, which
  // theme-switches (white bg in light, black bg in dark) via an internal
  // prefers-color-scheme media query. The header logo keeps hub.svg.
  /* On a board the product's own icon is the tab icon. Everywhere else it
     is the brand mark from config, the same file the sidebar shows, so a
     tab reads as the company rather than as nothing.

     The old fallback was a hardcoded /assets/favicons/favicon.svg that no
     install has ever shipped, so every non-board page asked for a file
     that was not there. Found while giving the demo companies their
     marks. */
  const brandIcon = String(config.theme.favicon || "").trim();
  const faviconHref = favicon
    ? favicon.iconPath
    : (brandIcon ? "/" + brandIcon.replace(/^\/+/, "") : "/favicon.ico");
  const faviconType = faviconHref.endsWith(".svg") ? "image/svg+xml" : "image/png";
  const faviconDark = favicon && favicon.iconDarkPath ? favicon.iconDarkPath : "";

  const jsonld = [orgJsonld()].concat(opts.jsonld || []);

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta property="og:image:alt" content="${esc(SITE_NAME)} - report bugs, request features, find answers">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<meta name="twitter:image:alt" content="${esc(SITE_NAME)} - report bugs, request features, find answers">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" id="favicon" href="${esc(faviconHref)}" type="${faviconType}"${faviconDark ? ` data-icon-light="${esc(faviconHref)}" data-icon-dark="${esc(faviconDark)}"` : ""}>
${THEME_SNIPPET}
${accentStyle(site)}
<link rel="preload" href="/fonts/plus-jakarta-sans-400800-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fonts.css?v=${V.fonts}">
<link rel="stylesheet" href="/css/style.css?v=${V.style}">
${jsonld.map((j) => `<script type="application/ld+json">${jsonLdSafe(j)}</script>`).join("\n")}
</head>
<body data-product="${pid}" data-view="${view}">

<div class="app">
${mobileBarHtml({ product, view })}
${sidebarHtml({ site, product, view, nav })}
  <main class="main">
   <div class="main-scroll" id="mainScroll">
    <section class="view is-active">
${contentHtml}
    </section>
${footerHtml()}
   </div>
  </main>
</div>
${modalHtml({ site, product: view === "board" ? product : null })}
<script src="/js/app.js?v=${V.app}" defer></script>
${ANALYTICS}
</body>
</html>
`;
}

/* ---------- JSON-LD ---------- */

export function orgJsonld() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: (config.brand.homeUrl || SITE) + "/",
    ...(config.theme.favicon ? { logo: SITE + "/" + String(config.theme.favicon).replace(/^\/+/, "") } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: config.contact.supportEmail,
      url: SITE + "/"
    }
  };
}

export function websiteJsonld() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE + "/",
    description: `Bug reports, feature requests, roadmaps, changelogs and FAQs for ${BRAND_NAME}.`
  };
}

export function softwareAppJsonld(product) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: product.name,
    operatingSystem: "macOS",
    applicationCategory: "UtilitiesApplication",
    description: product.tagline,
    url: product.url
  };
}

export function faqJsonld(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answerText }
    }))
  };
}


/* ============================================================
   The platform pill: a small glyph plus the buyer's own word.

   A studio might ship a Mac app, an iPhone app, an editor extension and a
   web app at once, and the point of the glyph is that four products of
   four different KINDS can be told apart before the label is read.

   Chosen from three treatments rendered on the real site side by side: a
   coloured chip, this, and quiet capitals in the product accent. The chip
   competed with the product name, and the capitals ran too wide on a long
   value like "VS Code extension".
   ============================================================ */
import { platformOf } from "../lib/platform.mjs";

/* Generic device and concept shapes, never a vendor's logo. An Apple mark
   or an Android robot is somebody else's trademark, and drawing one into a
   product other people ship is not ours to do. A laptop reads as "desktop
   app" perfectly well, and it keeps the whole set in one drawing style.

   All are 16x16, 1.5 stroke, round caps. Kept deliberately blunt: these
   render at 13px, so anything with more than about four strokes turns to
   mush and stops doing the one job it has, which is to be recognised
   before it is read. */
const PLAT_GLYPH = {
  // laptop
  mac:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.2" width="10" height="7" rx="1"/><path d="M1.4 12.6h13.2"/></svg>',
  windows: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.2" width="10" height="7" rx="1"/><path d="M1.4 12.6h13.2"/></svg>',
  linux:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.2" width="10" height="7" rx="1"/><path d="M1.4 12.6h13.2"/></svg>',
  // phone
  ios:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="1.8" width="6.8" height="12.4" rx="1.6"/><path d="M7.2 12h1.6"/></svg>',
  android: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="1.8" width="6.8" height="12.4" rx="1.6"/><path d="M7.2 12h1.6"/></svg>',
  // watch
  apple:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.8"/><path d="M6.2 4.2V2.2h3.6v2M6.2 11.8v2h3.6v-2"/></svg>',
  // globe
  web:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.7"/><path d="M2.4 8h11.2"/><ellipse cx="8" cy="8" rx="2.7" ry="5.7"/></svg>',
  // puzzle tab
  // One tab, not two. The conventional puzzle piece has a tab and a socket,
  // and at 13px both together read as a dented rectangle rather than as a
  // piece that fits into something.
  plugin:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.6h4.2V4a1.7 1.7 0 1 1 3.4 0v.6H13v9.8H3z"/></svg>',
  // terminal
  cli:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4"/><path d="M4.8 6.6 6.8 8.4l-2 1.8M9 10.4h2.4"/></svg>',
  // angle brackets
  api:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 3.8 2 8l3.8 4.2M10.2 3.8 14 8l-3.8 4.2"/></svg>',
  // page
  docs:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 2.4h5.2l3.6 3.6v7.6H3.6z"/><path d="M8.6 2.4v3.8h3.8"/></svg>',
  // dot
  other:   '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="2.4"/></svg>',
};

export function platformPill(product) {
  const p = platformOf(product);
  if (!p) return "";          // no platform set: no pill, and no gap either
  return `<span class="plat" data-plat="${p.key}">` +
         `<span class="plat-ico" aria-hidden="true">${PLAT_GLYPH[p.key] || PLAT_GLYPH.other}</span>` +
         `<span>${esc(p.label)}</span></span>`;
}
