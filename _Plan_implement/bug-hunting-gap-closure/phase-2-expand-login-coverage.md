# Phase 2 — Expand Login Risk Coverage

> **Status:** PROPOSED · **Depends on:** Phases 0 and 1
> **Parent:** [Bug-Hunting Gap Closure Roadmap](../BUG_HUNTING_GAP_CLOSURE_ROADMAP.md)

## Objective

Automate confirmed high-risk login cases without shared-account lockouts, hidden state,
or timing-dependent expectations.

## Candidate coverage

- Lockout attempt boundary and unlock/reset behavior (current TC-009).
- Confirmed email/password length and required-field boundaries (review TC-012/014/015).
- Session expiry only if the product rule and a deterministic test seam are available.
- Rejected submissions do not establish a session or mutate unrelated account state.

## Tasks

1. Use a dedicated lockout identity or isolated fixture, not the shared setup account.
2. Define an approved reset/seed path and deterministic time control or API seam.
3. Separate specs by validation/security concern when needed; obey the workspace file budget.
4. Make each test independent, rerunnable, safe under parallel workers, and traceable.
5. Run the focused spec in a clean state with `--repeat-each=3`; investigate any
   inconsistent outcome as possible test/environment noise before classifying it.

## Open prerequisites

- Owner-confirmed lockout/reset/expiry semantics from Phase 0.
- Test environment that can safely reset the dedicated account.
- A deterministic mechanism for time-dependent behavior; do not wait 15 minutes in CI.

## Exit gate

- Confirmed cases pass three clean repetitions with identical outcomes.
- No shared account or residual lockout state affects other tests.
- Error and side-effect assertions match the approved requirement.
- Traceability, Playwright verification, strict limits, and root QA checks pass.
- If a prerequisite is unavailable, document the uncovered risk and keep the case manual;
  do not weaken the expected result to force automation.
