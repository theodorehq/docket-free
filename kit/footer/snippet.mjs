// Support Centre footer flyout - canonical HTML snippet + theme wiring.
// Source of truth: prototypes/footer-flyout-final-2026-07-04 (approved design).
// Style mirrors scripts/templates.mjs: plain template strings, no dependencies.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point this at your own support centre, the same value as
// brand.siteUrl in config.js. No trailing slash.
export const SUPPORT_BASE = 'https://support.example.com';

// The six section links shown as chips, in panel order.
export const SECTIONS = [
  { id: 'bugs', label: 'Bugs' },
  { id: 'features', label: 'Features' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'faq', label: 'FAQ' },
];

// Inline SVG glyphs (the Support Centre NAV_ICON set, lifted from the
// approved prototype). Inlined in the HTML because AI crawlers and the
// hub CSP make external sprite requests undesirable.
export const GLYPHS = {
  bugs: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="9" r="4.2"/><path d="M8 7v2.2M8 11.4v.1"/><path d="M4.9 5.9 3.5 4.5M11.1 5.9l1.4-1.4"/></svg>',
  features: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2l1.5 3.4 3.7.4-2.8 2.5.8 3.6L8 10.2l-3.2 1.9.8-3.6L2.8 6l3.7-.4z"/></svg>',
  roadmap: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h8M2.5 12h5"/></svg>',
  changelog: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2V8l1.8 1.4"/></svg>',
  testimonials: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8.6c0 2.5-2.5 4.4-5.5 4.4-.8 0-1.6-.1-2.3-.4L2.5 13.5l.9-2.4c-.6-.7-.9-1.6-.9-2.5 0-2.5 2.5-4.4 5.5-4.4s5.5 1.9 5.5 4.4z"/></svg>',
  faq: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M6.3 6.3c.2-.9 1-1.5 1.9-1.4.9.1 1.6.9 1.5 1.7-.1.9-1 1.2-1.5 1.8-.2.2-.2.4-.2.7"/><path d="M8 11.3v.1"/></svg>',
};

// ------------------------------------------------------------
// Adaptive material tokens (from the prototype's .ctx-dark /
// .ctx-light blocks). Applied to the .scf-host element so they
// inherit into the trigger, panel and blur overlay.
// ------------------------------------------------------------
export const TOKENS = {
  dark: {
    '--scf-accent-ink': 'color-mix(in srgb, var(--scf-accent) 42%, #ffffff)',
    '--scf-ring': 'rgba(255, 255, 255, 0.11)',
    '--scf-ink': 'rgba(240, 244, 255, 0.92)',
    '--scf-ink-2': 'rgba(226, 232, 245, 0.62)',
    '--scf-sep': 'rgba(255, 255, 255, 0.12)',
    '--scf-shadow': '0 22px 52px -12px rgba(2, 6, 16, 0.65)',
    '--scf-bg': '#1c2027',
    '--scf-chip-bg': 'rgba(255, 255, 255, 0.045)',
    '--scf-chip-ring': 'rgba(255, 255, 255, 0.07)',
    '--scf-aur': '0.34',
    '--scf-blur-tint': 'rgba(5, 8, 14, 0.25)',
  },
  light: {
    '--scf-accent-ink': 'color-mix(in srgb, var(--scf-accent) 78%, #101a17)',
    '--scf-ring': 'rgba(20, 24, 33, 0.10)',
    '--scf-ink': '#23262b',
    '--scf-ink-2': '#6a7078',
    '--scf-sep': 'rgba(20, 24, 33, 0.09)',
    '--scf-shadow': '0 20px 48px -16px rgba(32, 34, 30, 0.30)',
    '--scf-bg': '#ffffff',
    '--scf-chip-bg': '#f5f6f8',
    '--scf-chip-ring': 'rgba(20, 24, 33, 0.05)',
    '--scf-aur': '0.20',
    '--scf-blur-tint': 'rgba(255, 255, 255, 0.35)',
  },
};

function tokenDecls(mode, indent = '  ') {
  return Object.entries(TOKENS[mode])
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');
}

// ------------------------------------------------------------
// footerFlyoutHtml(product) -> the HTML block for one product.
// product: { id, name, accent, iconSrc, iconSrcDark, variant, anchorX, triggerHtml }
//   variant   'center' (panel centred on trigger) | 'left' (left-anchored)
//   anchorX   optional left offset for the 'left' variant (e.g. '14px')
//   iconSrcDark  optional dark-theme icon variant; emitted as a
//                second <img> that the theme wiring swaps in under the
//                site's dark scopes.
//   triggerHtml  optional custom trigger markup, e.g. a linked callout;
//                must carry class "scf-trigger". Default is a plain
//                "Support Centre" text link.
// ------------------------------------------------------------
export function footerFlyoutHtml(product) {
  const base = `${SUPPORT_BASE}/${product.id}/`;
  const variantClass = product.variant === 'left' ? 'scf-left' : 'scf-center';
  const anchor = product.anchorX ? ` style="--scf-anchor-x:${product.anchorX}"` : '';
  const trigger = product.triggerHtml
    || `<a class="scf-trigger" href="${base}">Support Centre</a>`;
  const icons = product.iconSrcDark
    ? `<img class="scf-icon scf-icon-light" src="${product.iconSrc}" alt="" width="24" height="24"><img class="scf-icon scf-icon-dark" src="${product.iconSrcDark}" alt="" width="24" height="24">`
    : `<img class="scf-icon" src="${product.iconSrc}" alt="" width="24" height="24">`;

  const chips = SECTIONS.map((s, i) =>
    `<a class="scf-chip" style="--scf-i:${i}" href="${base}${s.id}/"><span class="scf-chip-in"><span class="scf-gx">${GLYPHS[s.id]}</span>${s.label}</span></a>`
  ).join('\n      ');

  return `<div class="scf ${variantClass}"${anchor}>
  ${trigger}
  <div class="scf-pos"><div class="scf-panel">
    <a class="scf-head" href="${base}">
      ${icons}
      <span class="scf-names"><span class="scf-name">${product.name}</span><span class="scf-sub">Support Centre</span></span>
    </a>
    <div class="scf-rule"></div>
    <div class="scf-grid">
      ${chips}
    </div>
  </div></div>
</div>`;
}

// The blur overlay injected as the first child of the .scf-host footer.
export const BLUR_HTML = '<div class="scf-blur" aria-hidden="true"></div>';

// ------------------------------------------------------------
// themeWiringCss(site) -> the per-site token wiring appended to
// the canonical stylesheet. site.theme:
//   { defaultMode: 'dark'|'light',
//     overrides: [ { selector, mode } ],
//     mediaOverrides: [ { media, selector, mode } ],
//     ctxOverrides: [ { ctxClass, mode, media?, comment? } ] }
// Selectors scope the .scf-host element (tokens inherit down).
// ctxOverrides key off a context class the installer stamps on
// specific hosts (e.g. blog footers, which may be light while
// the landing footer is always navy).
// ------------------------------------------------------------
export function themeWiringCss(site) {
  const out = [];
  out.push(`/* ---- ${site.name} theme wiring (generated by kit/footer/snippet.mjs) ---- */`);

  // Panel face: self-hosted Plus Jakarta Sans variable font (the Support
  // Centre face), for sites that do not already load it. Same-origin, so
  // the hub CSP (font-src 'self' data:, verified live 2026-07-04) allows
  // it. Declaring the family does not change the site's own typography:
  // only the .scf panel's font-family references it.
  if (site.font) {
    out.push(`@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; font-weight: 400 800; font-display: swap; src: url('${site.font.href}') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }`);
  }

  // Dark icon swap: show the dark icon variant in every scope
  // that carries dark tokens, the light icon everywhere else.
  const iconSwap = site.product?.iconSrcDark
    ? (mode, prefix) => (mode === 'dark'
      ? `${prefix}.scf-host .scf-icon-light { display: none; }\n${prefix}.scf-host .scf-icon-dark { display: inline-block; }`
      : `${prefix}.scf-host .scf-icon-light { display: inline-block; }\n${prefix}.scf-host .scf-icon-dark { display: none; }`)
    : null;

  out.push(`.scf-host {\n  --scf-accent: ${site.accent};\n${tokenDecls(site.theme.defaultMode)}\n}`);
  if (iconSwap && site.theme.defaultMode === 'dark') out.push(iconSwap('dark', ''));
  for (const o of site.theme.overrides || []) {
    out.push(`${o.selector} .scf-host {\n${tokenDecls(o.mode)}\n}`);
    if (iconSwap) out.push(iconSwap(o.mode, `${o.selector} `));
  }
  for (const o of site.theme.mediaOverrides || []) {
    const rules = [`${o.selector} .scf-host {\n${tokenDecls(o.mode)}\n}`];
    if (iconSwap) rules.push(iconSwap(o.mode, `${o.selector} `));
    out.push(`@media ${o.media} {\n${rules.join('\n')}\n}`);
  }
  for (const o of site.theme.ctxOverrides || []) {
    if (o.comment) out.push(`/* ${o.comment} */`);
    const rules = [`.scf-host.${o.ctxClass} {\n${tokenDecls(o.mode)}\n}`];
    if (iconSwap) rules.push(iconSwap(o.mode, `.scf-host.${o.ctxClass} `).replaceAll(`.scf-host.${o.ctxClass} .scf-host`, `.scf-host.${o.ctxClass}`));
    out.push(o.media ? `@media ${o.media} {\n${rules.join('\n')}\n}` : rules.join('\n'));
  }
  if (site.wiringExtra) {
    out.push(`/* ---- ${site.name} trigger styling (mirrors the site's own footer link rules) ---- */`);
    out.push(site.wiringExtra.trim());
  }
  return out.join('\n\n') + '\n';
}

// Full per-site stylesheet = canonical mechanics + theme wiring.
export function siteStylesheet(site) {
  const canonical = readFileSync(path.join(__dirname, 'support-flyout.css'), 'utf8');
  return canonical + '\n\n' + themeWiringCss(site);
}
