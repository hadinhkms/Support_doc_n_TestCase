# Phase 0 — Baseline and Decisions

> **Status:** PARTIAL — baseline refreshed; owner decisions and target environment are outstanding
> **Depends on:** None · **Blocks:** behavior-dependent work in Phases 1–3; not Phase 4
> **Baseline revision:** current `main` checkout (2026-11-04)
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
5. Refresh the phase dependency/status table when repository evidence materially differs;
   distinguish local harness verification from application or hosted-CI verification.

## Deliverables

- Refreshed baseline results and links to current evidence.
- Explicit decision references or open questions for every unresolved behavior.
- Updated phase scope if a proposed target is unavailable or already covered.

## Exit gate

- Every behavior needed by Phases 1–2 has an authoritative expected result.
- Phase 3 has an API contract and target environment, or is explicitly deferred.
- Phase 5 has eligible owned source and invariants, or is explicitly N/A.
- No implementation is started for unresolved product behavior.

## Baseline results (2026-11-04, current checkout)

All commands exited `0`. No product environment was available: `playwright/.env` is absent
and `BASE_URL` falls back to `http://localhost:3000`, so no REQ-001 test was executed.

| Command | Result |
|---|---|
| `qa:impact -- REQ-001` | REQ-001 v1.2; 10 AC, 20 TC; 15 automated tests (TC-012/020 candidates; TC-009/010/011 manual) |
| `qa:gaps` | OK, no findings |
| `qa:drift` | OK, no findings |
| `qa:summary` | WARNING: 90% AC automated (9/10), 15 automated tests, 10 pending decisions (7 blocking), 0 static findings |
| `qa:coverage` | 1 requirement, 10 AC, 20 TC, 15 automated; AC-007 has no automation (TC-009 manual); TC-010/011 manual; TC-012/020 candidates |

`qa:gaps`/`qa:drift` being clean means traceability is consistent, not that behavior is covered.
The target remains unavailable (`playwright/.env` absent; default `BASE_URL` is localhost), so
no application behavior has been verified.

## Findings

- **F-0.1 AC-010 is not established by the current TC-019 path (Phase 1).** AC-003 rejects
  malformed email on the client. The current test checks that validation sink for unsafe nodes
  without requiring reflection and asserts that no login POST occurs. This can check client-side
  rejection, but does not demonstrate that a user-controlled value reaches an application sink
  or that a reflected value is escaped. Q-006 remains an owner decision; do not count this as
  verified XSS rendering coverage.
- **F-0.2 Duplicate boundary cases (Phase 1; fixed in v1.2).** TC-012 and TC-015 had identical
  steps and expectations (password 7/8/64/65). TC-015 is retired and TC-020 covers empty
  password; Q-008 remains open only for whitespace/message behavior.
- **F-0.3 Dangling decision reference.** TC-009 cites `Q-003`, which REQ-001 never recorded.
  Now recorded as open Q-003 with the lockout scope questions.
- **F-0.4 Lockout may contradict AC-002.** If a non-existent email can be locked, the lockout
  message reveals account existence. Included in Q-003.
- **F-0.5 Session expiry has no AC.** The 24h rule exists only in `Rules and validation`; TC-010
  is mapped to AC-004 (reload). Open question: Q-005.
- **F-0.7 Over-asked boundaries (fixed 2026-11-04).** The first draft of Q-007/Q-008 re-asked the
  email 254/255 and password 7/8/64/65/empty boundaries, which REQ-001 `Rules and validation`
  already states. Narrowed to the unstated whitespace/message details; Phase 1 no longer waits on them.
- **F-0.6 `decisions.json` needs owner reconciliation.** D-05 (target URL) and D-06
  (REQ-001 owner/status) were pending in the recorded baseline. Do not close them based on
  document text alone; the decision owner must confirm or close them via `npm run decisions`.

## Decision references and open questions

| Behavior | Needed by | Reference | State |
|---|---|---|---|
| Generic error message for wrong email/password | 1, 2 | Q-004 | Confirmed 2026-09-19 |
| Lockout scope, counting, reset, expiry, message | 2 | Q-003 | Open |
| Session expiry model and test hook | 2 | Q-005 | Open |
| XSS sink and expected behavior for AC-010 | 1 | AC-003 + AC-010; Q-006 | Open; current client-validation test does not prove reflected rendering |
| Email 254/255 boundary | 1, 2 | REQ-001 `Rules and validation` | Specified in requirement; independent product/owner confirmation and target execution unavailable; whitespace open (Q-007) |
| Password 7/8/64/65/empty boundary | 1, 2 | REQ-001 `Rules and validation` | Specified in requirement; independent product/owner confirmation and target execution unavailable; whitespace/message open (Q-008) |
| `email-error` test id | 1, 2 | Q-009 | Assumption |
| Target environment URL | 2, 3 | D-05 | Pending |

The questions are recorded in `requirements/REQ-001-sign-in.md` under `Open questions`.
No expected result is inferred for an open item. Requirement text is not treated as independent
proof that the sample product implements that behavior.

## Prerequisites for Phases 3 and 5

- **Phase 3 — bounded local slice only.** TC-021 compares AC-002 login responses, but no
  application API contract or target is available; it has not been run against the product.
  Defer schema, BOLA/BFLA, and mutation assertions until the owner supplies contract and
  environment details.
- **Phase 5 — N/A for product mutation testing at present.** This repository has no owned
  product implementation. Framework/reference-app mutation work belongs to Plan 16 and must
  not be represented as product mutation coverage. Reopen only when eligible source and
  invariants are supplied.
- **Phase 4 — independent of unresolved product decisions.** Local implementation can proceed
  against Plan 16 Phase 8 evidence (`docs/testing-rollout.md`); hosted workflow validation is
  still required.

## Exit gate status

- [ ] Every behavior needed by Phase 1 has an authoritative expected result — AC-010 sink and
  email-error locator remain unconfirmed; current TC-019 is not XSS-rendering proof.
- [ ] Every behavior needed by Phase 2 has an authoritative expected result — waiting on Q-003, Q-005.
- [x] Phase 3 has an API contract and target environment, or is explicitly deferred — remaining
  API scope is deferred; TC-021 is only a static/local test design.
- [x] Phase 5 has eligible owned source and invariants, or is explicitly N/A — N/A for product
  code, with reopening conditions documented.
- [x] No implementation is started for unresolved product behavior.
