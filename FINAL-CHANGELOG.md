# Final change log

This revision was rebuilt from the Astro project source, not from manual live-site edits.

## Fixed

1. Updated the official email everywhere to `plainact@gmail.com`.
   - Visible page content
   - Contact page
   - About page
   - Footer
   - JSON-LD schema via `src/data/site.js`
   - Public-facing README and checklist documentation

2. Hardened navigation links for GitHub Pages base path `/plain-act/`.
   - Main navigation now includes Coming Soon.
   - Footer navigation includes the approved route set.
   - Internal page links now use Astro base-path-safe route helpers instead of fragile nested relative links.
   - Checked generated nested pages for bad URLs such as `about.html` or `/plain-act/contact/about.html`.

3. Confirmed the Coming Soon page remains available.
   - Source path: `src/pages/coming-soon.astro`
   - Built output: `dist/coming-soon/index.html`
   - Live URL after deployment: `https://plainact-crypto.github.io/plain-act/coming-soon/`
   - Linked from the main navigation, homepage, footer, sitemap page, and XML sitemap.

4. Kept DO THE WORK safe.
   - Page remains available at `/books/do-the-work/`.
   - Page remains marked `In development / metadata pending`.
   - It remains excluded from `public/sitemap.xml`.
   - No ISBNs, ASINs, Amazon links, fake dates, fake availability, or final cover are shown.

5. Updated GitHub Actions dependency installation.
   - Workflow now uses `npm ci` instead of `npm install`.

## Verification summary

- `npm ci` completed.
- `npm run build` completed successfully.
- `npm run preview` served key routes successfully.
- Internal link check against `dist/` found `0` broken local links.
- Search found `0` occurrences of the previous official email outside excluded dependency folders.
- Search found `0` occurrences of the forbidden old subtitle.
- Search found `0` visible placeholder endpoint/profile URL strings in `dist/`.
- `public/sitemap.xml` includes `/coming-soon/` and excludes `/books/do-the-work/`.
