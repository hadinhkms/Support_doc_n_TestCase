# Bug-Hunting Gap Closure Roadmap

> **Status:** PROPOSED — planning only; no application bug is confirmed.
> **Scope:** Close demonstrated gaps without duplicating [Plan 16](./plan-16-testing-professionalization/plan-overview.md).
> **Baseline:** Review on 2026-11-03; refreshed 2026-11-04 at `f94e424` in
> [Phase 0](./bug-hunting-gap-closure/phase-0-baseline-and-decisions.md).
> **Detailed phase files:** [`bug-hunting-gap-closure/`](./bug-hunting-gap-closure/)

## Goal and constraints

Increase the chance of finding real product defects by improving requirement clarity,
business-test coverage, API/security coverage, and feedback from CI. Reuse existing
infrastructure. Do not introduce a new framework or invent expected behavior.

This repository contains a QA framework and sample `REQ-001`, not the tested product.
Missing or failing tests are not evidence of an application bug. Any reported defect must
pass the workspace reproducibility and evidence gate.

## Baseline and reuse

- At review time, `qa:gaps` and `qa:drift` were clean; dashboard scope was one requirement,
  10 ACs, 19 TCs, and 13 automated tests. This is sample traceability, not product-wide coverage.
- `REQ-001` AC-003 blocks malformed email client-side, while AC-010/TC-019 expects an XSS
  payload entered as email to reach a rendered error sink.
- Lockout TC-009 is manual; boundary candidates include potentially overlapping password cases.
- API guards, deep-logic helpers, mutation/property harnesses, and test-health reporting exist.
  Their presence alone does not prove application behavior is covered.
- Plan 16 already covers evidence/reproduction, security, test quality, and flaky rollout.
  These phases verify and apply that work; they do not reimplement it.

## Phase map

| Phase | Objective | Depends on | Status |
|---|---|---|---|
| 0 — Baseline and decisions | Refresh evidence and confirm open product rules. | — | Partial (Phase 2 needs Q-003, Q-005) |
| 1 — Repair REQ-001 design | Resolve XSS reachability and boundary-case overlap. | 0 | Implemented (not run on target) |
| 2 — Expand login coverage | Automate confirmed lockout, session, and input boundaries. | 1 | Partial (TC-014 done; rest blocked) |
| 3 — API/security coverage | Apply existing guards to real, confirmed contracts. | 0; contract available | Partial (TC-021; rest deferred) |
| 4 — CI and flaky visibility | Verify Plan 16 rollout; close only measured gaps. | 0 | Implemented; PR impact selection awaits owner |
| 5 — Mutation pilot | Measure tests against eligible owned logic, if available. | 0; source and invariants available | N/A proposed |

```text
0 → 1 → 2
0 → 3
0 → 4
0 → 5
```

## Phase documents

1. [Phase 0 — Baseline and decisions](./bug-hunting-gap-closure/phase-0-baseline-and-decisions.md)
2. [Phase 1 — Repair REQ-001 test design](./bug-hunting-gap-closure/phase-1-repair-login-test-design.md)
3. [Phase 2 — Expand login risk coverage](./bug-hunting-gap-closure/phase-2-expand-login-coverage.md)
4. [Phase 3 — Apply API/security guards](./bug-hunting-gap-closure/phase-3-api-security-coverage.md)
5. [Phase 4 — CI selection and flaky visibility](./bug-hunting-gap-closure/phase-4-ci-and-flaky-visibility.md)
6. [Phase 5 — Mutation pilot](./bug-hunting-gap-closure/phase-5-mutation-pilot.md)

## Cross-phase verification

For requirement, test-case, or Playwright changes, run `qa:impact` and `qa:gaps` before edits;
after edits run Playwright `npm run verify`, then root `qa:matrix`, `qa:limits -- --strict`,
and `qa:check`. Execute focused tests against the target environment when available. Repeat
anomalous scenarios three times before classifying a product bug. Record evidence,
environment limitations, and checks not run.

For CI changes, validate PR, push, nightly, manual, and empty-impact behavior with controlled
fixtures. A helper-harness pass is not a substitute for testing the target application.

## Out of scope

- Adding AI visual/agentic frameworks without a concrete uncovered scenario.
- Rewriting infrastructure delivered by Plans 14–16.
- Claiming product-wide coverage from the sample requirement.
- Reporting an application bug without reproducibility and dual evidence.
