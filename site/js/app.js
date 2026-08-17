/* ============================================================
   Docket - client interactions
   Everything on the page is server-rendered; this file only
   adds behaviour: theme following, the mobile drawer, search
   filtering, FAQ accordions, voting, and the submission forms.
   No frameworks, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  var body = document.body;
  var mainScroll = document.getElementById("mainScroll");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ================= Theme =================
     Follows the device appearance automatically. An inline head
     snippet sets it before first paint; this keeps it live. */

  var themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  var favicon = document.getElementById("favicon");

  function applyTheme(dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    if (favicon && favicon.getAttribute("data-icon-dark")) {
      favicon.href = favicon.getAttribute(dark ? "data-icon-dark" : "data-icon-light");
    }
    // Swap card/sidebar product icons that ship a dark variant.
    var picons = document.querySelectorAll("img.picon[data-icon-dark]");
    for (var i = 0; i < picons.length; i++) {
      picons[i].src = picons[i].getAttribute(dark ? "data-icon-dark" : "data-icon-light");
    }
  }

  applyTheme(themeQuery.matches);
  if (themeQuery.addEventListener) {
    themeQuery.addEventListener("change", function (e) { applyTheme(e.matches); });
  }

  /* ================= Mobile drawer ================= */

  var menuBtn = document.getElementById("menuBtn");
  var drawerScrim = document.getElementById("drawerScrim");
  var sidebarEl = document.querySelector(".sidebar");

  function setDrawer(open) {
    if (!menuBtn) return;
    if (body.classList.contains("drawer-open") === open) return;
    body.classList.toggle("drawer-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      var target = sidebarEl.querySelector(".side-item.is-active") || sidebarEl.querySelector(".side-item");
      if (target) target.focus();
    } else if (document.activeElement && sidebarEl.contains(document.activeElement)) {
      menuBtn.focus();
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setDrawer(!body.classList.contains("drawer-open"));
    });
    drawerScrim.addEventListener("click", function () { setDrawer(false); });
    sidebarEl.addEventListener("click", function (ev) {
      if (ev.target.closest && ev.target.closest(".side-item, .brand")) setDrawer(false);
    });
  }

  /* ================= Search =================
     A quiet "Search /" chip that expands into a live filter
     field. Filters kanban cards or FAQ items on this page;
     matches carry the accent highlight ring. */

  var slot = document.querySelector(".head-tools .search-slot");
  var searchInput = slot ? slot.querySelector(".search input") : null;

  function openSearch() {
    if (!slot) return;
    slot.classList.add("is-open");
    searchInput.focus();
  }

  if (slot) {
    /* Deep-link/test hook: ?search=open expands the search field on
       load (used by the screenshot harness; harmless for visitors). */
    if (/[?&]search=open(&|$)/.test(location.search)) openSearch();

    slot.querySelector(".search-hint").addEventListener("click", openSearch);
    searchInput.addEventListener("blur", function () {
      if (searchInput.value.trim() === "") slot.classList.remove("is-open");
    });

    /* Resting search chip matches the width of the add button beside it
       (Request a Feature / Report a Bug / ...), so the pair reads as an
       even two-up. Desktop only; the mobile toolbar stretches search
       full-width on its own. Re-measured after fonts load and on resize,
       since the button's width is label- and font-dependent. */
    var addBtn = document.querySelector(".head-tools .section-add");
    var searchHint = slot.querySelector(".search-hint");
    function matchSearchWidth() {
      if (!addBtn || !searchHint) return;
      searchHint.style.width = "";
      if (window.matchMedia("(max-width: 720px)").matches) return;
      searchHint.style.width = addBtn.offsetWidth + "px";
    }
    matchSearchWidth();
    window.addEventListener("resize", matchSearchWidth);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(matchSearchWidth);

    var kanban = document.querySelector(".kanban");
    /* Bugs and Features are a list now, not a board. The filter still knew
       only about kanban cards, so typing in the search box on those two
       pages did nothing at all. */
    var slList = document.querySelector(".sl-list");
    /* The changelog and the testimonials wall are lists too. They had a
       search box added and nothing behind it, which is worse than no box. */
    var timeline = document.querySelector(".timeline");
    var tgrid = document.querySelector(".tgrid");
    var faqScope = document.querySelectorAll(".faq-cat, .group");
    var noMatch = document.querySelector(".faq-no-match");

    searchInput.addEventListener("input", function () {
      var q = searchInput.value.trim().toLowerCase();

      function filterSimple(scope, itemSel) {
        var shown = 0;
        Array.prototype.slice.call(scope.querySelectorAll(itemSel)).forEach(function (el) {
          var hit = q === "" || el.textContent.toLowerCase().indexOf(q) !== -1;
          el.style.display = hit ? "" : "none";
          el.classList.toggle("search-hit", hit && q !== "");
          if (hit) shown++;
        });
        var none = scope.parentNode.querySelector(".sl-none");
        if (!none) {
          none = document.createElement("p");
          none.className = "sl-empty sl-none";
          scope.parentNode.appendChild(none);
        }
        none.textContent = "Nothing matches \u201c" + searchInput.value.trim() + "\u201d.";
        none.style.display = shown === 0 && q !== "" ? "" : "none";
      }

      if (timeline) { filterSimple(timeline, ".tl-entry"); return; }
      if (tgrid) { filterSimple(tgrid, ".tcard"); return; }

      if (slList) {
        var shown = 0;
        Array.prototype.slice.call(slList.querySelectorAll(".sl-row")).forEach(function (row) {
          var hit = q === "" || row.textContent.toLowerCase().indexOf(q) !== -1;
          row.style.display = hit ? "" : "none";
          row.classList.toggle("search-hit", hit && q !== "");
          if (hit) shown++;
        });
        var none = slList.querySelector(".sl-none");
        if (!none) {
          none = document.createElement("p");
          none.className = "sl-empty sl-none";
          slList.appendChild(none);
        }
        none.textContent = "Nothing matches \u201c" + searchInput.value.trim() + "\u201d.";
        none.style.display = shown === 0 && q !== "" ? "" : "none";
        return;
      }

      if (kanban) {
        Array.prototype.slice.call(kanban.querySelectorAll(".kcol")).forEach(function (col) {
          var visible = 0;
          Array.prototype.slice.call(col.querySelectorAll(".kcard")).forEach(function (card) {
            var show = q === "" || card.textContent.toLowerCase().indexOf(q) !== -1;
            card.style.display = show ? "" : "none";
            card.classList.toggle("search-hit", show && q !== "");
            if (show) visible++;
          });
          col.querySelector(".kcount").textContent = visible;
          var empty = col.querySelector(".kempty");
          if (empty) empty.style.display = visible === 0 ? "" : "none";
        });
        return;
      }

      var any = false;
      Array.prototype.slice.call(faqScope).forEach(function (group) {
        var visible = 0;
        Array.prototype.slice.call(group.querySelectorAll(".faq-item")).forEach(function (item) {
          var text = item.textContent.toLowerCase();
          var show = q === "" || text.indexOf(q) !== -1;
          item.style.display = show ? "" : "none";
          item.classList.toggle("search-hit", show && q !== "");
          if (show) visible++;
        });
        group.style.display = visible > 0 ? "" : "none";
        if (visible > 0) any = true;
      });
      if (noMatch) noMatch.style.display = q !== "" && !any ? "block" : "none";
    });
  }

  /* ================= FAQ accordions ================= */

  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));

  function setFaqOpen(item, open) {
    item.classList.toggle("open", open);
    item.querySelector(".faq-q").setAttribute("aria-expanded", String(open));
    item.querySelector(".faq-a").setAttribute("aria-hidden", String(!open));
  }

  faqItems.forEach(function (item) {
    item.querySelector(".faq-q").addEventListener("click", function () {
      var wasOpen = item.classList.contains("open");
      faqItems.forEach(function (other) { if (other !== item) setFaqOpen(other, false); });
      setFaqOpen(item, !wasOpen);
    });
  });

  /* ================= Voting =================
     One vote per browser, remembered in localStorage. Optimistic
     increment; the count settles on the server's total when the
     API replies. No un-vote. */

  var VOTED_KEY = "thqSupportVoted";

  function votedSet() {
    try { return JSON.parse(localStorage.getItem(VOTED_KEY) || "{}"); } catch (e) { return {}; }
  }

  function markVoted(id) {
    var set = votedSet();
    set[id] = true;
    try { localStorage.setItem(VOTED_KEY, JSON.stringify(set)); } catch (e) {}
  }

  var voted = votedSet();

  Array.prototype.slice.call(document.querySelectorAll(".ov-vote[data-id], .vote[data-id]")).forEach(function (btn) {
    var id = btn.getAttribute("data-id");
    if (voted[id]) {
      btn.classList.add("voted");
      btn.setAttribute("aria-pressed", "true");
    }

    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      if (votedSet()[id]) return;
      markVoted(id);

      var nEl = btn.querySelector(".vote-n");
      var next = (parseInt(nEl.textContent, 10) || 0) + 1;
      nEl.textContent = next;
      nEl.classList.remove("rolling");
      void nEl.offsetWidth;
      nEl.classList.add("rolling");
      btn.classList.add("voted");
      btn.setAttribute("aria-pressed", "true");
      btn.classList.remove("is-popping");
      void btn.offsetWidth;
      btn.classList.add("is-popping");

      // Mirror the vote on every chip for the same item on this page
      Array.prototype.slice.call(document.querySelectorAll('.ov-vote[data-id="' + id + '"], .vote[data-id="' + id + '"]')).forEach(function (other) {
        if (other === btn) return;
        other.classList.add("voted");
        other.setAttribute("aria-pressed", "true");
        other.querySelector(".vote-n").textContent = next;
      });

      fetch("/api/vote/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.ok && typeof data.votes === "number") {
          Array.prototype.slice.call(document.querySelectorAll('.ov-vote[data-id="' + id + '"] .vote-n, .vote[data-id="' + id + '"] .vote-n')).forEach(function (el) {
            el.textContent = data.votes;
          });
        }
      }).catch(function () { /* optimistic count stands; the build reconciles */ });
    });
  });

  /* ================= Field validation helpers ================= */

  function setFieldError(input, bad) {
    var field = input.closest(".field");
    if (field) field.classList.toggle("is-error", bad);
    return !bad;
  }

  function showActionError(form, show, msg) {
    var actions = form.querySelector(".form-actions");
    var note = form.querySelector(".form-error-note");
    if (msg && note) note.textContent = msg;
    if (actions) actions.classList.toggle("has-error", show);
  }

  var SEND_FAIL = "That did not send. Please try again in a moment.";

  /* ================= Submission modal ================= */

  var modal = document.getElementById("submitModal");
  var lastTrigger = null;

  var KIND_COPY = {
    bug: {
      title: "Report a Bug",
      sub: "Spotted something off? Tell us what happened and we will take it from there.",
      submit: "Submit Report",
      bodyLabel: "Description",
      bodyPlaceholder: "What happened, and what did you expect?",
      bodyErr: "Please describe what happened.",
      successLine: "Thanks, your report is in.",
      successSub: "It is publishing now and will appear on the board within a minute."
    },
    feature: {
      title: "Request a Feature",
      sub: "Have an idea? The most-voted requests genuinely shape the roadmap.",
      submit: "Submit Request",
      bodyLabel: "Description",
      bodyPlaceholder: "What would you like it to do?",
      bodyErr: "Please describe your idea.",
      successLine: "Thanks, your request is in.",
      successSub: "It is publishing now and will appear on the board within a minute."
    },
    testimonial: {
      title: "Add New Testimonial",
      sub: "Enjoying the app? A few kind words go a long way.",
      submit: "Submit Testimonial",
      bodyLabel: "Your Testimonial",
      bodyPlaceholder: "What do you love about it?",
      bodyErr: "Please write a few words first.",
      successLine: "Thanks for the kind words.",
      successSub: "We read testimonials before they go live, so this one will appear once approved."
    }
  };

  /* ISO 3166-1 alpha-2 codes; names come from Intl.DisplayNames */
  var COUNTRY_CODES = ("AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW").split(" ");

  var countriesLoaded = false;

  function loadCountries() {
    if (countriesLoaded) return;
    countriesLoaded = true;
    var select = document.getElementById("mfCountry");
    if (!select) return;
    var names;
    try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { return; }
    var list = COUNTRY_CODES.map(function (code) {
      return { code: code, name: names.of(code) || code };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    list.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  }

  function modalEls() {
    return {
      form: document.getElementById("modalForm"),
      success: document.getElementById("modalSuccess"),
      title: document.getElementById("modalTitle"),
      sub: document.getElementById("modalSub"),
      submit: document.getElementById("modalSubmit"),
      bodyInput: document.getElementById("mfBody"),
      bodyLabel: document.getElementById("mfBodyLabel"),
      bodyErr: document.getElementById("mfBodyErr"),
      titleField: modal.querySelector('[data-f="title"]'),
      starsField: modal.querySelector('[data-f="stars"]'),
      countryField: modal.querySelector('[data-f="country"]')
    };
  }

  var pickedStars = 0;

  function setStars(n) {
    pickedStars = n;
    Array.prototype.slice.call(modal.querySelectorAll(".star-btn")).forEach(function (b) {
      var on = parseInt(b.getAttribute("data-star"), 10) <= n;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(parseInt(b.getAttribute("data-star"), 10) === n));
    });
  }

  function openModal(kind, trigger) {
    if (!modal) return;
    lastTrigger = trigger || null;
    var els = modalEls();
    var copy = KIND_COPY[kind];
    modal.setAttribute("data-kind", kind);

    els.title.textContent = copy.title;
    els.sub.textContent = copy.sub;
    els.submit.textContent = copy.submit;
    els.bodyLabel.textContent = copy.bodyLabel;
    els.bodyInput.placeholder = copy.bodyPlaceholder;
    if (els.bodyErr) els.bodyErr.textContent = copy.bodyErr;

    var isTestimonial = kind === "testimonial";
    els.titleField.hidden = isTestimonial;
    els.starsField.hidden = !isTestimonial;
    els.countryField.hidden = !isTestimonial;
    if (isTestimonial) loadCountries();

    els.form.reset();
    setStars(0);
    Array.prototype.slice.call(els.form.querySelectorAll(".field.is-error")).forEach(function (f) { f.classList.remove("is-error"); });
    showActionError(els.form, false);
    els.form.hidden = false;
    els.success.hidden = true;
    els.success.classList.remove("play");
    modal.classList.remove("is-success");
    els.submit.disabled = false;
    els.submit.textContent = copy.submit;

    modal.hidden = false;
    body.classList.add("modal-open");
    var first = els.form.querySelector(".field:not([hidden]) input, .field:not([hidden]) select, .field:not([hidden]) textarea");
    if (first) first.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    body.classList.remove("modal-open");
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  /* Swap the form for the drawn-check success state: the modal
     header is hidden (class on the modal), one line of copy per
     kind, and View/Done actions. Re-adding .play after a reflow
     restarts the animation if the modal is reused. */
  function showSuccess(kind, url) {
    var els = modalEls();
    var product = els.form.getAttribute("data-product") || "";
    var productSelect = document.getElementById("mfProduct");
    if (!product && productSelect) product = productSelect.value;

    document.getElementById("msLine").textContent = KIND_COPY[kind].successLine;
    var subEl = document.getElementById("msSub");
    if (subEl) subEl.textContent = KIND_COPY[kind].successSub || "";

    /* View links the BOARD the item will land on, not the item's own URL:
       a fresh post's page 404s until the rebuild finishes, so sending them
       to the section (where it appears within the minute) never dead-ends. */
    var viewEl = document.getElementById("msView");
    var section = kind === "testimonial" ? "testimonials" : (kind === "bug" ? "bugs" : "features");
    viewEl.href = product ? "/" + product + "/" + section + "/" : "/" + section + "/";

    els.form.hidden = true;
    els.success.hidden = false;
    modal.classList.add("is-success");
    els.success.classList.remove("play");
    void els.success.offsetWidth; /* force reflow so the animation restarts */
    els.success.classList.add("play");

    var doneBtn = els.success.querySelector(".ms-done");
    if (doneBtn) doneBtn.focus();
  }

  if (modal) {
    Array.prototype.slice.call(document.querySelectorAll("[data-add]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        /* On a phone the sidebar is a drawer, so leaving it open behind the
           dialog would put the visitor back in a menu they have finished
           with the moment they close the form. */
        if (body.classList.contains("drawer-open")) setDrawer(false);
        openModal(btn.getAttribute("data-add"), btn);
      });
    });

    Array.prototype.slice.call(modal.querySelectorAll("[data-modal-close]")).forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    /* Deep-link/test hook: ?submitted=bug|feature|testimonial opens the
       modal straight into its success state with a sample URL. Companion
       to ?search=open above - used by the screenshot harness and future
       tests; a harmless deep link for ordinary visitors. */
    var submittedHook = location.search.match(/[?&]submitted=(bug|feature|testimonial)(&|$)/);
    if (submittedHook) {
      openModal(submittedHook[1], null);
      showSuccess(submittedHook[1], "/");
    }

    Array.prototype.slice.call(modal.querySelectorAll(".star-btn")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setStars(parseInt(btn.getAttribute("data-star"), 10));
        var field = btn.closest(".field");
        if (field) field.classList.remove("is-error");
      });
    });

    var modalForm = document.getElementById("modalForm");
    modalForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var kind = modal.getAttribute("data-kind");
      var els = modalEls();
      var isTestimonial = kind === "testimonial";

      var product = modalForm.getAttribute("data-product") || "";
      var productSelect = document.getElementById("mfProduct");
      if (!product && productSelect) product = productSelect.value;

      var titleInput = document.getElementById("mfTitle");
      var nameInput = document.getElementById("mfName");
      var ok = true;

      if (productSelect && !modalForm.getAttribute("data-product")) ok = setFieldError(productSelect, !product) && ok;
      if (!isTestimonial) ok = setFieldError(titleInput, titleInput.value.trim() === "") && ok;
      if (isTestimonial && pickedStars === 0) {
        els.starsField.classList.add("is-error");
        ok = false;
      }
      ok = setFieldError(els.bodyInput, els.bodyInput.value.trim() === "") && ok;
      ok = setFieldError(nameInput, nameInput.value.trim() === "") && ok;

      if (!ok) {
        showActionError(modalForm, true, "Please check the highlighted fields.");
        return;
      }
      showActionError(modalForm, false);

      var payload = {
        kind: isTestimonial ? "testimonial" : "post",
        product: product,
        body: els.bodyInput.value.trim(),
        name: nameInput.value.trim(),
        email: document.getElementById("mfEmail").value.trim(),
        website: document.getElementById("mfWebsite").value
      };
      if (!isTestimonial) {
        payload.type = kind;
        payload.title = titleInput.value.trim();
      } else {
        payload.stars = pickedStars;
        payload.country = document.getElementById("mfCountry").value;
      }

      els.submit.disabled = true;
      els.submit.textContent = "Sending…";

      fetch("/api/submit/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "failed");
        showSuccess(kind, data.url || "");
      }).catch(function () {
        els.submit.disabled = false;
        els.submit.textContent = KIND_COPY[kind].submit;
        showActionError(modalForm, true, SEND_FAIL);
      });
    });
  }

  /* ================= Comment form (item detail) ================= */

  var commentForm = document.querySelector(".comment-form");

  if (commentForm) {
    commentForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nameInput = document.getElementById("cfName");
      var textInput = document.getElementById("cfText");
      var ok = setFieldError(nameInput, nameInput.value.trim() === "");
      ok = setFieldError(textInput, textInput.value.trim() === "") && ok;
      if (!ok) {
        showActionError(commentForm, true, "Please check the highlighted fields.");
        return;
      }
      showActionError(commentForm, false);

      var submitBtn = commentForm.querySelector(".form-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      var payload = {
        kind: "comment",
        product: commentForm.getAttribute("data-product"),
        type: commentForm.getAttribute("data-type"),
        itemId: commentForm.getAttribute("data-item"),
        body: textInput.value.trim(),
        name: nameInput.value.trim(),
        email: document.getElementById("cfEmail").value.trim(),
        website: document.getElementById("cfWebsite").value
      };

      fetch("/api/submit/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "failed");

        var thread = document.querySelector(".thread");
        var emptyEl = thread.querySelector(".thread-empty");
        if (emptyEl) emptyEl.remove();
        thread.insertAdjacentHTML("beforeend",
          '<article class="reply is-new"><div class="reply-head">' +
          '<span class="byline-name">' + esc(payload.name) + '</span>' +
          '<span class="reply-date num">Just Now</span></div>' +
          '<div class="reply-text"><p>' + esc(payload.body) + "</p></div></article>");
        var count = thread.querySelectorAll(".reply").length;
        thread.querySelector(".thread-head").textContent = count + (count === 1 ? " Reply" : " Replies");

        textInput.value = "";
        submitBtn.disabled = false;
        submitBtn.textContent = "Post Comment";

        var confirmEl = commentForm.querySelector(".form-confirm");
        if (!confirmEl) {
          commentForm.insertAdjacentHTML("beforeend",
            '<div class="form-confirm" role="status"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7.4 2.6 2.6L11 4.4"/></svg><span>Thanks - your comment is posted.</span></div>');
        }

        var rect = thread.lastElementChild.getBoundingClientRect();
        if (rect.bottom > window.innerHeight || rect.top < 0) {
          mainScroll.scrollBy({ top: rect.top - 120, behavior: reduceMotion ? "auto" : "smooth" });
        }
      }).catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Post Comment";
        showActionError(commentForm, true, SEND_FAIL);
      });
    });
  }

  /* ================= Keyboard ================= */

  document.addEventListener("keydown", function (ev) {
    var ae = document.activeElement;
    var typing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT");

    if (ev.key === "Escape") {
      if (modal && !modal.hidden) { closeModal(); return; }
      if (body.classList.contains("drawer-open")) { setDrawer(false); return; }
    }

    if (ev.key === "/" && !typing && slot) {
      ev.preventDefault();
      openSearch();
    }

    if (ev.key === "Escape" && typing && ae.closest && ae.closest(".search")) {
      ae.value = "";
      ae.dispatchEvent(new Event("input"));
      var s = ae.closest(".search-slot");
      if (s) {
        s.classList.remove("is-open");
        var hint = s.querySelector(".search-hint");
        if (hint) hint.focus();
      } else {
        ae.blur();
      }
    }
  });

})();
