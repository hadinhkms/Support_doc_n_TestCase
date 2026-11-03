# Async verification checklist

## Required invariants
- Every async message must carry a correlation ID and an idempotency key.
- Duplicate delivery must not create duplicate side effects.
- Out-of-order delivery must be handled deterministically by sequence number or timestamp semantics.
- Retry exhaustion must land in DLQ or quarantine with a clear trace.
- The final state must converge without over-polling or arbitrary sleep loops.

## Evidence to capture
- event payload before processing
- correlation timeline with sequence and retry count
- final state after replay or recovery
- dead-letter reason and quarantine record

## Red flags
- same message accepted twice with different identifiers
- queue workers processing without ordering guarantees
- missing correlation data in logs or audit trail
- retries continue indefinitely with no bounded deadline
- success returned before the downstream read model reflects the mutation
