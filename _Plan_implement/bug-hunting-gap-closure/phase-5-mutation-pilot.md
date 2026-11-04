# Phase 5 — Mutation Pilot

> **Status:** N/A for product-code mutation testing — no owned product source or approved
> product invariants are available in this repository. Reopen only when prerequisites exist.
> **Depends on:** Phase 0; eligible owned source and confirmed invariants
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Measure whether tests detect meaningful logic changes in owned product code, not merely
whether the mutation harness can classify mutants.

## Scope decision

This repository contains the QA framework and sample requirements, not the application
implementation under test. The mutable reference applications and framework mutation work
belong to Plan 16; repeating that work here would duplicate existing scope and would not
establish product mutation coverage.

Therefore:

- Product-code mutation coverage is **not applicable yet**, not completed or passed.
- Do not run mutations against framework or reference-app code and report the result as
  product coverage.
- Do not introduce a score threshold or select a mutation tool for this phase without an
  eligible target and an approved survivor-triage policy.

## Reopen criteria

Reopen this phase only when the owner provides:

1. Owned application source that is in scope for this repository/session.
2. Stable, requirement-backed behavioral invariants for the selected source.
3. A passing unmutated baseline and a safe, deterministic test environment.
4. Approval for report-only scope, survivor/equivalent-mutant triage, and reporting.

## Deferred execution plan

Once reopened:

1. Identify eligible owned code and map each mutation target to its invariant and tests.
2. Run report-only first; classify survivors, equivalent mutants, invalid mutants, and
   timeouts separately.
3. Compare the existing mutation engine with a maintained tool for operator coverage,
   TypeScript support, runtime, configuration, and evidence/report quality before choosing.
4. Require at least one meaningful mutation to be killed by a behavioral assertion.
5. Set any score threshold only with an approved source, scope, and survivor-triage policy.

## Exit gate (when reopened)

- Unmutated baseline passes.
- At least one meaningful mutation is killed by a behavioral assertion.
- Survivors, equivalent mutants, invalid mutants, and timeouts are reported distinctly.
- Score scope and limitations are documented; no arbitrary threshold is used.
- If no suitable owned code or invariant is available, retain this phase as N/A/deferred.
