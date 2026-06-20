# Plain Act Launch Checklist

1. Run `npm install`.
2. Run `npm run build`.
3. Run `npm run preview` and review key pages.
4. Confirm there are no unavailable third-party links visible on public pages.
5. Confirm the contact page shows only `osamabooks2023@gmail.com` until a real static-form endpoint exists.
6. Confirm DO THE WORK is marked as in development / metadata pending.
7. Confirm the primary book subtitle is current everywhere.
8. Confirm the old subtitle has zero occurrences.
9. Confirm generated sitemap loads at `/plain-act/sitemap.xml` after deployment.
10. Enable GitHub Pages with GitHub Actions.
11. Submit the sitemap in Google Search Console.

## DO THE WORK sitemap decision

`/books/do-the-work/` remains a public in-development status page, but it is omitted from `public/sitemap.xml` until final metadata, cover, ISBN/ASIN, and availability are confirmed.
