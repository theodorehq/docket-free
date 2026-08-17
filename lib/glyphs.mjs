/* ============================================================
   Product icons, without asking anyone to draw one.

   A support centre for six products, all showing a grey letter, looks
   unfinished on the day it matters most: the first time somebody sees it.
   But most people setting one up do not have twelve icon files to hand,
   and asking for them is how a setup stalls.

   So there are two answers, and the good one costs a word:

     "icon": "glyph:wave"     one of the set below, on the product accent
     "icon": "assets/x.png"   a real icon file, which always wins
     "icon": ""              a designed monogram, so nothing looks broken

   THE GLYPHS

   One stroke weight, one grid, no vendor logos. They are deliberately
   plain: a product icon here sits at 40px beside a name, and anything
   with more detail turns to mush at that size while adding nothing.

   Drawn on a 32 box with a 2.4 stroke so they sit at the same visual
   weight as the monogram they replace.
   ============================================================ */

const S = 'stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';

export const GLYPHS = {
  /* nature and shapes, for products whose name is the metaphor */
  wave:     `<path d="M5 19c3.4 0 3.4-4 6.8-4s3.4 4 6.8 4 3.4-4 6.8-4M5 25c3.4 0 3.4-4 6.8-4s3.4 4 6.8 4 3.4-4 6.8-4M5 13c3.4 0 3.4-4 6.8-4s3.4 4 6.8 4 3.4-4 6.8-4" ${S}/>`,
  leaf:     `<path d="M25 7C13 7 7 12.5 7 20.5c0 2 .5 3.6 1.3 4.9C11 20 15 16.5 21 14.8c-5 3-8.5 6.6-10.4 11.6 1.4.9 3.1 1.3 5 1.3C24 27.7 25 16 25 7z" ${S}/>`,
  mountain: `<path d="M4 24l7.5-12 5 7.5 3-4.5L28 24z" ${S}/><circle cx="22" cy="9" r="2.6" ${S}/>`,
  orbit:    `<circle cx="16" cy="16" r="5" ${S}/><ellipse cx="16" cy="16" rx="12" ry="5.2" transform="rotate(-28 16 16)" ${S}/>`,
  prism:    `<path d="M16 4l11 19H5z" ${S}/><path d="M16 4v19" ${S} opacity=".45"/>`,
  cube:     `<path d="M16 4l11 6v12l-11 6-11-6V10z" ${S}/><path d="M5 10l11 6 11-6M16 16v12" ${S} opacity=".45"/>`,
  spark:    `<path d="M16 4l2.8 8.4L27 16l-8.2 3.6L16 28l-2.8-8.4L5 16l8.2-3.6z" ${S}/>`,

  /* tools and dev */
  wrench:   `<path d="M20.5 5.5a6.4 6.4 0 0 0-6 8.6L6 22.6a2.6 2.6 0 0 0 3.7 3.7l8.5-8.5a6.4 6.4 0 0 0 7.9-8.3l-3.4 3.4-3.6-.7-.7-3.6 3.4-3.4a6.4 6.4 0 0 0-1.3-.1z" ${S}/>`,
  branch:   `<circle cx="10" cy="8" r="3.2" ${S}/><circle cx="10" cy="24" r="3.2" ${S}/><circle cx="22" cy="13" r="3.2" ${S}/><path d="M10 11.2v9.6M22 16.2c0 4-4 4.8-8.8 4.8" ${S}/>`,
  terminal: `<rect x="4" y="6" width="24" height="20" rx="3" ${S}/><path d="M9.5 13l3.5 3.2-3.5 3.2M16.5 20h6" ${S}/>`,
  brackets: `<path d="M12 7L5 16l7 9M20 7l7 9-7 9" ${S}/>`,
  bolt:     `<path d="M18 3L7 18h7l-1 11 11-15h-7z" ${S}/>`,
  puzzle:   `<path d="M4 4.6h7.6V4a2.4 2.4 0 1 1 4.8 0v.6H24v7.6h.6a2.4 2.4 0 1 1 0 4.8H24V28H4z" ${S}/>`,
  bug:      `<rect x="10" y="11" width="12" height="15" rx="6" ${S}/><path d="M10 16H5M27 16h-5M11 8l2.5 3M21 8l-2.5 3M11 25l-3 3M21 25l3 3" ${S}/>`,

  /* documents and money */
  receipt:  `<path d="M8 5.5h16v21l-3.2-2.2-3.2 2.2-3.2-2.2-3.2 2.2-3.2-2.2z" ${S}/><path d="M12.5 12h7M12.5 17h7" ${S}/>`,
  page:     `<path d="M7 4h11l7 7v17H7z" ${S}/><path d="M18 4v7h7M12 18h8M12 22h6" ${S}/>`,
  book:     `<path d="M6 6h8a4 4 0 0 1 4 4v16a3 3 0 0 0-3-3H6z" ${S}/><path d="M26 6h-8a4 4 0 0 0-4 4v16a3 3 0 0 1 3-3h9z" ${S}/>`,
  cart:     `<circle cx="13" cy="26" r="2.2" ${S}/><circle cx="23" cy="26" r="2.2" ${S}/><path d="M4 5h4l3.2 15h13L27 10H9" ${S}/>`,
  tag:      `<path d="M16.5 4H27v10.5L14.8 26.7a2.4 2.4 0 0 1-3.4 0l-7.1-7.1a2.4 2.4 0 0 1 0-3.4z" ${S}/><circle cx="21.5" cy="10.5" r="1.9" ${S}/>`,

  /* people and comms */
  chat:     `<path d="M5 8.5A3.5 3.5 0 0 1 8.5 5h15A3.5 3.5 0 0 1 27 8.5v9a3.5 3.5 0 0 1-3.5 3.5H14l-7 6v-6h-.5A3.5 3.5 0 0 1 5 17.5z" ${S}/>`,
  mail:     `<rect x="4" y="7" width="24" height="18" rx="3" ${S}/><path d="M5 9.5l11 8 11-8" ${S}/>`,
  people:   `<circle cx="12" cy="11" r="4.2" ${S}/><path d="M4.5 26a7.5 7.5 0 0 1 15 0" ${S}/><path d="M21 8.2a4.2 4.2 0 0 1 0 7.6M23.5 26a7.5 7.5 0 0 0-3-6" ${S}/>`,
  shield:   `<path d="M16 4l10 4v8c0 6.5-4.2 10.6-10 12-5.8-1.4-10-5.5-10-12V8z" ${S}/><path d="M11.5 16l3 3 6-6" ${S}/>`,
  key:      `<circle cx="10.5" cy="10.5" r="5.5" ${S}/><path d="M14.5 14.5L26 26M21 21l3-3M18 18l3-3" ${S}/>`,

  /* data and time */
  chart:    `<path d="M5 27V5M5 27h22" ${S}/><path d="M10 22v-6M16 22V9M22 22v-9" ${S}/>`,
  pulse:    `<path d="M4 16h6l3-8 5 16 3.5-8H28" ${S}/>`,
  clock:    `<circle cx="16" cy="16" r="11.5" ${S}/><path d="M16 9v7.5l5 3" ${S}/>`,
  calendar: `<rect x="4.5" y="7" width="23" height="20" rx="3" ${S}/><path d="M4.5 13.5h23M11 4v5M21 4v5" ${S}/>`,
  compass:  `<circle cx="16" cy="16" r="11.5" ${S}/><path d="M20.5 11.5l-2.6 6-6 2.6 2.6-6z" ${S}/>`,
  route:    `<circle cx="9" cy="9" r="3.4" ${S}/><circle cx="23" cy="23" r="3.4" ${S}/><path d="M9 12.4v5A5.6 5.6 0 0 0 14.6 23H19" ${S}/>`,
  truck:    `<path d="M3 8h13v11H3z" ${S}/><path d="M16 12h5l4 4v3h-9z" ${S}/><circle cx="8.5" cy="23" r="2.6" ${S}/><circle cx="21" cy="23" r="2.6" ${S}/>`,
  globe:    `<circle cx="16" cy="16" r="11.5" ${S}/><path d="M4.5 16h23" ${S}/><ellipse cx="16" cy="16" rx="5.4" ry="11.5" ${S}/>`,
  pin:      `<path d="M16 28s9-8.2 9-14.4A9 9 0 0 0 7 13.6C7 19.8 16 28 16 28z" ${S}/><circle cx="16" cy="13.4" r="3.4" ${S}/>`,
  layers:   `<path d="M16 4l12 6-12 6-12-6z" ${S}/><path d="M4 16.5l12 6 12-6M4 22.5l12 6 12-6" ${S} opacity=".5"/>`,
  grid:     `<rect x="4.5" y="4.5" width="10" height="10" rx="2.4" ${S}/><rect x="17.5" y="4.5" width="10" height="10" rx="2.4" ${S}/><rect x="4.5" y="17.5" width="10" height="10" rx="2.4" ${S}/><rect x="17.5" y="17.5" width="10" height="10" rx="2.4" ${S}/>`,
  camera:   `<path d="M4.5 11.5A2.5 2.5 0 0 1 7 9h3.5l2-3h7l2 3H25a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 25 25H7a2.5 2.5 0 0 1-2.5-2.5z" ${S}/><circle cx="16" cy="16.5" r="4.6" ${S}/>`,
  music:    `<circle cx="9" cy="24" r="3.6" ${S}/><circle cx="23" cy="21" r="3.6" ${S}/><path d="M12.6 24V9l14-3v15" ${S}/>`,
  play:     `<circle cx="16" cy="16" r="11.5" ${S}/><path d="M13.5 11.5l7.5 4.5-7.5 4.5z" ${S}/>`,
};

export const GLYPH_NAMES = Object.keys(GLYPHS);

/**
 * Reads an `icon` value that names a glyph.
 * @returns {string|null} the glyph's inner SVG, or null if this is not a
 *   glyph reference (a file path, or nothing at all).
 */
export function glyphFor(icon) {
  const raw = String(icon || '').trim();
  if (!raw.toLowerCase().startsWith('glyph:')) return null;
  const name = raw.slice(6).trim().toLowerCase();
  return GLYPHS[name] || null;
}

/** True when the value names a glyph that does not exist, which is worth
 *  saying out loud rather than silently drawing a letter instead. */
export function isUnknownGlyph(icon) {
  const raw = String(icon || '').trim();
  return raw.toLowerCase().startsWith('glyph:') && !glyphFor(raw);
}
