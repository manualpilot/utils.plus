# utils+ — SEO content & markup brief

A work brief for Claude Code, to be run against the utils.plus repository.

## Context

utils.plus is a collection of ~37 browser-based developer utilities (JSON, JWT, cron,
hashing, keygen, diff, and so on). Everything runs client-side: no server processing,
no third-party requests, no analytics. That positioning is a feature and must survive
every change in this brief.

An SEO audit found the site is technically clean but structurally invisible:

1. **The served HTML contains no `<a href>` at all.** The homepage is an `<h1>` and one
   paragraph — 38 words. The tool grid and navigation are rendered client-side, so
   crawlers that don't execute JavaScript see 38 orphan pages discoverable only through
   the sitemap. No internal link graph means no anchor-text signals and no authority
   flowing from the homepage to the tools.
2. **Every tool page is thin** — roughly 40–60 words of prose around a JavaScript widget.
   Competing pages pair the tool with real explanatory content.
3. **No structured data** anywhere on the site.
4. **Metadata gaps**: no `lang` attribute, no `og:image`, `twitter:card` is `summary`,
   sitemap has no `lastmod`, and a dead `keywords` meta tag is present.

Fixing 1 and 2 is the bulk of the work. 3 and 4 are quick.

## Before you start

- Detect the framework and rendering strategy first (check `package.json`, config files,
  and the build output). Everything in this brief must end up in **server-rendered HTML**,
  not injected on hydration. If the project uses static generation, that's fine — the
  requirement is that the markup exists in the response body before JavaScript runs.
- Read several existing tool pages to learn the established voice before writing any prose.
- Do not modify tool logic or client-side behaviour. This brief is about content and markup.
- Do not add analytics, fonts, tag managers, or any external request. The no-third-party
  guarantee is load-bearing.
- Work in priority order. Task 1 is worth more than everything else combined.

---

## Task 1 — Server-render the internal link graph

**Highest priority.** Nothing else in this brief matters until crawlers can traverse the site.

- Render the homepage tool grid as real `<a href>` elements in the server response, with
  descriptive anchor text (the tool's name, not "click here" or a bare icon).
- Add a global footer, present on every page, linking to all tool pages. Group by category
  if the count makes a flat list unwieldy.
- Add a **Related tools** section to the bottom of each tool page linking 3–5 genuinely
  related tools. Choose by real workflow adjacency, not alphabetically — someone decoding a
  JWT plausibly wants the hasher, keygen, and codec; someone on the CSV page wants JSON and
  the converter.
- Add a breadcrumb (`Home › Tool name`) as rendered markup, not only as JSON-LD.

**Acceptance:** `curl -s https://utils.plus/ | grep -c '<a '` returns a count matching the
number of tools, and the same holds for every route in the sitemap.

---

## Task 2 — Give each tool page real content

Target 300–800 words of server-rendered prose per page. Use this structure, in order:

1. `<h1>` — keep the existing heading, it's already well-targeted.
2. Lede — keep the existing one- or two-sentence description.
3. **The tool itself.** Content goes below the widget; never push the tool below the fold.
4. `## How it works` — what the tool actually does, in concrete terms. Mention specific
   behaviours that differentiate it (e.g. the JSON tool preserves big numbers and duplicate
   keys — that's the interesting part, lead with it).
5. `## Examples` — two or three worked examples with real input and real output.
6. `## Common problems` — the errors people actually hit with this format or tool, and what
   causes them.
7. `## Frequently asked questions` — 3–6 genuine questions with direct answers.
8. `## Related tools` — from Task 1.
9. `## References` — links to the relevant RFC, spec, or canonical documentation.

### Content rules

- **Every claim must be true and verifiable.** Test the examples. If you write that a cron
  expression fires every fifteen minutes, run it through the parser first.
- **Write the page you'd have wanted to read** when you last hit this problem. If a section
  exists only to add words, delete it.
- No keyword stuffing, no "in today's fast-paced world", no restating the h1 as a sentence.
- Reuse the existing voice: plain, concrete, slightly dry. No exclamation marks, no
  marketing register.
- Where privacy is genuinely relevant (keygen, password, JWT, certificate), say plainly that
  the operation happens in the tab and nothing leaves it. Don't repeat it on every page.
- FAQ answers should be one short paragraph. If an answer needs five paragraphs, it's a
  section, not an FAQ.

---

## Task 3 — Structured data

Add JSON-LD in a `<script type="application/ld+json">` block, server-rendered.

**Homepage** — `WebSite` plus `Organization`.

**Each tool page** — `SoftwareApplication`:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Cron Expression Builder & Parser",
  "url": "https://utils.plus/cron",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Any",
  "browserRequirements": "Requires JavaScript",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

**Each tool page** — `BreadcrumbList` matching the rendered breadcrumb.

**Pages with an FAQ** — `FAQPage`. The structured data must match the visible questions and
answers exactly; marking up content that isn't on the page is a guidelines violation.

Validate every page against the Rich Results Test before considering this done.

---

## Task 4 — Metadata hygiene

- Add `lang="en"` to `<html>`.
- Create an `og:image` (1200×630) per page, or one good site-wide default, and switch
  `twitter:card` to `summary_large_image`. Dev tools spread through link sharing on Hacker
  News, Reddit and Lobsters, and a bare card costs real click-through.
- Remove the `keywords` meta tag. Search engines have ignored it for two decades.
- Add `<lastmod>` to every sitemap entry, driven by actual file or content modification time
  rather than build time — a sitemap that claims every page changed on every deploy trains
  crawlers to ignore the field.
- Verify that `http://` → `https://` and `www` → non-`www` both return a single 301 to the
  canonical host. Fix if not.

---

## Task 5 — Long-tail guides (second phase, only after 1–4 ship)

Create a `/guides/` section targeting the specific questions people search, each linking
into the tool that answers it. The pattern: one focused page per question, 600–1200 words,
with a worked example and a prominent link to the relevant tool.

Good candidates: cron expression recipes for common schedules, verifying a JWT signature
with RS256, choosing between UUID versions, what makes a regex catastrophically slow, X.509
certificate chain troubleshooting.

This is where a 38-page site can realistically win. Don't start it until the site is
crawlable and the tool pages have substance.

---

## Verification

Run before opening a PR:

```bash
# Internal links exist in the served HTML, not just after hydration
curl -s https://utils.plus/ | grep -c '<a '

# Every sitemap URL returns 200
curl -s https://utils.plus/sitemap.xml \
  | grep -oP '(?<=<loc>)[^<]+' \
  | xargs -I{} -P4 curl -s -o /dev/null -w '%{http_code} {}\n' {}

# No page has lost its title, description or canonical
```

Then, with JavaScript disabled in a browser: the homepage should show a navigable list of
tools, and each tool page should show its full explanatory content. If either is blank, the
work isn't done.

---

## Out of scope

These came out of the same audit but aren't repository work — don't attempt them:

- **Domain history.** Old Thai-language spam URLs (`/samp.html` and similar) still surface
  in search results and now 404. The domain looks repurposed. Check Google Search Console
  for manual actions and security issues, review the backlink profile, disavow anything
  toxic. Do this early — a legacy penalty would blunt everything above.
- **The AI-crawler decision.** `robots.txt` blocks ClaudeBot, GPTBot, CCBot, Google-Extended,
  Applebot-Extended, Amazonbot, meta-externalagent and Bytespider. Defensible, but it makes
  the site invisible in assistant-mediated discovery. The owner's call, not a code change.
- **Link building.** Show HN, r/webdev, r/devops, Lobsters, Product Hunt, alternativeto.net,
  awesome-lists, and inclusion in the "best X tool" roundups that already rank.
