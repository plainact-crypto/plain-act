# Future Updates

## Add third-party author/profile links

When real live profile URLs exist, add them carefully to:

```text
src/data/site.js
```

Use only confirmed URLs. Add them to schema `sameAs` only after verification.

## Add a contact form

A static contact form can be added later with Formspree or FormSubmit. Create and test the endpoint first, then update `/contact/`. Do not publish a form with an untested action URL.

## Move DO THE WORK to Published

Only move this title to the Published section after final metadata and availability are confirmed. Add final cover art, ISBN/ASIN data when applicable, retail links, and final description.

## Add future manuals

Add future titles to `src/data/books.js` when enough confirmed metadata exists. Until then, keep future topics in the Coming Soon / In Development sections without dates or availability claims.
