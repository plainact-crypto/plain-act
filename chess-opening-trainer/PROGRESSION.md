# Progression, Mastery, and Prestige

These are product progression titles. They are not FIDE titles or over-the-board chess ratings.

## Foundation

- One variation is **Completed** after 5 valid Practice successes.
- Opening progress counts distinct completed variations across the six depth courses.
- **Mastered** remains fixed at 30 distinct completed variations.
- Raw sessions, Guided Training replays, invalid attempts, hinted attempts, and ordinary move count never advance prestige.

## Verified performance inputs

- **Distinct completed variations:** variations with at least 5 valid Practice successes, capped at 30 for Mastery.
- **Verified Practice successes:** lifetime valid, unhinted, mistake-free Practice completions. Successes after a variation reaches 5/5 still count here.
- **Practice consistency:** verified Practice successes divided by all completed Practice attempts. Invalid, hinted, or mistaken attempts remain in the denominator.
- **Verified Rank Tests:** completed, persisted Rank Test results for the same opening side.
- **Rank performance:** average persisted weighted Rank Test accuracy for the same opening side.

Existing profiles initialize lifetime Practice success from their current capped valid-pass count. They receive no retroactive credit for unrecorded repetitions.

## Prestige thresholds

All conditions in a row are required. Prestige starts only after Mastered 30/30.

| Product title | Distinct variations | Practice successes | Consistency | Rank Tests | Avg. Rank performance |
|---|---:|---:|---:|---:|---:|
| Mastered | 30 | 150 | — | — | — |
| Opening CM | 30 | 180 | 80% | 1 | 75% |
| Opening FM | 30 | 225 | 85% | 3 | 82% |
| Opening IM | 30 | 270 | 90% | 5 | 88% |
| Opening GM | 30 | 330 | 93% | 8 | 92% |

`Opening CM`, `Opening FM`, `Opening IM`, and `Opening GM` are deliberately product-specific labels.

## GM Stars

After Opening GM, stars range from `Opening GM ★1` through `Opening GM ★20`.

For star `N`, all Opening GM requirements must remain satisfied, plus:

- at least `330 + (30 × N)` verified Practice successes; and
- at least `8 + N` verified Rank Tests.

Consistency must remain at least 93% and average Rank performance at least 92%. The displayed star count is the lower of the Practice-success and Rank-Test star counts, capped at 20. Falling below either performance floor returns the displayed tier to the highest currently satisfied non-star prestige tier.

## Surface contract

Dashboard/profile summary, course and depth cards, progress summary, Practice, Rank Test, Opening Elo, counts, badges, and labels must read from the shared progression module. Opening Elo remains an independent internal training rating; prestige consumes Rank performance but does not change Elo scoring.
