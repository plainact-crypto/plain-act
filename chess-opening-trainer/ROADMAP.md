# Chess Opening Trainer — P0 Roadmap

Updated: 2026-08-13

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

## Next phase

- [ ] **Rank Test — current gate phase; Beta Readiness remains blocked**
  - Rank Test P0 implementation is closed, but the official current gate remains Rank Test while Guided Training classification verification is outstanding.

- [ ] **Beta Readiness — Full Product QA & Release Gate** — BLOCKED
  - Full-product desktop/mobile regression QA across Core flows.
  - Authentication/profile/cloud-sync and persistence checks.
  - Cross-mode navigation and state-transition regression.
  - Production smoke tests and release-blocker triage.
  - Beta release checklist and go/no-go gate.

After Beta Readiness: **Private Beta → Analytics/Retention → Monetization → Launch → Growth**.
