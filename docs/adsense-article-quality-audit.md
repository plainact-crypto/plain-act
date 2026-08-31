# Plain Act — AdSense Step 4 Article Quality Audit

Date: 2026-08-31
Scope: `src/pages/articles/*.astro`, New Manager Guide internal-link path, and first-book subpage overlap check.

## Verdict

All 11 indexable management articles were reviewed individually for user intent, practical value, templating risk, internal linking, metadata purpose, and overlap. None of the 11 should be deleted or merged at this stage. Their topics are materially distinct and each article contains a concrete scenario plus an actionable rule, script, checklist, agenda, or worked example.

The repeated article shell (hero, related cards, book CTA, shared closing attribution, CSS) is presentation boilerplate rather than duplicated substantive article content. The article bodies themselves address different management decisions and do not repeat long passages across topics.

A sitewide article-depth navigation block was added so every article now links users into the New Manager Guide, Tools & Resources, the Plain Act Method, and the broader article library. This strengthens the intended Guide → Articles → Resources → Method path without adding generic filler to article bodies.

## Article-by-article audit

| # | Route | Primary intent | Plain Act-specific practical value | Decision |
|---|---|---|---|---|
| 01 | `/articles/why-new-managers-overexplain/` | Stop overexplaining under pressure | Notice → Remove → State → Stop; before/after decision script; five-step weekly application | KEEP — PASS |
| 02 | `/articles/delegate-without-micromanaging/` | Delegate without hovering | Outcome → Constraints → Checkpoint → Don't Hover; worked delegation brief; five-step practice list | KEEP — PASS |
| 03 | `/articles/feedback-without-killing-morale/` | Give corrective feedback clearly | Observation → Impact → Next Step; worked feedback script; weekly feedback practice | KEEP — PASS |
| 04 | `/articles/build-authority-as-new-manager/` | Build authority without harshness | Decide clearly → Follow through → Stay level; harsh vs quiet-authority comparison | KEEP — PASS |
| 05 | `/articles/new-managers-say-yes/` | Protect management capacity | Pause → Priority → Plain No; trade-off script; capacity audit actions | KEEP — PASS |
| 06 | `/articles/manage-up-without-sounding-insecure/` | Give a manager useful visibility | Four-bullet weekly update: Progress / Risk / Ask / Next; worked update example | KEEP — PASS |
| 07 | `/articles/difficult-conversations-new-manager/` | Address difficult behavior early | Situation → Behavior → Impact + next step; avoided vs early-conversation example; conversation log | KEEP — PASS |
| 08 | `/articles/first-team-meeting-new-manager/` | Run a useful first team meeting | 30-minute four-part agenda; three operating rules; recap pattern | KEEP — PASS |
| 09 | `/articles/fix-everything-week-one/` | Avoid premature change in week one | Listen → Map → Pick One; 1:1 questions; observe-first comparison | KEEP — PASS |
| 10 | `/articles/boundaries-former-peers/` | Reset peer relationships after promotion | Name it → Separate lanes → Hold equal standard; scripts for former peers and peer-only spaces | KEEP — PASS |
| 11 | `/articles/what-should-a-new-manager-do/` | First 30 days pillar plan | Week-by-week plan, decision-boundary levels, worked scripts, FAQ schema, cross-links to supporting articles | KEEP — PILLAR PASS |

## Intent separation

The following potentially adjacent topics were checked for cannibalization:

- **Feedback vs Difficult Conversations:** feedback focuses on narrow performance correction; difficult conversations covers avoidance, observable behavior and early conflict intervention. Distinct.
- **Authority vs Former Peers:** authority covers stable management signals generally; former peers covers role-transition boundaries and fairness after internal promotion. Distinct.
- **Overexplaining vs Managing Up:** overexplaining addresses communication restraint with the team; managing up addresses a recurring reporting relationship with the manager. Distinct.
- **Delegation vs Saying Yes:** delegation covers transfer of ownership; saying yes covers capacity and request trade-offs. Distinct.
- **Fix Everything Week One vs First 30 Days pillar:** the week-one article is a focused failure mode; the pillar is the broader month plan. Distinct and complementary.

No article-to-article merge is justified by current intent.

## Internal-link quality

Before this step, each short-form article already linked to the article hub, Resources, the book, and one or two related articles. The pillar article contains multiple contextual inline links into supporting articles.

Step 4 adds `ArticleDepthLinks.astro` to every individual article through `BaseLayout.astro`. Each article now has direct post-content routes to:

1. `/guides/new-manager/`
2. `/resources/`
3. `/method/`
4. `/articles/`

This makes the free-content continuation path stronger than a book-only dead end.

## New Manager Guide internal-link pass

`/guides/new-manager/` already contains a dedicated `relatedArticles` collection covering all ten supporting article topics and links to the substantive new-manager checklist. The guide remains the primary pillar. No duplicate full article bodies are embedded into the guide.

Decision: **PASS**.

## Book subpage overlap audit

### Main book page
`/books/the-first-30-days-as-a-new-manager/`

Decision: **KEEP / INDEX**. It has independent product/book intent and is materially larger than the supporting summary surfaces.

### Summary
`/books/the-first-30-days-as-a-new-manager/summary/`

Decision: **KEEP / INDEX**. It provides a structured synopsis, audience, core argument, subject coverage and quick summary. It is useful without reproducing the full book page.

### Key Ideas
`/books/the-first-30-days-as-a-new-manager/key-ideas/`

Decision: **KEEP FOR USERS / NOINDEX,FOLLOW**. The page is only eight short idea cards and substantially overlaps concepts already expressed on the book page, summary, guide and articles. It should not contribute another indexable surface during the AdSense remediation period.

Implemented in Step 4.

### Quotes
`/books/the-first-30-days-as-a-new-manager/quotes/`

Decision: **NOINDEX,FOLLOW**. Already handled in Step 2 because a thin quotes collection is not needed as a Search/AdSense value surface.

## Repetition review

Common headings such as “What usually happens”, “Why this becomes a problem”, “What to do instead”, “Example”, and “How to apply this this week” recur across the short-form series. This is an editorial structure, not content duplication. The material underneath those headings is topic-specific.

The one-line Plain Act attribution and common book CTA are also boilerplate, not substantive duplicate body text. No long repeated article-body block was identified that justifies deletion or merging.

## Step 4 acceptance

- [x] Every article reviewed manually.
- [x] Every article has a distinct primary intent.
- [x] Every article contains scenario/example content.
- [x] Every article contains a practical rule, script, checklist, agenda, decision model, or worked action.
- [x] No article depends on purchase to deliver its core answer.
- [x] No material intent cannibalization requires a merge.
- [x] Pillar article remains differentiated from focused support articles.
- [x] Article continuation now links to Guide, Resources, Method and Articles.
- [x] New Manager Guide links into the supporting article cluster.
- [x] Book subpage overlap audited.
- [x] Thin Key Ideas page changed to `noindex,follow`.
- [x] Thin Quotes page remains `noindex,follow` from Step 2.

## Deferred to later planned gates

Step 5 remains responsible for editorial accountability, Method/About expansion, Corrections/Editorial Policy depth, Privacy/Affiliate verification, and wording-level trust hardening. Step 7 remains responsible for final automated crawl, metadata/schema checks, accessibility/H1 cleanup, and production responsive QA.

Step 4 does not fabricate publication dates, author identities, credentials, research claims, or user-performance results.
