# Installing Docket

Five steps, about fifteen minutes, and nothing to `npm install`. Docket has
no dependencies.

If you have a coding agent, open this folder in it and say "install Docket
by following INSTALL.md" and it will do all of this for you.

**At any point, run `npm run check`.** It tells you in plain English what is
still missing. When it says everything is set up, it is.

---

## 1. Your details

```bash
cp config.example.js config.js
```

Open `config.js` and change what is yours: your name, your website, your
support email, and the address this support centre will live at.

You do not have to fill in everything. Anything you leave out keeps a
sensible default, so a short config file is fine and easier to read later.

**One thing to get right now:** `brand.siteUrl` needs to be its own
subdomain, like `support.yourcompany.com`. Docket cannot live in a folder of
an existing site, because it serves its own pages from the root. No domain
yet? Start on the free address your host gives you and move later. Nothing
breaks.

---

## 2. Your products

```bash
cp products.example.json products.json
```

List whatever you support. There is no limit, on any tier.

`id` is short and lowercase and becomes part of the web address, so it is
worth getting right: changing it later breaks links.

Your board is now empty, which is correct. The example content lives in
`data.example/` and stops being used the moment `products.json` exists,
so there is nothing to delete.

If you would rather look around a populated board first, copy it in:

```bash
cp -R data.example data
```

It is demo content for invented products, so delete it (`rm -rf data`)
before you go live.

---

## 3. Your repository

Docket keeps everything in a git repository, which is also where your
support history will live. Put this folder in one of your own on GitHub,
private or public as you prefer.

If an assistant is doing this for you, tell it to commit as you. Hosts
check who wrote a commit, and one from an address that is not on your
account gets refused, along with an email about a stranger deploying to
your team. It is alarming and it means nothing.

Then create a token so the site can save what people send you:

1. github.com, then Settings, Developer settings, Personal access tokens,
   **Fine-grained tokens**
2. Repository access: **only this repository**
3. Permissions: **Contents: Read and write**. Nothing else.
4. Set an expiry and put a reminder in your calendar. When it expires,
   submissions stop being saved.

```bash
cp .env.example .env
```

Put the token in `.env` as `GITHUB_TOKEN`, and your repository as
`GITHUB_REPO` in the form `owner/name`. `.env` is already ignored by git, so
it never leaves your machine.

**Also generate the key that encrypts customer email addresses:**

```bash
openssl rand -base64 32
```

Put it in `.env` as `EMAIL_ENCRYPTION_KEY`. This matters more than it looks:
your repository's history is permanent, so an address written into it in
readable form can never truly be deleted. Encrypted, honouring a deletion
request is a normal edit. Keep the key somewhere safe. Lose it and every
stored address becomes permanently unreadable.

---

## 4. Put it online

Netlify, Cloudflare and Vercel all work, and all have a free tier. See
[docs/hosting.md](docs/hosting.md) for the differences. If you are not sure,
Netlify or Cloudflare.

Whichever you choose, set the same three values from `.env` in that host's
own settings: `GITHUB_TOKEN`, `GITHUB_REPO` and `EMAIL_ENCRYPTION_KEY`.

Then point your subdomain at it, following your host's instructions.

---

## 5. Check it

```bash
npm run check
```

Fix anything it flags and run it again.

---

## Running it

**To reply to someone**, open their file under `data/`, add your reply below
`## Replies` in this shape, and commit:

```markdown
### Your Company - 2026-08-12

Thanks for flagging this. It is fixed in 1.4.2, which is out now.
```

The name has to match `brand.officialAuthor` in your config, which is what
marks a reply as coming from you rather than from another customer.

**To close an item**, set `status: completed` in its frontmatter.

**To add a product**, add an entry to `products.json`.

Pushing is publishing. The site rebuilds itself about a minute later.

---

## Two commands worth knowing

```bash
npm run build      # refuses to publish a malformed file. Run before pushing.
npm run validate   # says exactly what is wrong with a data file, in plain English
```

---

## What you have

The board, voting, roadmap, changelog, FAQ, testimonials, search, your own
domain, unlimited products, and no account needed for anyone to post.

Docket also does a paid version, which does the work for you rather than
adding pages: first replies written and emailed automatically, everyone who
voted told when their request ships, Slack and Discord alerts, an embeddable
widget for your own site, and updates that arrive as a pull request you
merge with one click.

You are not missing any of the board by using this one.
