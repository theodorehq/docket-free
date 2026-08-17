/* ============================================================
   Docket configuration

   Copy this file to `config.js` and edit that copy.

   `config.example.js` belongs to Docket and is overwritten by updates.
   `config.js` belongs to you and is never touched by an update.
   Keep it that way and updates will always be a clean merge.

   Secrets do NOT live here. They live in environment variables.
   See `.env.example`.
   ============================================================ */

export default {

  /* ---------- Who you are ---------------------------------- */
  brand: {
    // Your company or studio name. Appears in the sidebar wordmark,
    // page titles, structured data and email footers.
    name: "Example Co",

    // What this support centre is called. Usually "<name> Support".
    siteName: "Example Co Support",

    // The name shown on official replies from you, on the board and in
    // emails. Anything else is treated as a customer reply, so pick
    // something a customer could not plausibly type as their own name.
    officialAuthor: "Example Co",

    // What an official reply is labelled as on the board. "Support Team"
    // reads warmer than a company name on a reply somebody is reading
    // because something went wrong, which is why it is separate from
    // officialAuthor rather than derived from it.
    officialLabel: "Support Team",

    // What you call the things on this board. An agency running a support
    // centre for the people it builds for wants "Clients"; a studio with
    // its own apps wants "Products". It is only a word, so it is not
    // gated: it appears in the sidebar and above the picker.
    productsLabel: "Products",

    // The "Typical First Reply" figure on the home page.
    //
    // Left empty, it is MEASURED: the median gap between an item arriving
    // and its first official reply, so it is true by construction and
    // stays true as you get faster or slower.
    //
    // Set it only when you know better than the measurement, and only to
    // something you can stand behind: this is the number a customer will
    // compare against their own experience.
    //
    // A value starting with "<" ("<1h", "<2h", "<24h") sets the symbol
    // small and quiet beside the figure, the way a spec sheet writes it.
    typicalReply: "",


    // Your main website. Linked from the wordmark and structured data.
    homeUrl: "https://example.com",

    // Where this support centre itself lives. No trailing slash.
    // Docket needs its own subdomain; it cannot run in a folder of an
    // existing site. See the setup guide.
    siteUrl: "https://support.example.com",
  },

  /* ---------- How customers reach you ---------------------- */
  contact: {
    // Shown on the site, in emails and in structured data.
    supportEmail: "support@example.com",

    // Submissions and replies are committed to your repo by the API.
    // These are the git identity those commits are made under.
    //
    // IMPORTANT: on Vercel, this email MUST belong to a member of the
    // team that owns the deployment, or the automatic redeploy after a
    // submission is refused and nothing appears on your board.
    commitAuthorName: "Support Centre",
    commitAuthorEmail: "you@example.com",
  },

  /* ---------- Updates ---------------------------------------
     ---------------------------------------------------------- */
  updates: {
    autoMerge: false,
  },

  /* ---------- The feedback widget ---------------------------
     ---------------------------------------------------------- */
  widget: {
    allowedOrigins: [
      // "https://example.com",
      // "https://www.example.com",
    ],
  },


  /* ---------- Look ------------------------------------------ */
  theme: {
    // Fallback accent, used before a product-specific accent applies.
    accent: "#44586B",

    // Shown in the browser tab and as the sidebar mark.
    // Files live in `assets/`. Leave empty to fall back to a wordmark.
    favicon: "",
    ogImage: "",
  },

  /* ---------- Analytics (optional) --------------------------
     Leave scriptUrl empty to ship no analytics at all, which is the
     default. If you set one, add its domain to the Content Security
     Policy in vercel.json or the script will be blocked.
     ---------------------------------------------------------- */
  analytics: {
    scriptUrl: "",
    websiteId: "",
  },

  /* ---------- Search engines (optional) ---------------------
     ---------------------------------------------------------- */
  seo: {
    // Allow AI crawlers to read your support content. Most people want
    // this on: it is how ChatGPT and friends learn to answer questions
    // about your product correctly.
    allowAiCrawlers: true,
  },

  /* ---------- Legal pages (optional) ------------------------
     Docket can generate a privacy page and a terms page. They are OFF
     by default, because the wording has to be yours and wrong legal
     copy is worse than none.

     Docket does not provide legal templates. See LEGAL-CHECKLIST.md for
     what you need to cover, then write your own and paste it below, or
     leave this off and link to pages you already have.
     ---------------------------------------------------------- */
  legal: {
    enabled: false,

    // Used in the footer and structured data when enabled.
    companyName: "",
    companyAddress: "",

    // Full HTML for each page. Only used when enabled is true.
    privacyHtml: "",
    termsHtml: "",

    // Or link out to pages you already have, instead of generating any.
    privacyUrl: "",
    termsUrl: "",
  },
};
