# Chess Opening Trainer — P0 Roadmap

Updated: 2026-08-13

## Current P0 sequence

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

- [ ] **Rank Test — P0 Audit & Fixes** — CURRENT

### Rank Test P0 audit scope
- Legal moves and input behavior on desktop/mobile.
- Scoring and move classification integrity.
- Mistake/blunder capture without duplicate or phantom penalties.
- Result summary accuracy.
- Review Mistakes on board.
- Evaluation/engine behavior and leakage.
- Sounds and opponent move visibility.
- Navigation/restart/exit race safety.
- Responsive layout and tap/drag behavior.
