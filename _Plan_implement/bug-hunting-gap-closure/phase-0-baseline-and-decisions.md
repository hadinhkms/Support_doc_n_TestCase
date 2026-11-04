# Phase 0 — Baseline and Decisions

> **Status:** PARTIAL — Phase 1 unblocked; Phase 2 waits on owner answers Q-003, Q-005
> **Depends on:** None · **Blocks:** Phases 1–5 · **Baseline revision:** `f94e424` (2026-11-04)
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Refresh the QA baseline and resolve the business decisions needed to write meaningful
assertions. Existing plan status is not a substitute for current evidence or owner approval.

## Tasks

1. Run `npm run qa:impact -- REQ-001`, `npm run qa:gaps`, `npm run qa:drift`,
   `npm run qa:summary`, and `npm run qa:coverage`.
2. Inspect current `decisions.json`, the REQ-001 artifacts, and relevant Plan 16 evidence.
3. Ask the requirement owner to confirm:
   - Lockout scope, attempt counting, reset conditions, and expiry behavior.
   - Whether and how session expiry is expected to work.
   - Which user-controlled value is reflected into which UI sink for XSS coverage.
   - Email/password boundary expectations where the product contract is not explicit.
4. Record unresolved items as open questions; do not add expected-result assertions for them.
5. Refresh the phase dependency/status table if current repository evidence materially differs.

## Deliverables

- Refreshed baseline results and links to current evidence.
- Explicit decision references or open questions for every unresolved behavior.
- Updated phase scope if a proposed target is unavailable or already covered.

## Exit gate

- Every behavior needed by Phases 1–2 has an authoritative expected result.
- Phase 3 has an API contract and target environment, or is explicitly deferred.
- Phase 5 has eligible owned source and invariants, or is explicitly N/A.
- No implementation is started for unresolved product behavior.

## Baseline results (2026-11-04, `f94e424`)

All commands exited `0`. No product environment was available: `playwright/.env` is absent
and `BASE_URL` falls back to `http://localhost:3000`, so no REQ-001 test was executed.

| Command | Result |
|---|---|
| `qa:impact -- REQ-001` | 10 AC, 19 TC; specs `tests/auth/login.spec.ts`, `tests/a11y/login.a11y.spec.ts` |
| `qa:gaps` | OK, no findings |
| `qa:drift` | OK, no findings |
| `qa:summary` | WARNING: 90% AC automated (9/10), 13 automated tests, 10 pending decisions (7 blocking) |
| `qa:coverage` | AC-007 has no automation (TC-009 manual); TC-010, TC-011 manual; TC-012, TC-014, TC-015 candidate |

`qa:gaps`/`qa:drift` being clean means traceability is consistent, not that behavior is covered.

## Findings

- **F-0.1 XSS sink unreachable (Phase 1).** `expectSafeXssRender`
  (`playwright/tests/support/deep-guards.ts:117`) requires the payload to be reflected in the sink.
  TC-019 (`login.spec.ts:201`) types payloads into `Email` and uses `role=alert` as the sink,
  but AC-003 blocks malformed email on the client, so the server error should never render.
  TC-019 can pass only if AC-003 is violated. Open question: Q-006.
- **F-0.2 Duplicate boundary cases (Phase 1).** TC-012 and TC-015 have identical steps and
  expectations (password 7/8/64/65). Open question: Q-008.
- **F-0.3 Dangling decision reference.** TC-009 cites `Q-003`, which REQ-001 never recorded.
  Now recorded as open Q-003 with the lockout scope questions.
- **F-0.4 Lockout may contradict AC-002.** If a non-existent email can be locked, the lockout
  message reveals account existence. Included in Q-003.
- **F-0.5 Session expiry has no AC.** The 24h rule exists only in `Rules and validation`; TC-010
  is mapped to AC-004 (reload). Open question: Q-005.
- **F-0.7 Over-asked boundaries (fixed 2026-11-04).** The first draft of Q-007/Q-008 re-asked the
  email 254/255 and password 7/8/64/65/empty boundaries, which REQ-001 `Rules and validation`
  already states. Narrowed to the unstated whitespace/message details; Phase 1 no longer waits on them.
- **F-0.6 `decisions.json` looks out of date for REQ-001.** D-05 (target URL) and D-06 (REQ-001 owner/status)
  are still `pending`, while REQ-001 now names an owner and status. Not changed here: the
  decision owner needs to confirm or close them via `npm run decisions`.

## Decision references and open questions

| Behavior | Needed by | Reference | State |
|---|---|---|---|
| Generic error message for wrong email/password | 1, 2 | Q-004 | Confirmed 2026-09-19 |
| Lockout scope, counting, reset, expiry, message | 2 | Q-003 | Open |
| Session expiry model and test hook | 2 | Q-005 | Open |
| XSS sink for TC-019 | 1 | AC-003 + AC-010; Q-006 for a server sink | Assumption recorded; server sink open |
| Email 254/255 boundary | 1, 2 | REQ-001 `Rules and validation` | Confirmed; whitespace open (Q-007) |
| Password 7/8/64/65/empty boundary | 1, 2 | REQ-001 `Rules and validation` | Confirmed; whitespace/message open (Q-008) |
| `email-error` test id | 1, 2 | Q-009 | Assumption |
| Target environment URL | 2, 3 | D-05 | Pending |

The questions are recorded in `requirements/REQ-001-sign-in.md` under `Open questions`.
No assertion was added or changed for any open item.

## Prerequisites for Phases 3 and 5

- **Phase 3 — deferred** (later narrowed: one contract-backed slice, TC-021, was possible). No API contract (OpenAPI/JSON schema) for `POST /api/auth/login`
  exists in the repo, and `API_BASE_URL`/`API_TOKEN` are not configured. Resume when the owner
  provides both.
- **Phase 5 — N/A (proposed).** The repo has no product source; the only mutable logic is the
  framework itself and the Plan 16 reference apps under `playwright/deep-engine-tests/`,
  already covered by Plan 16 Phase 5. The owner must confirm before the phase is closed.
- **Phase 4 — can start.** It depends only on Plan 16 Phase 8 evidence
  (`docs/testing-rollout.md`), which is in the repo.

## Exit gate status

- [x] Every behavior needed by Phase 1 has an authoritative expected result (rules table, AC-003, AC-010).
- [ ] Every behavior needed by Phase 2 has an authoritative expected result — waiting on Q-003, Q-005.
- [x] Phase 3 has an API contract and target environment, or is explicitly deferred — deferred.
- [ ] Phase 5 has eligible owned source and invariants, or is explicitly N/A — N/A proposed, needs owner confirmation.
- [x] No implementation is started for unresolved product behavior.
