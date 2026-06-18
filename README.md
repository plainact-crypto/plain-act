# Plain Act GitHub Pages Website

This is a clean, static, GitHub Pages-ready website package for Plain Act and the book **The First 30 Days as a New Manager**.

The site is designed for:

- Goodreads Author Program verification
- Google indexing
- official author/book presence
- linking to Amazon book pages
- public contact and verification information

No external JavaScript frameworks, tracking scripts, popups, reviews, ratings, fake logos, testimonials, or unsupported claims are included.

## Files included

- `index.html` — home / official landing page
- `about.html` — Plain Act author and publisher identity page
- `book.html` — detailed book page
- `contact.html` — static contact and verification page
- `404.html` — branded not found page
- `styles.css` — responsive editorial styling
- `robots.txt` — allows crawling and links the sitemap
- `sitemap.xml` — sitemap using the GitHub Pages placeholder domain
- `assets/plain-act-logo.png` — placeholder logo image
- `assets/book-cover.jpg` — placeholder book cover image
- `assets/book-mockup.jpg` — placeholder mockup image
- `images/.gitkeep` — keeps the images folder present in Git

## How to upload to GitHub

1. Create a new GitHub repository.
2. Download and unzip this package.
3. Upload all files and folders to the root of the repository.
4. Commit the files to the `main` branch.

The files should be at the repository root, not inside an extra nested folder, unless you intentionally configure GitHub Pages for that folder.

## How to enable GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Go to **Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Save.
6. GitHub will publish the site at a URL similar to:

```text
https://USERNAME.github.io/REPOSITORY-NAME/
```

## Replace placeholder URLs

After GitHub Pages gives you the final site URL, replace the following placeholders in all `.html`, `robots.txt`, and `sitemap.xml` files.

### Replace `SITE_URL_HERE`

Use your published site URL without a trailing slash, for example:

```text
https://USERNAME.github.io/REPOSITORY-NAME
```

### Replace sitemap domain

In `sitemap.xml` and `robots.txt`, replace:

```text
https://USERNAME.github.io/REPOSITORY-NAME/
```

with the actual GitHub Pages URL.

### Replace `GOODREADS_BOOK_URL_HERE`

Replace this placeholder with the Goodreads book page URL once available.

### Replace `AMAZON_AUTHOR_PAGE_URL_HERE`

Replace this placeholder with the Amazon Author Central page URL once available.

## Replace logo and book images

The package includes placeholder image files so there are no broken image paths.

Replace these files with the final images while keeping the same filenames:

```text
assets/plain-act-logo.png
assets/book-cover.jpg
assets/book-mockup.jpg
```

Recommended image notes:

- Keep the logo simple and readable.
- Use a real book cover image for `book-cover.jpg`.
- Use a clean book mockup for `book-mockup.jpg` if you want one later.
- Compress images before uploading for faster page speed.

## Test locally

Open `index.html` directly in a browser. The site should work locally without a web server.

Check these pages:

- `index.html`
- `about.html`
- `book.html`
- `contact.html`
- `404.html`

Internal links are relative so they work locally and on GitHub Pages.

## Submit sitemap to Google Search Console later

After the site is live:

1. Go to Google Search Console.
2. Add the GitHub Pages URL as a property.
3. Verify ownership using one of Google's available methods.
4. Open **Sitemaps**.
5. Submit:

```text
https://USERNAME.github.io/REPOSITORY-NAME/sitemap.xml
```

Use the final published URL after replacing the placeholder.

## Use for Goodreads Author Program verification

The `about.html` and `contact.html` pages visibly list the official author email:

```text
osamabooks2023@gmail.com
```

Use the live GitHub Pages URL for author/profile verification and public book information. The about page includes this statement:

```text
This page is maintained for author/profile verification and public book information.
```

## Amazon book links included

- Kindle: https://www.amazon.com/dp/B0GNSXZP21
- Paperback: https://www.amazon.com/dp/B0H5WHFLYY
- Hardcover: https://www.amazon.com/dp/B0H5WPDTNB

## SEO notes

Each page includes:

- title tag
- meta description
- canonical link placeholder
- Open Graph tags
- Twitter card tags
- JSON-LD structured data where appropriate

The book schema does not include reviews, aggregate ratings, awards, bestseller claims, or pricing claims.
