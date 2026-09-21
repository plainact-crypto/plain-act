# Plain Act Astro Website

Professional static website for **[Plain Act](https://www.plain-act.com/)**, published by **PlainAct Publishing**.

Start with the **[New Manager Guide](https://www.plain-act.com/guides/new-manager/)** or browse the **[practical management articles](https://www.plain-act.com/articles/)**.

## Canonical production URL

```text
https://www.plain-act.com/
```

The production site is deployed on Vercel from the `main` branch.

Domain rules:
- `https://www.plain-act.com/` is the canonical host.
- `https://plain-act.com/` must permanently redirect to the matching path on `https://www.plain-act.com/`.
- Old GitHub Pages and pages.dev hosts are not valid canonical URLs and must never appear in built canonicals, sitemap entries, robots.txt, Open Graph URLs, or structured data.

## Stack

- Astro
- Static HTML/CSS output
- Vercel production deployment
- No backend
- No database

## SEO/domain safeguards

The build runs these scripts after Astro builds:

```text
scripts/normalize-static-hosts.mjs
scripts/normalize-article-markup.mjs
scripts/generate-sitemap.mjs
scripts/seo-domain-qa.mjs
```

The SEO QA step fails the build if an indexable sitemap page:
- uses a non-canonical host,
- contains an obsolete GitHub Pages or pages.dev host,
- has a missing or mismatched canonical,
- or if robots.txt does not reference the canonical sitemap.

Astro production config:

```js
site: 'https://www.plain-act.com'
base: '/'
trailingSlash: 'always'
```

## Sitemap and robots

The XML sitemap is generated automatically during every production build:

```text
https://www.plain-act.com/sitemap.xml
```

Robots file source:

```text
public/robots.txt
```

Expected production contents:

```text
User-agent: *
Allow: /

Sitemap: https://www.plain-act.com/sitemap.xml
```

Do not manually restore the former GitHub Pages sitemap URL.

## Google Search Console

Use the `plain-act.com` Domain Property when possible.

Submit:

```text
https://www.plain-act.com/sitemap.xml
```

Request indexing first for:
- homepage,
- New Manager Guide,
- main article hub,
- priority management articles,
- primary book page.

## Project structure

```text
public/
  assets/
  favicon.ico
  robots.txt
scripts/
  generate-sitemap.mjs
  normalize-static-hosts.mjs
  normalize-article-markup.mjs
  seo-domain-qa.mjs
src/
  components/
  data/
    books.js
    site.js
  layouts/
  pages/
  styles/
astro.config.mjs
package.json
package-lock.json
vercel.json
```

## Run locally

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

The production output is created in `dist/`.

## Contact

Official email:

```text
info@plain-act.com
```

## Publishing notes

- Do not add fake reviews, testimonials, awards, bestseller claims, or unsupported authority claims.
- Keep commercial pages clearly separated from practical editorial guidance.
- Add only verified third-party profile URLs to schema `sameAs`.
- Keep `DO THE WORK` out of the XML sitemap until its publication metadata is final.
