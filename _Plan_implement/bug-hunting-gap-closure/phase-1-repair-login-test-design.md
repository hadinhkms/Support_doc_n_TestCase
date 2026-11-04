# Phase 1 — Repair REQ-001 Test Design

> **Status:** IMPLEMENTED — static gates pass; not executed against a target app
> **Depends on:** Phase 0 · **Blocks:** Phase 2
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Align the login requirement, test cases, automation plan, and Playwright assertions so
each case can reach and prove its intended behavior.

## Scope and target files

- `requirements/REQ-001-sign-in.md`
- `test-cases/REQ-001-sign-in.md`
- `test-cases/REQ-001-sign-in.automation-plan.md`
- `playwright/tests/auth/login.spec.ts`
- `playwright/tests/a11y/login.a11y.spec.ts` only if accessibility coverage is affected

## Tasks

1. Resolve the AC-003 and AC-010/TC-019 mismatch: a malformed XSS payload in the email
   field may be rejected before reaching the asserted error sink. Use an owner-confirmed
   reachable flow and the correct sink, or revise the requirement and test.
2. Review TC-012 and TC-015 for overlapping password-length cases. Keep one canonical
   boundary case per behavior and cover relevant required/empty/whitespace cases.
3. Confirm the 254/255 email expectation in TC-014 against the product contract.
4. Verify the negative tests assert both the expected validation/error and absence of
   unintended mutation/session effects where required.
5. Keep stable REQ/AC/TC IDs, priority tags, capabilities, and generated traceability aligned.

## Exit gate

- Each test's input reaches the intended validation or rendering path.
- Expected outcomes are supported by an approved requirement or decision.
- Requirement, TC, automation plan, and spec describe the same behavior.
- `qa:matrix` is current; `qa:drift` and `qa:gaps` have no relevant findings.
- Playwright verification and strict file-size limits pass.

## Implementation (2026-11-04)

REQ-001 is now v1.2. IDs stay stable; TC-015 is retired and not reused.

| Task | Change | Files |
|---|---|---|
| 1 XSS reachability | TC-019 uses the `Email` validation error as its sink (AC-003); no reflection is asserted because AC-010 only forbids execution; added an assertion that no `POST /api/auth/login` is sent. A server-reflected sink stays open as Q-006. | spec, TC, REQ coverage notes |
| 2 Password overlap | TC-015 removed (same steps/expectation as TC-012). TC-012 = length 7/8/64/65; new TC-020 = empty (required) password from the rules table. Whitespace-only is open (Q-008). | REQ rules, TC, automation plan |
| 3 Email 254/255 | Confirmed against REQ-001 `Rules and validation`; TC-014 data is now built from a 64-char local-part and ≤ 63-char domain labels so only total length varies. | TC |
| 4 Negative side effects | TC-002/TC-003 assert no new session cookie (AC-002); TC-003 also asserts it stays on `/login`. `LoginPage.sessionCookieNames()` uses the TC-013 naming rule. | spec, `login.page.ts` |
| 5 Alignment | Automation plan points at v1.2, adds TC-014, TC-016..TC-020 rows, and records the `email-error` assumption as Q-009. `qa:matrix` regenerated. | automation plan, `traceability.md` |

### Review fixes (2026-11-04)

- `LoginPage.sessionCookieNames()` now ignores CSRF cookies (`csrf`/`xsrf` in the name). The
  TC-013 pattern `/session|sid|token/i` also matches `csrftoken`/`XSRF-TOKEN`, which apps may set
  or rotate on a failed POST, so TC-002/TC-003 could have failed without any session being created.

### Verification

| Check | Result |
|---|---|
| `playwright: npm run verify` | Exit 0 — typecheck, lint, limits, 53 tests listed |
| `npm run qa:matrix` | Regenerated; TC-015 gone, TC-020 Candidate |
| `npm run qa:check` | Exit 0 — boundary, drift, gaps, limits all clean |
| `node --test "tools/**/*.test.js"` | 271/271 pass |
| Run TC-002, TC-003, TC-019 against the app | **Not run** — no target environment (`playwright/.env` absent, D-05) |

### Exit gate

- [ ] Each test's input reaches the intended path — by design; needs one run on the target app.
  The run also confirms Q-009 (`email-error` test id).
- [x] Expected outcomes are backed by REQ-001 rules/ACs; assumptions are marked (Q-006, Q-009).
- [x] Requirement, TC, automation plan, and spec describe the same behavior.
- [x] `qa:matrix` is current; `qa:drift` and `qa:gaps` have no findings.
- [x] Playwright verification and strict limits pass.
