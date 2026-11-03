# QA Contract Testing

## Purpose
Use this skill when a phase targets API contract compliance, schema evolution, async delivery guarantees, idempotency, and eventual consistency across producer/consumer boundaries.

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

## Output expectation
Provide:
- required contract fields and invalid-case evidence
- idempotency/out-of-order results
- replayability and deadline checks
- recommendation whether the contract is valid, requires a compatibility review, or is blocked by missing topology ownership
