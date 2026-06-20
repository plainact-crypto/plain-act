# Plain Act Astro Website

Professional static website for **Plain Act**, published by **PlainAct Publishing**.

The site is built for GitHub Pages, Google indexing, author verification workflows, and future expansion into a wider Plain Act catalog. It uses Astro with no backend, no database, no paid hosting requirement, no WordPress, and no tracking scripts.

## Current status

This revised package is live-deployment oriented:

- Public pages do not display unavailable third-party profile URLs.
- JSON-LD `sameAs` fields include only real live URLs; because no verified profile URLs were supplied, those fields are omitted.
- The contact page uses the official email only: `osamabooks2023@gmail.com`.
- The unfinished contact form has been removed until a real static-form endpoint exists.
- `DO THE WORK` is marked as **In development / metadata pending** and is not listed as published.
- Book schema sales-availability claims have been removed.
- Sitemap is maintained as a single manual source at `public/sitemap.xml`. Because `DO THE WORK` is metadata pending, it is intentionally omitted from the XML sitemap until final publication metadata is confirmed.

## Stack

- Astro
- Static HTML/CSS output
- GitHub Pages deployment via GitHub Actions
- No backend
- No database
- No client-side framework requirement

## Important URLs

Live base URL:

```text
https://plainact-crypto.github.io/plain-act/
```

Astro config:

```js
site: 'https://plainact-crypto.github.io'
base: '/plain-act/'
```

## Project structure

```text
.github/workflows/deploy.yml
public/
  assets/
    plain-act-logo.png
    book-cover-first-30-days.jpg
    book-mockup-first-30-days.jpg
    og-image.jpg
  favicon.ico
  robots.txt
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
README.md
QA-CHECKLIST.md
LAUNCH-CHECKLIST.md
FUTURE-UPDATES.md
```

## Run locally

```bash
npm install
npm run dev
```

Then open the local Astro URL shown in the terminal.

## Build

```bash
npm run build
```

The production output is created in:

```text
dist/
```

## Preview the production build

```bash
npm run preview
```

## Deploy to GitHub Pages

1. Upload this project to the repository root.
2. Commit `package.json`, `package-lock.json`, `astro.config.mjs`, `src/`, `public/`, and `.github/workflows/deploy.yml`.
3. In GitHub, go to **Settings → Pages**.
4. Set **Build and deployment** to **GitHub Actions**.
5. Push to the `main` branch.
6. Confirm the workflow completes successfully in the **Actions** tab.
7. Open:

```text
https://plainact-crypto.github.io/plain-act/
```

## Contact page

The contact page intentionally uses the official email only:

```text
osamabooks2023@gmail.com
```

A static contact form can be added later after a real Formspree or FormSubmit endpoint exists. Do not add a form action that has not been created and tested.

## Updating book data

Primary book data is in:

```text
src/data/books.js
```

Update this file when final metadata changes. Keep the current approved subtitle for the primary book everywhere:

```text
A Practical Manual for First-Time Managers on Authority, Feedback, Delegation, and Decision Timing
```

Do not restore earlier subtitle wording for this book.

## DO THE WORK status

`DO THE WORK` is currently treated as:

```text
In development / metadata pending
```

Move it into the Published section only after final public details are supplied and verified, including final cover, ISBN/ASIN data if applicable, retail availability, and finished description.

## Third-party profile links

Author Central, Goodreads, and Google Books links are omitted until real live URLs are available. When verified URLs exist, add them to `src/data/site.js` and relevant page copy. Add only real live URLs to schema `sameAs` arrays.

## Sitemap and robots

Sitemap is maintained as a single manual source at `public/sitemap.xml` and copied into `dist/` during build.

Robots file:

```text
public/robots.txt
```

Expected sitemap URL after deployment:

```text
https://plainact-crypto.github.io/plain-act/sitemap.xml
```

## Submit sitemap to Google Search Console

1. Open Google Search Console.
2. Add or open the GitHub Pages property.
3. Submit:

```text
https://plainact-crypto.github.io/plain-act/sitemap.xml
```

4. Request indexing for the home page, primary book page, and about page.

## Assets

The following asset paths are required by the site:

```text
public/assets/plain-act-logo.png
public/assets/book-cover-first-30-days.jpg
public/assets/book-mockup-first-30-days.jpg
public/assets/og-image.jpg
public/favicon.ico
```

Replace image files only with brand-approved final files using the same paths to avoid breaking references.

## Notes on claims

This site intentionally avoids:

- fake reviews
- fake testimonials
- fake awards
- bestseller claims
- fake media logos
- unsupported institutional authority
- stock business imagery
- tracking scripts

## Final cleanup decision

- New Manager Guide breadcrumb is simplified to `Home → New Manager Guide` because no `/guides/` index page exists.
- `/books/do-the-work/` remains accessible as an in-development status page, but is intentionally omitted from `public/sitemap.xml` while metadata is pending.
