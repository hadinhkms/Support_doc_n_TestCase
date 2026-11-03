# Phase 1 — Repair REQ-001 Test Design

> **Status:** PROPOSED · **Depends on:** Phase 0 · **Blocks:** Phase 2
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
