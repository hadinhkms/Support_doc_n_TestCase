# UI review integration verification - 2026-10-29

Scope: UI/UX skill integration, Quick/Full review policy, helper examples, fault-injection
runtime behavior, and repository quality gates. This is a local engineering audit;
it does not certify the entire repository, an application release, or AI quota savings.

Base commit: `d7f7f9c2ab1f640be5a30283a6ab8232bced8e95` plus the working files identified below.
Changes were not committed or pushed by this audit.

## Findings fixed

1. Canonical rules, qa-logic-gaps helper mapping, and shared heuristics showed obsolete
   helper argument shapes. Aligned examples with current exports for text overflow,
   occlusion, interactive a11y, idempotency, XSS, persistence, and boundary rejection.
2. The initial Deep Engine run failed 1/24 tests: a deliberate POST 500 was still
   unexpected because a Playwright glob was passed to a substring allow-rule matcher.
   The helper also left a persistent allowance that could hide later faults when its
   pattern did match. Replaced that allowance with acknowledgment of one observed
   injected record, matched by request URL, method, source, and expected HTTP status.
3. Network abort generates an additional Chromium browser diagnostic. Acknowledge
   only one exact diagnostic paired with the observed injected abort, keeping other
   errors and subsequent requests monitored.
4. Added three regression scenarios (500, 503, abort), using glob and RegExp routes,
   checking preserved data and restored submit state, and proving a subsequent 500
   on the same endpoint remains unexpected and makes assertClean fail.
5. Added self-contained Deep Engine execution to the CI quality job and failure
   evidence upload. Application E2E continues to depend on that job.
6. Clarified focused axe/keyboard testing and per-record fault acknowledgment in the
   UI review skill; geometry helper success alone is not accessibility conformance.

## Verification

| Check | Local result |
| --- | --- |
| `npm test` | 259 passed; 0 failed, skipped, or todo |
| `npm run verify` in playwright | typecheck + lint passed; 53 tests listed, not executed |
| `npm run test:deep-engine -- --workers=2` | 27 passed in Chromium |
| `npx playwright test -c deep-engine.config.ts resilience-regression.spec.ts --workers=2 --repeat-each=3` | 9 passed; each of 3 cases ran 3 times |
| `npm run qa:matrix` | regenerated; no content change |
| `npm run qa:check` | boundary, drift, and gaps passed |
| skill quick_validate.py | valid |
| local skill links + workflow YAML inspection | passed; helper runtime command present |
| `git diff --check` | passed |

These results apply to the local source snapshot below. CI configuration was inspected
locally; no hosted CI execution is claimed. Regression fixtures are synthetic harnesses,
not evidence about a deployed application's UI.

## Outstanding verification and maintenance

- Application E2E was not run: BASE_URL, TEST_USER_EMAIL, and TEST_USER_PASSWORD are
  absent from the current shell and playwright/.env. No credentials were printed.
- Physical-device keyboard, safe-area, and input-zoom behavior remains unverified.
- Quick/Full routing and context-budget rules have been reviewed as instructions;
  no independent model behavior evaluation or measured quota reduction is claimed.
- Shared rules and skills are ship-owned. Their upstream Hub reconciliation remains
  necessary before a future sync; this audit did not modify the Hub.
- New or changed runtime helpers require the usual environment-specific qualification.
  Local green gates do not establish unrestricted production readiness or a 10/10
  assessment of every module in the repository.

## Reviewed file identities

SHA-256 includes exact working-file bytes, including uncommitted changes. Any change
to these files or relevant dependencies invalidates the affected audit conclusions.

| File | SHA-256 |
| --- | --- |
| `.agents/skills/qa-ui-review/SKILL.md` | `da5e28d3a1ccff8121f4bd838268a21a1379916d66865d84eeee735692110e29` |
| `.agents/skills/qa-ui-review/references/ui-review-rubric.md` | `9f21438512c43e32185edb68bafa1cd12d47af388c028c75f90a34d31bbd336f` |
| `.agents/skills/qa-logic-gaps/SKILL.md` | `06a63c491e2326c3232101c0d2d13c32be89a6719aad308c2b906a6ce03661ec` |
| `.agents/skills/qa-logic-gaps/references/bug-hunting-heuristics.md` | `2b8993d547c9d772643ce1c4c306f4ffd526507a9010ab7bf2de2558914ef4e5` |
| `.github/copilot-instructions.md` | `1552ede0e63a1764c4cb0020b30d05a9aad00a8d0bae514c6153385f58d4091c` |
| `.github/workflows/playwright.yml` | `8e3a264ecf7f90d92e07573c355603e83c75dbfb3d657d6cc84cc95a57469ae9` |
| `playwright/tests/support/resilience-guards.ts` | `4eddcaa5870dd4f52e693e63b5c6a0467b170b0dc5b01edb6c8a25f8b26dc4c1` |
| `playwright/deep-engine-tests/resilience-regression.spec.ts` | `1de02ec5866cfb86357964b5511a8b80a83fa373793dd556e7d72b4e3c4fd495` |
