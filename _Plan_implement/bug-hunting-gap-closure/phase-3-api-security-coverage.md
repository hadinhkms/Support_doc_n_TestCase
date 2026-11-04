# Phase 3 — API and Security Coverage

> **Status:** PARTIAL — contract-backed slice automated (TC-021); rest deferred, no API contract
> **Depends on:** Phase 0; confirmed API contract and target required
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

## Inventory (task 1, 2026-11-04)

| Item | Found | Consequence |
|---|---|---|
| API contract (OpenAPI/JSON schema) | None in the repo | No schema, status or field assertions possible |
| Product endpoints in REQ | Only `POST /api/auth/login` (REQ-001) | No resource/role API → BOLA/BFLA, mass assignment and API mutation idempotency have no target |
| Contract-backed API rule | AC-002 + Q-004: wrong password and unknown email must not be distinguishable | Testable by comparing two responses, without knowing their shape |
| `tests/api/api-client.ts` | Marked "contract mẫu", sample endpoints | Not used: calling it would mean guessing request bodies |
| Identities | `TEST_USER_*`, `TEST_VIEWER_*` (CI secrets) | Viewer used, to keep failed attempts off the setup account |
| Target environment | None (`playwright/.env` absent, D-05 pending) | Nothing executed |

## Implementation

- **TC-021** (`playwright/tests/auth/login.security.spec.ts`, `@p1 @security`, AC-002). It drives
  the real UI, captures the browser's own `POST /api/auth/login` responses for wrong-password and
  unknown-email, and asserts the same status (< 500), the same flattened field set, and equal values for every
  field that is stable across two unknown-email baselines (see review fix). Request and response shapes are not assumed.
- The spec is an application probe and is kept apart from the guard self-tests in
  `playwright/deep-engine-tests/` (task 5). It does not declare `api-security`, because that
  capability means BOLA/mass-assignment guards, which do not apply here.
- Cleanup: none needed. The test creates no data; its only side effect is one failed-attempt count
  on the viewer account (see Phase 2 shared-account risk).

## Deferred (needs owner input)

| Check | Missing |
|---|---|
| `expectApiSchemaContract` on login success/failure | Response schema and statuses |
| `expectBolaForbidden`, `expectMassAssignmentIgnored` | Resource endpoints, roles, ownership rules |
| `expectIdempotentApiMutation` | A mutating endpoint with an idempotency contract |
| Login response never echoes the submitted password | Owner approval (sound invariant, not in REQ-001) |
| Timing-based enumeration | Agreed threshold and a stable environment |

## Review fix (2026-11-04)

The first TC-021 compared only top-level JSON keys, so `{"error":{"code":"USER_NOT_FOUND"}}` vs
`{"error":{"code":"INVALID_PASSWORD"}}` would have passed — the most common enumeration leak.
It now flattens every nested field and compares values. To avoid false failures on request ids or
timestamps, it sends the unknown-email login twice and ignores only fields that differ between
those two (recorded as the `volatile-fields` annotation). The extra request uses a non-existent
email, so no real account gets closer to lockout (per-IP counting would still see it, Q-003).

**TC-021 runs only in the `chromium` project** (third review, 2026-11-04). With TC-002, it sent a
wrong viewer password in every project, which is 6 failures on a clean nightly and enough to lock
the viewer per AC-007. The probe checks HTTP responses, which don't depend on the browser, so one
project is enough. It skips by project name because `mobile-chrome` also reports browserName
`chromium`. See the Phase 2 shared-account section for the remaining counts.

A second review (2026-11-04) noted that if every field is volatile, for example a non-JSON body
carrying a nonce, nothing is left to compare and the test would pass vacuously. TC-021 now fails
with "no stable field to compare" in that case, instead of passing.

## Verification

| Check | Result |
|---|---|
| `playwright: npm run verify` | Exit 0 — TC-021 listed in all projects |
| `npm run qa:matrix` | TC-021 → `login.security.spec.ts:49` (Automated) |
| `npm run qa:check` | Exit 0 — no findings |
| Run on target | **Not run** — no target environment |

## Exit gate

- [x] Every assertion has a contract-backed expected result (AC-002, Q-004).
- [ ] Positive control passes and unauthorized mutation is rejected — N/A until a mutating,
  role-protected endpoint is in scope; deferred.
- [x] No sensitive data in logs/artifacts — failure output shows response fields only; the
  submitted password is never logged by the probe.
- [x] Traceability and required QA gates pass.
- [x] Missing contract parts are deferred; guard self-tests are not counted as product coverage.
