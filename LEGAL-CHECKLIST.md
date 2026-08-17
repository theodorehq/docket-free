# Legal checklist

**Docket deliberately ships no legal templates.** The wording has to be yours, it depends on where you and your customers are, and wrong legal copy is worse than none. This is a plain-English list of what running a public support board actually commits you to, so you know what to cover.

**This is not legal advice.** If anything here is unclear for your situation, ask someone qualified. It is a cheap conversation compared to getting it wrong.

---

## What Docket actually does with data

Know this before you write anything, because it is what you are describing.

**Published publicly, by design:**
- The title and description of every bug report and feature request
- The display name the person typed when submitting. They choose it; it does not have to be their real name
- Comments and replies on items
- Testimonials, but only after you approve them
- Vote counts, as a number. Never who voted

**Stored but never published:**
- The submitter's email address, so you can reply to them. It lives in the item's file in your repo and is stripped before the site is built

**Collected automatically:**
- The submitter's IP address, held briefly in memory for rate limiting. Not written to disk
- Whatever your analytics provider collects, if you configured one. Docket ships with none

**Never collected:** passwords, payment details, or any account. There is no login.

---

## The one that catches people out: git history is permanent

Your support content lives in a git repository. **Deleting a file does not remove it from history.** Anything ever committed can be recovered from the repo unless the history itself is rewritten, which is disruptive and breaks every clone.

This matters most for email addresses. Docket is built so that no readable email address is written to your repo, which is what makes a deletion request a normal edit rather than a history rewrite. **If you change that behaviour, you take on the problem.**

Two practical rules:
- Keep your support repo **private**. Docket assumes this
- Before committing anything by hand, remember it is permanent

---

## What your privacy page needs to cover

1. **Who you are.** Your legal entity name, and an address if you have one. Customers need to know who holds their data
2. **What you collect**, using the list above. Be specific rather than vague
3. **Why**, and on what legal basis. For a support board this is usually your legitimate interest in supporting your own customers, plus consent for anything optional such as analytics
4. **That posts are public.** Say it plainly and early. People need to understand a submission is not a private email before they write one
5. **How long you keep it.** Decide, then say. "For as long as the product is supported" is a real answer
6. **Who else sees it.** Your host, your email provider, your analytics if any, and anything else you have switched on. Name them
7. **Where it goes.** If those providers are outside your country, say so
8. **Their rights**, and how to exercise them: a copy of their data, correction, deletion, objection. Give a real address that a person reads
9. **How to complain**, including to your national data-protection regulator if you have one
10. **Cookies.** Docket sets none by itself. If you add analytics that does, you need consent before it loads, not after

## What your terms page needs to cover

1. **What the board is for**, and that it is free to use
2. **House rules.** What gets removed: abuse, spam, other people's personal data, anything illegal
3. **That you can remove or edit posts**, and that you are not obliged to publish anything
4. **Who owns what people post**, and that by posting they let you display it
5. **That a roadmap is not a promise.** Plans change. Say so explicitly
6. **No warranty**, and a liability position appropriate to where you are
7. **Which country's law applies**

---

## Before you go live

- [ ] Support repo is **private**
- [ ] Decided how long you keep support content, and written it down
- [ ] Privacy page written, or `legal.privacyUrl` pointing at one you already have
- [ ] Terms page written, or `legal.termsUrl` set
- [ ] Both linked in the footer. Docket links them automatically once configured
- [ ] Submission form says clearly that posts are public
- [ ] If you enabled analytics, consent is handled before the script loads
- [ ] Somebody actually reads your support address
- [ ] You know how you would handle a deletion request, and have tried the steps once

---

## If someone asks to be deleted

1. Find their items. Their display name and email are in the frontmatter
2. Decide with them what "deleted" means: removing their name and email but keeping the report, or removing the whole item. Often they only object to being identifiable
3. Make the edit and commit it
4. If you have ever committed a readable email address, that address is still in history. Deal with that separately and honestly rather than claiming an erasure you have not performed

Answer within the time limit your jurisdiction sets. In the UK and EU that is one month.
