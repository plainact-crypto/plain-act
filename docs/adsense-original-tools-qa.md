# AdSense Step 6 — Original Tools QA

Status: READY FOR CI / PRODUCTION SMOKE
Date: 2026-08-31

## Scope

This remediation step adds three original, browser-based management utilities intended to give the site practical value beyond articles and book promotion:

1. `/tools/new-manager-30-day-planner/`
2. `/tools/difficult-conversation-planner/`
3. `/tools/delegation-brief-builder/`

`/resources/` is rebuilt as the discovery hub for these tools and supporting checklists/guides.

## Functional requirements

### New Manager 30-Day Planner
- User can select team size, role transition, work model, current situation, and focus.
- Submit generates a four-week plan.
- Output includes context-specific priorities, a do-not-do-yet list, conversations to schedule, decisions to delay, and related Plain Act reading.
- Copy and print actions are available after generation.

### Difficult Conversation Planner
- User enters the event, observable behavior, impact, desired outcome, and urgency.
- Required fields prevent an empty brief.
- Submit generates a neutral opening, fact/impact structure, question, expectation, next step, timing guidance, and safety/HR escalation caution.
- Copy and print actions are available after generation.

### Delegation Brief Builder
- User enters outcome, deadline, owner, authority level, constraints, checkpoints, and escalation triggers.
- Required fields prevent an empty brief.
- Submit generates a delegation brief with definition of done, owner, deadline, authority, constraints, checkpoint, escalation rule, and confirmation question.
- Copy and print actions are available after generation.

## Privacy requirements

- Tool form values are processed by JavaScript in the browser page.
- Tool scripts do not intentionally submit or persist the entered values to a Plain Act server.
- The Privacy Policy explicitly distinguishes tool input processing from site-level analytics/advertising services.
- Tool pages state the local-processing behavior adjacent to the forms or tool description.

## Production smoke gate

`chess-opening-trainer/scripts/plain-act-tools-smoke.mjs` runs after production deployment using Playwright.

For Desktop and Mobile it must:
- Load all three production tool URLs successfully.
- Fill the real controls and submit the real forms.
- Verify each generated output contains expected context-specific content.
- Detect horizontal overflow.
- Track request URLs and request bodies during the interaction.
- Fail if unique QA marker values entered into the tool forms appear in a network request.

Total expected passing cases: 6 (3 tools × 2 device profiles).

## Content/value gate

PASS criteria:
- Tools perform an actual transformation of user inputs into useful output; they are not placeholders or static cards.
- Outputs are substantially different in purpose: first-month planning, difficult-conversation preparation, and delegation handoff design.
- Each tool links to relevant editorial guidance instead of existing as an isolated thin route.
- The Resources hub gives direct access to the tools and the existing manager checklist.
- Guidance avoids claims of guaranteed workplace results and flags circumstances that require employer policy or qualified HR/legal/safety guidance.

## Final Step 6 gate

Step 6 can be marked PASS only after:
1. PR is merged into `main`.
2. Main-site build succeeds.
3. Production deploy succeeds.
4. Production Plain Act tools smoke succeeds on Desktop and Mobile.
5. Existing activation/performance smoke remains green.
6. Google Drive remediation tracker is updated to PASS for rows 18–21.
