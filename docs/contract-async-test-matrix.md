# Contract + async integrity test matrix

## Coverage summary
| Area | Risk | Required check | Outcome |
|---|---|---|---|
| Schema contract | Drift and silent breakage | required, enum, nested array validation | must fail closed |
| Idempotency | Duplicate side effect | event dedupe by idempotency key | single application |
| Ordering | Replayed or out-of-order events | sequence/correlation validation | stable state |
| Retry + DLQ | Stuck or poisoned messages | deadline and quarantine | visible, auditable |
| Convergence | stale read model | final state check within bounded deadline | pass/fail objective |

## Minimum acceptance expectations
- contract validation fails on missing or mismatched required fields
- duplicate events are rejected or merged without double-write
- out-of-order events do not mutate state if sequence is invalid
- retry exhaustion results in quarantined status and a traceable reason
- convergence is proven by final contract state, not by HTTP acknowledgement alone
