# Phase 3 — API and Security Coverage

> **Status:** PROPOSED · **Depends on:** Phase 0; confirmed API contract and target required
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Apply existing API/security guards to real, authorized product contracts and verify
downstream state, not just response status.

## Reuse and scope

- Reuse `playwright/tests/support/api-guards.ts` and `playwright/tests/api/api-client.ts`.
- Candidate checks: role/resource access, sensitive response fields, mass assignment,
  idempotent concurrent mutation, and unchanged persisted state after denial.
- Do not add guessed routes, statuses, roles, or response schemas.

## Tasks

1. Inventory the actual API contract, roles, test identities, and safe test environment.
2. Map each applicable rule to an approved REQ/AC/TC or an authoritative API contract.
3. Add positive controls and denied-action cases; verify persisted state/side effects.
4. Use synthetic data and ensure cleanup is idempotent and safe under parallel execution.
5. Keep application security probes separate from helper self-tests and label their scope.

## Exit gate

- Every assertion has a contract-backed expected result.
- Positive control passes and unauthorized mutation is rejected without changing state.
- No sensitive data appears in logs or artifacts.
- Traceability and required QA gates pass.
- If no application contract/target exists, defer this phase; helper-only results do not
  count as product security coverage.
