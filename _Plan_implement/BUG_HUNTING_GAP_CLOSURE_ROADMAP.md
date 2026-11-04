# Bug-Hunting Gap Closure Roadmap

> **Plan status:** COMPLETE as a scoped execution plan; implementation and acceptance remain partial.
> **Review status (2026-11-04):** Current checkout is `main`; Phase 4 deliverables are present.
> Target-application runs, owner decisions, and a real GitHub Actions run remain outstanding.
> No application bug is confirmed.
> **Scope:** Close demonstrated gaps without duplicating [Plan 16](./plan-16-testing-professionalization/plan-overview.md).
> **Baseline:** Refreshed against the current `main` checkout on 2026-11-04 in
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

- Refreshed baseline (2026-11-04): one requirement, 10 ACs, 20 TCs, 15 automated tests;
  automation is 9/10 ACs (90%). `qa:gaps` and `qa:drift` are clean. This is sample
  traceability, not product-wide coverage.
- `REQ-001` AC-003 blocks malformed email client-side. Current TC-019 checks the validation
  sink and absence of a login POST, but does not prove that a user-controlled value reaches an
  application sink or that reflected content is escaped; AC-010 coverage remains unresolved.
- Lockout TC-009 is manual; boundary candidates include potentially overlapping password cases.
- API guards, deep-logic helpers, mutation/property harnesses, and test-health reporting exist.
  Their presence alone does not prove application behavior is covered.
- Plan 16 already covers evidence/reproduction, security, test quality, and flaky rollout.
  These phases verify and apply that work; they do not reimplement it.

## Phase map

| Phase | Objective | Depends on | Current status |
|---|---|---|---|
| 0 — Baseline and decisions | Refresh evidence and record unresolved product rules. | — | Baseline refreshed; owner decisions and target environment pending |
| 1 — Repair REQ-001 design | Align the test design and accurately represent remaining coverage gaps. | 0 baseline | Static changes present; AC-010/XSS reachability and target execution remain open |
| 2 — Expand login coverage | Automate only confirmed login boundaries with safe test identities. | 0 decisions; 1 design | TC-014 automated; lockout, session expiry, and password boundaries remain manual/candidate; shared-identity risk unresolved |
| 3 — API/security coverage | Apply existing guards to confirmed application contracts. | 0 contract/environment | TC-021 present for AC-002; no target run; other API checks deferred |
| 4 — CI and flaky visibility | Improve PR impact selection and expose flaky/empty runs. | Plan 16 Phase 8 evidence | Local implementation and controlled fixtures recorded; real PR/Actions validation pending |
| 5 — Mutation pilot | Measure tests against eligible owned source. | Eligible source and confirmed invariants | Product-code pilot is N/A until product source/invariants are supplied; framework work is not claimed as product coverage |

```text
0 → 1 → 2
0 → 3 (only when contract/environment exist)
Plan 16 Phase 8 → 4
Eligible source + owner scope → 5 (otherwise N/A)
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

## Plan closure and release blockers

This plan is complete as a bounded work plan; that does not mean every phase has passed its
execution exit gate. Do not mark the roadmap implementation complete or sign it off while any
of these remain:

1. The owner resolves the AC-010 XSS sink/expected behavior and confirms the `email-error`
   locator, or explicitly accepts the documented coverage limitation.
2. A target environment is available and the applicable REQ-001 tests pass in three clean
   repetitions. Until then, results are static/local only.
3. Negative login probes use a dedicated identity and safe reset/isolation strategy; do not
   run repeat/retry probes against the shared viewer identity while lockout semantics are open.
4. Phase 4's current deep-engine run has two unresolved harness failures; triage and rerun
   before sign-off. Also exercise the real PR diff and GitHub Actions report-job behavior;
   local simulations do not satisfy these checks.
5. Phase 5 is explicitly recorded as N/A for product mutation testing until owned product
   source and approved invariants exist. Do not duplicate Plan 16's framework mutation work.

## Out of scope

- Adding AI visual/agentic frameworks without a concrete uncovered scenario.
- Rewriting infrastructure delivered by Plans 14–16.
- Claiming product-wide coverage from the sample requirement.
- Reporting an application bug without reproducibility and dual evidence.
