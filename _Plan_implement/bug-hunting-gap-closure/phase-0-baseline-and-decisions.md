# Phase 0 — Baseline and Decisions

> **Status:** PROPOSED · **Depends on:** None · **Blocks:** Phases 1–5
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
