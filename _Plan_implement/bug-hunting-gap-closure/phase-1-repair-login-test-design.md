# Phase 1 — Repair REQ-001 Test Design

> **Status:** PARTIAL — design/code changes and static gates pass; AC-010 XSS reachability and target execution remain open
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
   field is rejected before any server-rendered error. Obtain owner confirmation of a
   reachable user-controlled sink and expected escaping behavior, or revise the requirement
   and test. Until then, do not count TC-019 as AC-010 rendering coverage.
2. Review TC-012 and TC-015 for overlapping password-length cases. Keep one canonical
   boundary case per behavior and cover relevant required/empty/whitespace cases.
3. Confirm the 254/255 email expectation in TC-014 against an authoritative product contract
   or owner decision; the REQ rules table alone is not independent confirmation.
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
| 1 XSS reachability | **Not resolved.** TC-019 uses the `Email` validation error as its sink, does not assert reflection, and verifies no login POST. This checks client-side rejection and unsafe nodes in the validation sink; it does not prove escaping of a reflected user value or satisfy AC-010 rendering coverage. Q-006 remains open. | spec, TC, REQ coverage notes |
| 2 Password overlap | TC-015 removed (same steps/expectation as TC-012). TC-012 = length 7/8/64/65; new TC-020 = empty (required) password from the rules table. Whitespace-only is open (Q-008). | REQ rules, TC, automation plan |
| 3 Email 254/255 | Requirement states the boundary; independent product/owner confirmation is **not available**. TC-014 data uses a 64-char local-part and ≤ 63-char domain labels so only total length varies. Treat expected behavior as requirement-backed, not product-verified. | TC |
| 4 Negative side effects | TC-002/TC-003 assert no new session cookie (AC-002); TC-003 also asserts it stays on `/login`. `LoginPage.sessionCookieNames()` uses the TC-013 naming rule. | spec, `login.page.ts` |
| 5 Alignment | Automation plan points at v1.2, adds TC-014, TC-016..TC-020 rows, and records the `email-error` assumption as Q-009. `qa:matrix` regenerated. | automation plan, `traceability.md` |

### Review fixes (2026-11-04)

- `LoginPage.sessionCookieNames()` now ignores CSRF cookies (`csrf`/`xsrf` in the name). The
  TC-013 pattern `/session|sid|token/i` also matches `csrftoken`/`XSRF-TOKEN`, which apps may set
  or rotate on a failed POST, so TC-002/TC-003 could have failed without any session being created.

### Verification

| Check | Result |
|---|---|
| `playwright: npm run verify` | Exit 0 — typecheck, lint, limits; 61 tests listed across configured projects |
| `npm run qa:matrix` | Regenerated; TC-015 gone, TC-020 Candidate |
| `npm run qa:check` | Exit 0 — boundary, drift, gaps, limits all clean |
| `node --test "tools/**/*.test.js"` | 271/271 pass |
| Run TC-002, TC-003, TC-019 against the app | **Not run** — no target environment (`playwright/.env` absent, D-05); negative probes also need safe identity isolation (Phase 2) |

### Exit gate

- [ ] Each test's input reaches the intended path — needs target execution; Q-009
  (`email-error` test id) and AC-010's reachable sink are unresolved.
- [ ] Expected outcomes are backed by an approved requirement or decision — specified
  boundaries are in REQ-001, but the TC-019/AC-010 link remains an unverified assumption.
- [x] Requirement, TC, automation plan, and spec describe the same behavior.
- [x] `qa:matrix` is current; `qa:drift` and `qa:gaps` have no findings.
- [x] Playwright verification and strict limits pass.

### Remaining closure actions

1. Ask the owner to resolve Q-006/Q-009 and record the decision; do not infer a server sink.
2. If a valid reflected sink is confirmed, update AC/TC/spec and traceability so the payload
   reaches that sink. Otherwise revise the AC/coverage claim and retain only the client-side
   rejection assertion that is actually proven.
3. Obtain product-owner evidence for TC-014's 254/255 expectation and a target environment.
4. Run the affected tests with safe, isolated identities and three clean repetitions; record
   artifacts and exact results. Until then this phase is statically verified, not accepted.
