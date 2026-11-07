# Security Test Matrix

## Scope

This matrix extends the existing API security baseline to cover session control, data protection, and evidence handling. It is intended for Plan 16 Phase 6 security work and related security acceptance criteria (requirement IDs still use the `REQ-xxx` three-digit format).

## Coverage matrix

| Area | ASVS anchor | Scenario | Expected control | Evidence to verify |
|---|---|---|---|---|
| Session lifecycle | V2.1 | logout invalidates active token; refresh token reused | `401` or `403` after logout, no mutation allowed | response status, following `GET` state read |
| Cookie policy | V2.2 | cookie set without `Secure`/`HttpOnly`/`SameSite` | cookie rejected or hardened | response headers and browser storage inspection |
| CSRF protection | V2.2 | cross-site form or API request with valid session cookie | blocked unless explicit same-site policy allows it | `Origin`/`Referer` checks and mutation refusal |
| CORS policy | V2.2 | attacker origin sends credentialed request | blocked by allowlist or policy engine | response header set and actual browser behavior |
| Cache safety | V2.2 | authenticated response stored in shared cache | `Cache-Control: no-store` or equivalent | response headers and direct browser cache checks |
| Tenant isolation | V4.1 | user A accesses user B resource | `403`/`404`; no side effect on user B state | follow-up read and persisted state verification |
| Upload & download | V5.1 | malicious file or unsafe archive | block or sanitize before persistence | file metadata, MIME result, download path validation |
| Secret redaction | V8.1 | auth header, query token, cookie, OTP, or password in logs/screenshots | secret replaced with `[REDACTED]` | artifact content, manifest, and export bundle scan |
| Audit trail | V10.1 | privileged action with sensitive data | actor + decision + timestamp preserved; secret values absent | audit log and export payload |

## Attack scenarios by control

### Session and token controls

- Attempt access with missing/expired token.
- Reuse refresh token after logout.
- Force login/session rotation while another tab is active.
- Trigger logout and then continue issuing write calls with stale token.

### Authorization and tenant boundaries

- Cross-tenant read on a record ID not owned by current user.
- Unauthorized mutation on nested child object or export endpoint.
- Read-after-reject verification to confirm zero partial mutation.

### Data and evidence export protection

- Query string contains `token`, `session`, `apiKey`, or `otp` canaries.
- JSON payload contains a secret field, JWT, or cookie value.
- Screenshot or DOM export contains redaction-sensitive strings.
- Downloaded bundle is marked `RESTRICTED` unless sanitized and verified.

## Minimum test expectation

Every security scenario should produce all of the following evidence:

- request precondition
- action attempted
- observed response status/headers
- persisted state result
- artifact or export result
- if blocked, the exact denial signal and zero side effect proof

## Risk classification

| Severity | Typical trigger |
|---|---|
| Critical | token reuse, cross-tenant mutation, secret exports |
| High | CSRF/CORS bypass, cache leakage, unsigned download |
| Medium | weak timeout handling, incomplete audit logging |
| Low | noisy error message or inconsistent policy documentation |

## Implementation notes

- Use synthetic users and synthetic payloads only.
- Validate both response payloads and database state.
- For evidence artifacts, scan query strings, bodies, console outputs, DOM, screenshots, and export bundles.
- If a control is not applicable, document the reason and keep the check explicit rather than silent.
