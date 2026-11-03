# Phase 4 — CI Selection and Flaky Visibility

> **Status:** PROPOSED · **Depends on:** Phase 0; reconcile with Plan 16 Phase 8
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Ensure PRs run risk-relevant tests and retry-pass/flaky outcomes remain visible, reusing
the current testing-health and rollout implementation.

## Tasks

1. Inspect Plan 16 Phase 8 implementation and current workflow/report behavior before edits.
2. Verify whether changed-file/REQ impact can add relevant tests alongside `@smoke`/`@p0`.
3. Verify first-attempt failure followed by retry pass is represented as flaky in
   machine-readable output and is not reported as a clean first-attempt pass.
4. Change CI only for a reproduced gap; preserve fast baseline coverage.
5. Validate PR, push, nightly, manual-dispatch, and no-impact/no-match branches using
   controlled fixtures. Record expected selection for each.
6. Enforce only thresholds and actions already approved by policy/owner.

## Exit gate

- A controlled flaky case is surfaced distinctly from a first-attempt pass.
- A representative changed requirement/spec selects related critical tests.
- Empty selection is explicit and cannot silently turn into a false-green run.
- Workflow checks pass without changing unrelated CI behavior.
