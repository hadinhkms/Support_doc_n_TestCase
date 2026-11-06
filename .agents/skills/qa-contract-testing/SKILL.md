---
name: qa-contract-testing
description: >-
  Use when designing, reviewing, or executing service-to-service contract tests for
  asynchronous producers and consumers, including event/message schemas, schema
  evolution, ordering, retries, idempotency, dead-letter handling, replay, and
  eventual consistency. For HTTP endpoint contracts, API authorization, and
  APIRequestContext tests, use qa-api-testing.
---

# QA Contract Testing

## Purpose
Use this skill when a phase targets API contract compliance, schema evolution, async delivery guarantees, idempotency, and eventual consistency across producer/consumer boundaries.

## Scope and routing
- Use this skill for contracts crossing asynchronous producer/consumer boundaries:
  messages/events, compatibility across versions, delivery/retry behavior, ordering,
  replay, dead-letter handling, and read-model convergence.
- Use [qa-api-testing](../qa-api-testing/SKILL.md) for HTTP endpoint behavior,
  request/response schemas, API authentication/authorization, and Playwright
  `APIRequestContext` automation. An HTTP API may be part of an async flow; use both
  skills only when both boundaries are in scope.
- Use [qa-system-testing](../qa-system-testing/SKILL.md) when the task is broader
  requirement review, test-matrix design, or cross-portal E2E verification.

## Core principles
- Validate the contract before trusting the UI.
- Treat schema drift, retry storms, and duplicate events as first-class defects.
- Require explicit correlation IDs, ordering rules, and dead-letter handling before a flow is marked healthy.
- Keep every pass/fail tied to specific contract fields, retries, and deterministic invariants.

## Minimum required checks
1. Schema validation
   - required fields
   - enums and nullable rules
   - nested object arrays
   - backward-compatible changes only when accepted by the pinned contract
2. Async invariants
   - idempotency key present and stable
   - duplicate/reordered event detection
   - bounded retries and DLQ/quarantine flow
   - correlation timeline available for replay
3. Data integrity
   - no double side effect after retries
   - read model/cache/index converges within deadline
   - stale item is flagged, not silently accepted

## Execution pattern
- Freeze the contract version and expected example payload.
- Run a healthy control before injecting faults.
- Inject duplicate, reordered, and stale scenarios one at a time.
- Assert the final system state, not only the HTTP status.
- Save evidence: payload, expected vs actual, timeline, and the rejection or DLQ decision.
- Inject faults only in an authorized test environment; if the environment or contract
  ownership is unclear, record the limitation instead of modifying shared systems.

## Workspace integration
- Before editing `requirements/`, `test-cases/`, or `playwright/tests/`, use the
  target repository root and read its `AGENTS.md` and `.github/copilot-instructions.md`.
- For an existing requirement, run `npm run qa:impact -- <REQ-id>` and
  `npm run qa:gaps` from the target repository root before changing test artifacts.
- When writing Playwright tests, follow that repository's traceability, fixture,
  capability-guard, size-limit, and test-data conventions. Do not assume this
  repository's helpers or paths exist in an external project; inspect its actual
  exports and scripts first.
- After editing a Playwright spec, run `npm run verify` from its Playwright project.
  For test-case/traceability edits, run the target repository's matrix and QA checks
  when available, and report unavailable tools explicitly.

## Output expectation
Provide:
- required contract fields and invalid-case evidence
- idempotency/out-of-order results
- replayability and deadline checks
- recommendation whether the contract is valid, requires a compatibility review, or is blocked by missing topology ownership
- scope, environment, commands, and any unverified conditions
