# AdSense Step 3 — Information Architecture & Navigation QA

Date: 2026-08-31
Scope: main navigation, footer, homepage content hierarchy, responsive navigation.

## Required architecture

Primary navigation must be content-first:

1. Home — `/`
2. New Manager Guide — `/guides/new-manager/`
3. Articles — `/articles/`
4. Tools & Resources — `/resources/`
5. Books — `/books/`
6. About — `/about/`

Coming Soon and Contact must not be primary navigation items.

## Homepage order

1. Practical management positioning + free first action.
2. Start Here — New Manager Guide.
3. Solve a Problem — six high-value article paths.
4. Use a Resource — free New Manager Checklist + resources hub.
5. Practical Framework — Plain Act Method preview.
6. Go Deeper — book section after free content.
7. Publishing & Trust — About, Editorial Policy, Corrections Policy, Contact.

## Footer structure

### Content
- New Manager Guide
- Articles
- Tools & Resources
- Method

### Books
- Books
- The First 30 Days as a New Manager

### About & trust
- About
- Editorial Policy
- Corrections Policy
- Contact
- Privacy Policy
- Affiliate Disclosure
- Sitemap

## Step 3 implementation checks

- [x] Main navigation exposes Guide, Articles, Resources, Books, About.
- [x] Coming Soon is absent from primary navigation.
- [x] Contact is moved to footer/trust navigation.
- [x] Homepage first primary CTA is a free guide, not a purchase.
- [x] Homepage visibly links to substantial free content.
- [x] Homepage contains six direct problem-to-article paths.
- [x] Homepage contains a real free resource path.
- [x] Book promotion appears after free guidance/resources.
- [x] Footer is grouped by Content / Books / About & trust.
- [x] Editorial Policy and Corrections Policy routes are live rather than dead footer links.
- [x] Mobile primary navigation is horizontally scrollable instead of overflowing the viewport.
- [x] Mobile buttons stack to full width at narrow widths.
- [x] Footer collapses from three groups to a responsive two-column/one-column structure.

## Release verification required after merge

- [ ] Production build succeeds.
- [ ] Deployment succeeds.
- [ ] Production homepage returns 200.
- [ ] Main nav links resolve without 404.
- [ ] Footer trust links resolve without 404.
- [ ] Homepage free-content links resolve without 404.
- [ ] No `/plain-act/` hard-coded base path remains in the homepage.
- [ ] Generated sitemap includes the new indexable trust routes and continues to exclude noindex routes.

Step 3 is PASS only after merge + production build/deploy success + link/route verification.
