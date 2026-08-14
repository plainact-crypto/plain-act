# Chess Opening Trainer — P0 Roadmap

Updated: 2026-08-14

## Current P0 sequence

- [ ] **Guided Training — P0 Reopened / Blocked**
  - Reports #30–#32 reopened this gate because move-quality classification must be verified.

- [x] **Practice Test — P0 Audit & Fixes**
  - Legal move validation separated from scoring mistakes.
  - Illegal/touch-slip attempts do not create phantom mistakes.
  - Desktop drag preserved.
  - Mobile tap-to-select + tap-to-move supported alongside drag.
  - Recorded opponent moves remain visible before the next user turn.
  - First-try scoring added.
  - Result screen reports first-try score, correct decisions, and real mistakes.
  - Mistakes can be reviewed on the restored board position before each error.
  - Review shows played move vs learned move and allows return to training.
  - Practice Test hides evaluation/depth/PV during recall.
  - Move sounds remain tied to real board moves only.
  - Navigation guards prevent delayed replay from reopening or mutating an exited test.
  - GitHub build + deployment passed.
  - Supabase Reports #10 and #11 resolved.
  - Fix commits: `2108975232ac8d43ac95f7af1ef53a4f3342d882`, `6e1df995135243f8c4e6f8e0d10b4e5c28e2128a`.

- [x] **Rank Test — P0 Audit & Fixes**
  - Legal move validation is separated from Rank scoring; illegal moves and touch slips never create score penalties.
  - Desktop drag remains supported; mobile tap-to-select/tap-to-move is supported alongside drag with duplicate-touch suppression.
  - Rank scoring now evaluates the exact pre-move and post-move FEN directly instead of relying on asynchronous UI evaluation state.
  - Engine/evaluation failure is fail-closed: the attempt stops and no Elo/result is saved from invalid benchmark data.
  - Opening Elo inputs are finite/clamped; invalid engine data cannot poison accuracy, averages, bands, or final Elo.
  - Required repertoire anchors remain protected from unrestricted-engine preference penalties.
  - Saved rounds start from genuine saved-line decision positions; the fresh round creates a new opponent branch.
  - Per-round state resets correctly, including move count, board/history, errors, completion flags, and Rank branch state.
  - Mistake/inaccuracy/blunder review items retain the exact FEN before the move plus played/best move data.
  - Result summary persists Opening Elo, per-level Rank completion, history, saved/fresh accuracy, loss bands, performance, advice, and review items.
  - Result persistence is idempotent; race conditions cannot write duplicate Elo/history for the same attempt.
  - Rank hides evaluation bar/depth/PV/hints while the attempt is live.
  - Real opponent moves stay visible and existing move-sound logic remains tied to actual board-history changes.
  - Restart, Exit, browser back/pagehide, engine waits, scoring waits, and opponent waits are guarded by an attempt epoch so stale async callbacks cannot mutate an exited/restarted Rank Test.
  - Rank summary and Review My Mistakes flow were source-audited against the production build path.
  - Production build passed and Cloudflare Pages deployment succeeded after the Rank fixes and again after restoring the clean deployment workflow.
  - Key fix commits: `036f1251ace48f43937b07162a5f944b7f759f0b`, `62f82e976d4ddab2f7c91b339ccb9188d6472879`, `281e0438960bb514044f3fcc8204d3e399f7ed6d`, `0bbf3274695e12309777e3f9d4836340a97c4442`, `3742a674badcc125484347a6ec5901912a00d686`.

## Core P0 release gate

- [ ] Guided Training P0 reopened pending verification of Reports #30–#32 move-quality classification.
- [x] Practice Test P0 closed.
- [x] Rank Test P0 closed.
- [ ] **Core P0 gate blocked.**

## Progression & Mastery Logic

- [x] **Report #33 — progressive variation mastery**
  - One correct attempt never marks a move, variation, or opening as Mastered.
  - A variation is **Completed** only after 5 valid Practice passes.
  - Opening progression counts distinct completed variations across depth courses, capped at 30.
  - Progress levels advance every 5 completed variations; **Mastered** is reserved for 30/30.
  - Dashboard/profile summary, depth cards, course cards, progress labels, Practice completion, Rank unlock, mastered-variation count, and Opening Elo presentation use the shared progression source.
  - Rank Test unlocks after 5 distinct completed variations at the selected depth; Rank scoring and chess move logic are unchanged.
  - Existing Supabase progress remains compatible and is reinterpreted from saved valid-pass counts without destructive data rewriting.
  - Unit tests and production build passed.

- [x] **Prestige progression beyond Mastered**
  - Thresholds and product semantics are specified in `PROGRESSION.md` before implementation.
  - Added product-only titles: Opening CM, Opening FM, Opening IM, and Opening GM; UI explicitly states that they are not FIDE titles.
  - Added Opening GM Stars from ★1 through ★20.
  - Prestige requires Mastered 30/30 plus lifetime verified Practice successes, Practice consistency, completed Rank Tests, and average Rank performance.
  - Raw plays, Guided repetitions, invalid/hinted attempts, and move count do not advance prestige.
  - Dashboard/profile, depth/course navigation, Practice, Rank Test, completion summaries, Opening Elo presentation, badges, labels, and next-target copy use the shared progression module.
  - Opening Elo scoring and chess move logic remain unchanged.

## Activation & Onboarding — Audit & Redesign

- [x] **Beta Readiness blocker closed — 2026-08-14**
  - Benchmarked the activation patterns used by Chess.com Lessons/Study Plan and Chessable/MoveTrainer: reduce choice overload, expose one next lesson/action, show a visible learning path, and keep progress/review status persistent.
  - First-time onboarding is intentionally short: choose the first repertoire (London System / Caro-Kann), see the full path, then start the first Guided Training from one primary CTA.
  - Product journey is explicit across the activation experience: **Learn → Practice → Pass → Rank → Next Level**.
  - Dashboard now exposes one **Your next best action / Continue Training** action rather than forcing a new user to infer what to do next.
  - White and Black opening cards expose completed variations, progression/mastery label, next variation/action, current Practice pass requirement/progress, Rank Test unlock/status, and Opening Elo.
  - Empty-state behavior for a brand-new profile points directly to Variation 1 at the first depth instead of showing unexplained zero-state metrics only.
  - Session completion surfaces **What you achieved** and the recommended next action.
  - Returning users receive the same next-action logic from saved progress rather than restarting the onboarding journey.
  - Mobile layout collapses activation cards/path cleanly without horizontal overflow; desktop keeps the same information hierarchy.
  - No chess move logic, engine policy, Practice scoring, Rank scoring, or Opening Elo calculation was changed for this phase.
  - First implementation exposed a render-loop blocker during the production browser gate; it was rejected, replaced by the debounced/signature-stable V2 implementation, and regression coverage was added.
  - Supabase migration `add_activation_events_funnel` created `activation_events` with RLS and indexes.
  - Funnel events implemented exactly: `landing_view → signup_started → signup_completed → onboarding_completed → first_training_started → first_variation_completed → practice_started → rank_started → returned_user`.
  - Automated activation regression tests cover event taxonomy, onboarding path/content, next-action/dashboard requirements, stable rendering, and idempotent production injection.
  - Production build/deploy passed on commit `d1a7b63729e31df80fcfa1b7f2847ae14b9d710a`.
  - Production Playwright gate passed on both **Desktop 1440×1000** and **Mobile 390×844** against both GitHub Pages and the official Cloudflare Pages deployment `chess-opening-trainer-3jh.pages.dev`.

- [x] **Activation V2 mobile authenticated-profile regression — closed 2026-08-14**
  - Regression linked to the Activation V2 rollout chain: `b7e79414ebaa50b5b5bb6de81006678a0d5be319`, `90bb569804c6b5bf1374ae6a31cc45fd37c3d3ed`, `db1d1ea058a36f4d731d05249ee67e0c644cf23f`, `d1a7b63729e31df80fcfa1b7f2847ae14b9d710a`, and closure commit `c7141c01a805e02ae875824f668cdb4070481496`.
  - Symptom: authenticated mobile profile visibly shifted vertically while progress/profile DOM was rendered/hydrated; detailed email/progress/zero-state cards could occupy the first viewport before the activation CTA.
  - Root cause: Activation V2 observed the entire DOM subtree and re-ran activation injection around base `render()` calls. During cloud progress hydration and `enterProfile()` rendering, the activation hub could be inserted against transient profile state, removed by the next base render, then reinserted, producing visible vertical movement.
  - Source fix removes the Activation V2 global `MutationObserver` from the generated production source and couples activation synchronization directly to the app `render()` lifecycle with a single queued microtask. No delay, timeout, fixed overlay, animation, or visual masking is used to hide the instability.
  - Mobile hierarchy now keeps **Your next best action / Continue Training** above the detailed profile/progress statistics. All opening progress data remains available under **View opening progress**, collapsed by default below the CTA.
  - Activation hub is explicitly the first full-width app item in grid/flex layouts; detailed stats no longer compete with the primary action in the first viewport.
  - Source/regression commits: `8d089ec371b49109efaf47cc0bce20d4fadbca3b`, `150a810180f4265f0abde56effeabd4ad09092b8`, `681f2104e924d30b2c3db6b67d63946c212c1275`.
  - Production build and deployment passed for `681f2104e924d30b2c3db6b67d63946c212c1275`.
  - Real Chromium mobile verification at **390×844** passed on both GitHub Pages and Cloudflare Pages.
  - The production gate forces three consecutive app renders, samples the CTA/hub position for 30 animation frames, requires a single activation hub, requires detailed progress to stay collapsed, and requires the CTA to precede visible base `0/30` / `0/20` stats when present.
  - Verified result on both production origins: primary CTA top = **161px**; measured CTA vertical spread after repeated renders = **0.00px**.

## Next phase

- [ ] **Guided Training classification verification — current release blocker**
  - Production verification of Reports #30–#32 remains required before Core P0 can close.

- [ ] **Beta Readiness — Full Product QA & Release Gate** — BLOCKED by Guided Training classification verification only
  - Activation & Onboarding blocker is closed.
  - Full-product desktop/mobile regression QA across Core flows.
  - Authentication/profile/cloud-sync and persistence checks.
  - Cross-mode navigation and state-transition regression.
  - Production smoke tests and release-blocker triage.
  - Beta release checklist and go/no-go gate.

After Beta Readiness: **Private Beta → Analytics/Retention → Monetization → Launch → Growth**.
