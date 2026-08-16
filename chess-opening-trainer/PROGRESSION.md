# Progression, Mastery, and Prestige

These are product progression titles. They are not FIDE titles or over-the-board chess ratings.

## Training path

- Formal training starts at **Depth 10** for both D4 Player and C6 Player.
- All 20 variations are available at Depth 10.
- Depth progression is **per variation**, not global across the opening.
- A variation unlocks its own next depth only after **5 valid Practice successes** at the current depth.
- The path for one variation is **10 → 15 → 20 → 25 → 30 → Game End**.
- Moving to the next depth keeps the same variation identity and repeats the already learned prefix before adding the next five user moves.
- After passing Depth 30 at 5/5, the same variation can be continued beyond move 30 until the game naturally finishes.
- Progress in one variation never unlocks a deeper stage for a different variation.

## Rank Test ladder

- Rank Test stays locked until **one complete variation line** has finished the entire path: **Depth 10 = 5/5 → 15 = 5/5 → 20 = 5/5 → 25 = 5/5 → 30 = 5/5 → natural Game End**.
- Completing only one Depth stage is not enough to unlock Rank.
- The full-line requirement is for the **same variation identity** from Depth 10 through Game End.
- One Rank Test attempt is **one game only**, never a bundle of several games or rounds.
- The Rank ladder is global per opening side, not duplicated separately for every Depth.
- Opponent strength progresses through **1800 → 2000 → 2200 → 2500 → 2700 → 3000**.
- Rank opponent strength is separate from the full-strength engine analysis used to score the user's moves.
- A cleared Rank level advances the next challenge; a failed level remains the retry target.
- A Rank result recommends a concrete next action when the player loses or makes material mistakes: review mistakes, Practice the weak line again, or complete another full variation line before retrying.

## Foundation

- One variation-depth stage is **Completed** after 5 valid Practice successes.
- Opening progress counts distinct completed variation-depth stages across Depths 10/15/20/25/30.
- **Mastered** remains fixed at 30 distinct completed stages.
- Raw sessions, Guided Training replays, invalid attempts, hinted attempts, and ordinary move count never advance prestige.

## Verified performance inputs

- **Distinct completed variations:** variation-depth stages with at least 5 valid Practice successes, capped at 30 for Mastery.
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
