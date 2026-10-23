# Deep API Testing Checklist & Attack Matrix

> **Ownership**: `ship` (Hub-owned shared reference for `.agents/skills/qa-api-testing`).  
> Use this checklist when designing Acceptance Criteria (`AC-xxx`), `Rules and validation` tables in `requirements/`, and Test Cases (`TC-xxx`) in `test-cases/`.

---

## 1. HTTP Method & Status Code Semantics Matrix

Every API endpoint must be evaluated against both positive and negative HTTP semantics:

| HTTP Method | Positive Status | Mandatory Negative / Edge Scenarios to Test |
|---|---|---|
| `GET` | `200 OK` | `401` (no/bad token), `403` (BOLA/BFLA), `404` (non-existent/deleted ID, malformed ID), `400/422` (invalid query/pagination params) |
| `POST` | `201 Created` (or `200`/`202`) | `400/422` (missing required field, BVA violation, invalid type, malformed JSON), `401`, `403` (Mass Assignment / BFLA), `409 Conflict` (duplicate unique key / double submit), `415` (wrong `Content-Type`) |
| `PUT` | `200 OK` / `204 No Content` | Idempotency (calling twice with same payload yields identical state), `400/422` (partial payload on full-replace `PUT`), `403` (BOLA), `404` (non-existent ID), `409` (ETag / optimistic lock `If-Match` mismatch) |
| `PATCH` | `200 OK` | Partial update only mutates specified fields and preserves unspecified fields; read-only fields (`id`, `createdAt`, `role`) rejected or ignored; `400/422` on invalid field value; `403` (BOLA); `404` |
| `DELETE` | `200 OK` / `204 No Content` | Subsequent `GET` returns `404`; calling `DELETE` a second time returns `404` or `204` deterministically (never `500`); `403` (BOLA); referential integrity (`409` if resource is locked/in-use) |

---

## 2. OWASP API Security Top 10 (2023) Test Scenarios

Map relevant security scenarios to `Type: Security` and tag `@security` in `test-cases/REQ-xxx-*.md`:

| OWASP Code | Vulnerability | Concrete Test Case Design | Expected API Behavior |
|---|---|---|---|
| **API1:2023** | **Broken Object Level Authorization (BOLA / IDOR)** | User A (valid token) requests `GET`, `PUT`, `PATCH`, `DELETE` on `/api/resources/{userB_resource_id}` (including UUIDs, sequential IDs, or nested child IDs `/orders/{B}/items/{item}`). | Return `403 Forbidden` or `404 Not Found`. Follow-up `GET` as User B confirms User B's resource is unmodified. |
| **API2:2023** | **Broken Authentication** | 1. No `Authorization` header.<br>2. Malformed header (`Bearer `, `Basic xxx`).<br>3. Expired JWT or tampered JWT payload.<br>4. Reuse token after `POST /logout` or password reset.<br>5. Credential stuffing / brute-force lockout (`DH-04`). | Return `401 Unauthorized` (or `429` on lockout). Generic error message on login failure (no account enumeration). |
| **API3:2023** | **Broken Object Property Level Authorization (BOPLA / Mass Assignment & Excessive Data Exposure)** | 1. **Mass Assignment**: Send `{"role": "admin", "isVerified": true, "balance": 99999, "tenantId": "other"}` in `POST`/`PATCH`/`PUT` user/profile/order.<br>2. **Excessive Data Exposure**: Inspect `GET` response JSON for sensitive internal properties (`password`, `passwordHash`, `salt`, `secret`, `ssn`, internal audit fields). | 1. Reject with `400/422` or strip privileged fields; Read-After-Write `GET` proves privileged fields did not change.<br>2. Sensitive fields must be absent from raw JSON response. |
| **API4:2023** | **Unrestricted Resource Consumption** | 1. Request `?limit=999999` or `?pageSize=100000`.<br>2. Send oversized payload string (`1MB+` or `UNICODE_OVERFLOW_PAYLOADS`).<br>3. Batch endpoint with 10,000 array items.<br>4. Burst requests exceeding rate limit. | Return `400`/`413`/`422`/`429` or enforce hard server-side pagination cap (e.g., `maxLimit <= 100`). Never hang or return `500`. |
| **API5:2023** | **Broken Function Level Authorization (BFLA)** | Authenticated `viewer` / `customer` invokes admin/staff endpoints (`POST /api/admin/...`, `DELETE /api/users/:id`, `POST /api/reports/export`). | Return `403 Forbidden` with zero side effects. |
| **API6:2023** | **Unrestricted Access to Sensitive Business Flows** | Automated rapid submission of scarce inventory checkout, coupon claim, referral bonus, or OTP trigger without rate/idempotency guard. | Enforce idempotency key, per-account concurrency lock (`409`), or rate limit (`429`). |
| **API7:2023** | **Server-Side Request Forgery (SSRF)** | For fields accepting URLs (webhooks, avatar URL, import URL), pass `http://127.0.0.1:8080`, `http://localhost`, `http://169.254.169.254/latest/meta-data/`, `file:///etc/passwd`. | Reject with `400/422` via strict URL allowlist/protocol/DNS validation. |
| **API8:2023** | **Security Misconfiguration & Error Leakage** | 1. Send malformed JSON `{"a": }` or invalid `Content-Type`.<br>2. Trigger `404`/`405`/`500` and inspect headers & body.<br>3. Check CORS (`Origin: https://evil.example.com`). | Standardized JSON error envelope (`code`, `message`). Never leak stack traces, SQL queries, file paths, or framework versions. `X-Content-Type-Options: nosniff` present. |

---

## 3. Deep Input Validation, EP/BVA & Fuzzing Payload Matrix

Use this matrix to populate the `## Rules and validation` table in `requirements/REQ-xxx-*.md`:

| Data Type | Valid Class (EP) | Invalid Types & Formats | Boundary Values (BVA) | Injection & Unicode Probes (`deep-guards.ts`) |
|---|---|---|---|---|
| **String (Required)** | Standard ASCII & UTF-8 (`"Nguyen Van A"`) | `null`, `undefined` (omitted key), `123`, `true`, `[]`, `{}`, `""` (empty), `"   "` (whitespace-only — `DH-03`) | `min - 1`, `min`, `max`, `max + 1` characters | `XSS_PAYLOADS`, `SQLI_EDGE_PAYLOADS`, `UNICODE_OVERFLOW_PAYLOADS` (`\u0000\u200B\uFEFF`, emoji `'👨‍👩‍👧‍👦'.repeat(20)`) |
| **Email / Identifier** | `"user@example.com"` | `"plainaddress"`, `"@missing-local.com"`, `"user@.com"`, `"user@domain..com"`, leading/trailing spaces | `254` chars (valid max), `255` chars (invalid) | `"admin'--@example.com"`, `"<script>@example.com"` |
| **Integer / Quantity** | `1`, `50` | `"abc"`, `"12abc"`, `null`, `[]`, `1.5` (float), `NaN`, `"Infinity"` | `min - 1`, `min` (e.g. `0` or `1`), `max`, `max + 1`, `-1`, `Number.MAX_SAFE_INTEGER + 1` | `"0; DROP TABLE"`, `999999999999999999999` |
| **Currency / Decimal** | `10.50`, `0.01` | Negative `-0.01`, >allowed decimal places (`10.999`), string `"$10.00"` | `0.00`, `0.01`, `maxAmount`, `maxAmount + 0.01` | Floating-point precision probe (`0.1 + 0.2`) |
| **Enum / Status** | `"ACTIVE"`, `"PENDING"` | `"UNKNOWN_VALUE"`, `"active"` (case sensitivity check), `""`, `0`, `null` | First/last enum item | `"ACTIVE' OR '1'='1"` |
| **Array / Batch List** | `[item1, item2]` | `null`, `{}`, `"not-an-array"`, `[null]`, duplicate items when unique required | `[]` (`0` items), `1` item (`min`), `maxItems`, `maxItems + 1` | Deeply nested arrays `[[[[...]]]]` |
| **UUID / Path ID** | Valid UUID v4 | `"123"`, `"not-a-uuid"`, `"00000000-0000-0000-0000-000000000000"` (non-existent) | - | Path traversal `"..%2F..%2Fadmin"`, SQLi `"' OR 1=1--"` |
| **Date / Timestamp** | ISO-8601 `"2026-10-23T10:00:00Z"` | `"2026-02-30"` (impossible date), `"2026-13-01"`, `"not-a-date"`, Unix number when ISO string required | `startDate > endDate`, `startDate == endDate`, past date when future required, leap year `2028-02-29` | Timezone offset edge cases (`+14:00`, `-12:00`) |

---

## 4. Concurrency, Race Conditions & Idempotency Scenarios

Backend bugs frequently hide when tests only send sequential requests. Include these scenarios for state-mutating or financial/inventory endpoints:

1. **Idempotency Key Replay (`POST` with `Idempotency-Key`)**:
   - Send `POST /api/orders` with `Idempotency-Key: <uuid-1>` and payload $P$ $\to$ `201 Created` (Order ID $X$).
   - Retry the exact same `POST /api/orders` with `Idempotency-Key: <uuid-1>` and payload $P$ $\to$ returns same Order ID $X$ (status `200` or `201`), and `GET /api/orders` confirms only **1** order exists.
   - Send `POST /api/orders` with the same `Idempotency-Key: <uuid-1>` but **different** payload $P'$ $\to$ returns `409 Conflict` or `422 Unprocessable Entity`.

2. **Parallel Race Condition Probe (`Promise.all`)**:
   - **Scenario A (Single-Use Coupon / Voucher / OTP)**: Fire 5 simultaneous `POST /api/coupons/redeem` requests for a single-use code using `Promise.all`.
   - **Expected**: Exactly **1** response has status `200`/`201`, and **4** responses have status `409`/`400`/`422`. Never allow >1 success or any `500 Internal Server Error`.
   - **Scenario B (Balance / Inventory Deduction)**: Account has balance `100`. Fire 2 parallel withdrawals of `80` via `Promise.all`.
   - **Expected**: Exactly **1** withdrawal succeeds (remaining balance `20`), and **1** fails with insufficient funds (`400`/`409`/`422`). Balance must never become `-60` or `20` after two successes.

3. **State Machine Transition Integrity**:
   - Attempt illegal state transitions via API even if UI hides the button:
     - `PENDING -> COMPLETED -> CANCELLED` (attempting to cancel an already completed/shipped order $\to$ `409 Conflict` / `422`).
     - Acting on a soft-deleted or deactivated entity $\to$ `404` or `409`.
