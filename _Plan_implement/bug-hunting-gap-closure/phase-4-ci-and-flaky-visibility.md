# Phase 4 — CI Selection and Flaky Visibility

> **Status:** IMPLEMENTED — flaky visibility, empty-selection gate, PR impact selection (owner-approved 2026-11-04)
> **Depends on:** Phase 0; reconcile with Plan 16 Phase 8
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Ensure PRs run risk-relevant tests and retry-pass/flaky outcomes remain visible, reusing
the current testing-health and rollout implementation.

## Tasks

1. Inspect Plan 16 Phase 8 implementation and current workflow/report behavior before edits.
2. Verify whether changed-file/REQ impact can add relevant tests alongside `@smoke`/`@p0`.
3. Verify first-attempt failure followed by retry pass is represented as flaky in
   machine-readable output and is not reported as a clean first-attempt pass.
4. Change CI only for a reproduced gap; preserve fast baseline coverage.
5. Validate PR, push, nightly, manual-dispatch, and no-impact/no-match branches using
   controlled fixtures. Record expected selection for each.
6. Enforce only thresholds and actions already approved by policy/owner.

## Exit gate

- A controlled flaky case is surfaced distinctly from a first-attempt pass.
- A representative changed requirement/spec selects related critical tests.
- Empty selection is explicit and cannot silently turn into a false-green run.
- Workflow checks pass without changing unrelated CI behavior.

## Inspection (task 1, 2026-11-04)

| What Plan 16 Phase 8 claims | What the repo actually does |
|---|---|
| T8.2 "automatically counts first-run pass, retry/flaky…" | `tools/qa/lib/testing-health.js` exists with unit tests, but **nothing calls it**: no CLI command, npm script or workflow step. Its input is hand-built entries, not Playwright results. |
| CI produces JUnit (`playwright.config.ts` reporter list) | The `e2e` job passes `--reporter=blob` on the CLI, which **overrides** the config, so `junit.xml` is never written. The `report` job merged to `html,github` only. CI had **no machine-readable result**; flaky was visible only in the HTML report. |
| `testing-health.js` flaky count | A retry-pass counts as `retriedPass` but adds to `flaky` only if the entry sets `flaky: true`, which is wrong against the policy's own definition (fail → pass on the same commit). Hub-owned; see proposal below. |

## Measured behaviour (tasks 3, 5) — Playwright 1.63, controlled fixtures

Fixtures: one clean test, one that fails on attempt 1 and passes on retry, one that always fails.
Encoded as `playwright/deep-engine-tests/run-health.spec.ts` (HM-15), 15/15 over `--repeat-each=3`.

| Scenario | Exit code | Before this phase | Now (`run-health.json`) |
|---|---|---|---|
| Clean + flaky, `--retries=1` | **0** | Green job; flaky only in HTML | `firstAttemptPass 1, flaky 1, flakyRatePercent 50` |
| Real failure | 1 | Red | `failed 1` (negative control) |
| `--grep` no match, unsharded | 1 | Red ("No tests found") | `empty: true` |
| `--grep` no match, `--shard=1/2` and `2/2` | **0 and 0** | **False green**: merge also 0 | `empty: true` → new CI step fails |
| Blob per shard → `merge-reports` | 0 | — | Flaky outcome kept across shards |

## Changes (task 4) — only for the two reproduced gaps

- `playwright/tests/support/run-health.ts` + `run-health-reporter.ts` (seed): summary from
  Playwright's own `TestCase.outcome()`; writes `test-results/run-health.json` and a job-summary
  table. It never changes the exit code.
- `.github/workflows/playwright.yml` (seed), `report` job only: merges with the new reporter,
  uploads `run-health` artifact, then **fails if no tests were executed**. HTML upload now runs on
  `!cancelled()` so evidence is kept when that step fails. PR/push/nightly/manual selection is
  unchanged.
- Thresholds (task 6): the policy's "suite flaky rate > 2% → stop adding tests" is shown as
  `flakyRatePercent` with a note; not enforced. "≥ 2 flaky in the last 10 runs" needs run history
  and is not implemented. No threshold was invented.

## Expected selection per trigger (task 5)

| Trigger | Projects | Grep | REQ-001 tests run (chromium list) | Empty selection |
|---|---|---|---|---|
| `pull_request` | chromium | `@smoke\|@p0` + `@REQ-xxx` of impacted REQs, minus `@wip` | No REQ impact: 2 of 15 (TC-001, TC-006). REQ-001 impact: 15 of 15 | Fails at "Fail if no tests were executed" |
| `push` main | chromium | none | 15 of 15 | same |
| `schedule` | chromium, firefox, webkit | none | 15 × 3 | same |
| `workflow_dispatch` | chromium | `inputs.grep` | depends on tag | same (a mistyped tag no longer goes green) |

## PR impact selection (task 2) — approved by the owner 2026-11-04

Gap reproduced: a PR that edited `login.spec.ts` ran only TC-001 and TC-006; the other 13 REQ-001
tests it touched first ran after merge. The owner approved widening the PR gate. It matches the
"Quick (PR / Diff-focused)" mode already described in
`.agents/skills/qa-system-testing/workflows/03-e2e-verification.md`.

- `tools/ci/pr-impact.js` (new, `own` in `sync-manifest.json`) reads changed paths and prints
  `@REQ-xxx\b|...`. Mapping: `requirements/`/`test-cases/` files named `REQ-xxx…`; changed specs
  by their `@REQ` tags; changed page/data/fixture/support modules by the specs that import them
  (so a shared helper such as `deep-guards.ts` selects every REQ that uses it). Paths it cannot
  map (README, `traceability.md`, deleted specs) add nothing.
- `e2e` checkout uses `fetch-depth: 2`; on PRs the step diffs the merge commit against its first
  parent (`HEAD^1`, the base) and appends the ids to the grep. Shard 1 writes the selection to the
  job summary. Push, nightly and manual runs are unchanged. `\b` keeps `@REQ-001` from matching
  `@REQ-0010`.
- Local simulation of the exact step (same `GREP` expansion, `--list`, chromium):

  | Changed files | Impact | Selected |
  |---|---|---|
  | `README.md` | none | TC-001, TC-006 (+ setup) — baseline unchanged |
  | `playwright/tests/pages/login.page.ts` | `@REQ-001\b` | all 15 REQ-001 tests |
  | This change set (all phases) | `@REQ-001\b` | all 15 REQ-001 tests |
  | `requirements/REQ-999-none.md` | `@REQ-999\b` | baseline only (no tests carry the tag) |

- Cost: a PR touching REQ-001 runs 16 tests instead of 3 on chromium, split over 2 shards.

### Review fixes (2026-11-04, independent review from a parallel session)

Both findings reproduced before fixing:

- **Only direct imports were followed (fail open).** `dashboard.page.ts`, `base.fixture.ts`,
  `runtime-trap.ts`, `evidence.fixture.ts`, `api-client.ts` and `evidence-collector.ts` selected no
  REQ, because specs reach them through `fixtures/test-fixtures.ts`. `pr-impact.js` now builds a
  reverse import graph over every `.ts` in `playwright/tests` (imports, multi-line imports and
  `export … from`) and walks it to the specs. All six now select `@REQ-001`; new unit cases cover
  fixture → page → spec and re-export chains (9 cases).
- **The diff step could fail open.** GitHub's default `bash -e` ignores a failing first stage of a
  pipe, so a failed `git diff` would have run smoke/p0 only. Shown locally: the old form continued
  with an empty impact (exit 0); the new form, `set -o pipefail` plus `git diff` in its own
  assignment, stops the step (exit 128).

## Hub proposals (`ship` files, not edited here)

0. `CLAUDE.md` "Gate PR chỉ chạy `@smoke|@p0` (trừ `@wip`)" → "Gate PR chạy `@smoke|@p0` cộng
   test của REQ mà PR đụng tới (`tools/ci/pr-impact.js`), trừ `@wip`". Owner-approved here; the
   file is Hub-owned, so the wording has to change at the Hub.

1. `tools/qa/lib/testing-health.js`: count `status: pass` with retries as `flaky` (policy
   definition), and add a reader for `run-health.json` so `qa:summary --json` reports real runs.
2. `docs/flaky-test-policy.md` step 1: point to the `run-health` artifact / job summary instead of
   only the HTML report's flaky tab.
3. Root `package.json` `npm test` (`node --test tools/`) fails on Node 22.3 locally; CI pins Node
   20 where it works. A runner that lists `tools/**/*.test.js` explicitly would work on both.

## Verification

| Check | Result |
|---|---|
| `run-health.spec.ts` (HM-15) `--repeat-each=3` | 15 passed |
| `playwright: npm run verify` | Exit 0 |
| Workflow YAML parse (`js-yaml`) | OK |
| `node --test "tools/**/*.test.js"` (incl. `tools/ci/pr-impact.test.js`, 9 cases) | 280/280 pass |
| `qa:drift`, `qa:gaps`, `qa:limits` (`--strict`); matrix freshness | Exit 0; fresh |
| `qa:boundary` | Local MAJOR: `.claude` unclassified — a git-excluded worktree folder from a parallel session, not part of this change and absent in CI checkouts |
| PR diff on a real GitHub merge commit (`fetch-depth: 2`, `HEAD^1`) | **Not run** — needs a real PR |
| Real GitHub Actions run of the new `report` steps | **Not run** — needs a push; local merge-reports path is covered by HM-15 |
| Full `npm run test:deep-engine -- --workers=2` (as CI `quality`) | 51 passed, **2 failed** — both in `evidence-security.spec.ts` (HM-11, TC-16-P6-1 `ATTEMPT_ID_MISMATCH`, TC-16-P6-2 `sessionStorage` SecurityError). **Pre-existing:** the same 2 fail on clean `f94e424` with these changes stashed. Not caused by this phase. Fixed separately in `f462be4` on branch `claude/silly-knuth-1f43ce` (reported 9/9 with `--repeat-each=3`), not yet merged into this checkout. |

## Exit gate

- [x] A controlled flaky case is surfaced distinctly from a first-attempt pass.
- [x] A representative changed requirement/spec selects related critical tests (simulated
  locally; the first real PR still has to confirm the merge-commit diff).
- [x] Empty selection is explicit and cannot silently turn into a false-green run.
- [x] Workflow checks pass without changing unrelated CI behavior (push/nightly/manual selection untouched).
