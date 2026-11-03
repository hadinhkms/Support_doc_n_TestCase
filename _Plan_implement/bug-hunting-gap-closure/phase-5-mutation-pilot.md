# Phase 5 — Mutation Pilot

> **Status:** PROPOSED · **Depends on:** Phase 0; owned source and confirmed invariants required
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Measure whether tests detect meaningful logic changes in owned product code, not merely
whether the mutation harness can classify mutants.

## Tasks

1. Identify eligible owned code with stable, requirement-backed invariants.
2. If only the QA framework is available, keep the pilot explicitly scoped to framework
   code; do not claim product mutation coverage.
3. Run report-only first. Review each survivor and equivalent mutant individually.
4. Compare the existing mutation engine with a maintained tool for operator coverage,
   TypeScript support, runtime, configuration, and evidence/report quality before choosing.
5. Set a score threshold only with an approved source, scope, and survivor-triage policy.

## Exit gate

- Unmutated baseline passes.
- At least one meaningful mutation is killed by a behavioral assertion.
- Survivors, equivalent mutants, invalid mutants, and timeouts are reported distinctly.
- Score scope and limitations are documented; no arbitrary threshold is used.
- If no suitable owned code or invariant is available, record N/A and defer.
