---
name: qa-api-testing
description: >-
  Use this skill when the user asks to design, write, review, or audit API tests
  (REST, GraphQL, HTTP endpoints, or hybrid API+UI flows), including deep API testing:
  contract/schema validation, OWASP API Top 10 security (BOLA/IDOR, BFLA, Mass Assignment),
  boundary/fuzzing payloads, idempotency, race conditions/concurrency, pagination, and
  Playwright APIRequestContext automation following workspace traceability rules.
---

# QA Deep API Testing Skill

> **Live Source + Built-in Fallback:** Nếu trên máy tồn tại `D:/_QA_Test_Automation/.agents/skills/qa-api-testing/`, ưu tiên đọc `SKILL.md` và `references/*` trực tiếp từ `D:/_QA_Test_Automation/.agents/skills/qa-api-testing/` để lấy bản mới nhất; nếu không có trên máy, sử dụng ngay bản tích hợp sẵn tại thư mục hiện tại.

This skill provides an end-to-end methodology for designing, automating, and auditing **Standard & Deep API Tests** across `requirements/`, `test-cases/`, and `playwright/tests/` using Playwright's `APIRequestContext` and `ApiClient`.

---

## Progressive Disclosure References

Load these reference guides when designing test cases or writing Playwright API specs:
- **[references/api-deep-testing-checklist.md](references/api-deep-testing-checklist.md)**: Deep API Test Matrix covering OWASP API Security Top 10, HTTP status & error contract semantics, EP/BVA & injection payloads, concurrency/race conditions, and pagination/filtering edge cases.
- **[references/playwright-api-patterns.md](references/playwright-api-patterns.md)**: Ready-to-use Playwright TypeScript templates (`APIRequestContext`, `ApiClient`, Read-After-Write, Read-After-Reject, BOLA/IDOR, Mass Assignment, Race Condition `Promise.all`, and Hybrid API+UI specs) that strictly pass `eslint` and `tools/qa`.

---

## Workflow

### Step 1: Impact Analysis & Requirement Metadata Setup

1. **Run Workspace Analyzers First**:
   ```bash
   npm run qa:impact -- <REQ-id>
   npm run qa:gaps
   ```
   Always read [AGENTS.md](../../../AGENTS.md) and `.github/copilot-instructions.md` (or fallback to `D:/_QA_Test_Automation/.github/copilot-instructions.md` when invoked from another project) before modifying `requirements/`, `test-cases/`, or `playwright/tests/`.

2. **Configure Canonical Metadata in `requirements/REQ-xxx-*.md`**:
   `tools/qa` enforces strict metadata rules (`missing-ui-coverage`, `missing-xss-coverage`). Configure the requirement header based on the API scope:
   - **Pure Backend / Headless API Requirement**:
     ```markdown
     - **Page exposure**: Public | Authenticated
     - **UI coverage**: Exempt (reason: Pure API contract without browser UI)
     - **XSS applicability**: Not applicable (reason: JSON API endpoint with Content-Type application/json and X-Content-Type-Options nosniff)
     ```
     *(Note: If the API returns HTML/SVG or its output is rendered into a UI sink covered by the same REQ, set `XSS applicability: Applicable` and include an `expectSafeXssRender` test).*
   - **Hybrid API + UI Requirement**:
     Keep `- **UI coverage**: Required` and pair backend API contract tests with UI geometry/XSS checks.

3. **Respect Capability Tag Rules in `test-cases/REQ-xxx-*.md`**:
   - In `tools/qa`, adding `- **Capabilities**: idempotency` (or tag `@idempotency`) to a TC triggers static rule `missing-idempotency-guard`, which requires calling `expectIdempotentSubmit(page, ...)` from `support/deep-guards.ts`.
   - Use `- **Capabilities**: idempotency` when testing UI-triggered API submission locking. For **pure API concurrency / `Idempotency-Key` header** tests without a DOM button, omit `- **Capabilities**: idempotency` (use tags `@api @p1 @security` instead) so static analysis does not demand a DOM button locator.

---

### Step 2: 8-Dimension Deep API Test Design (`requirements/` $\leftrightarrow$ `test-cases/`)

When authoring or auditing API Acceptance Criteria (`AC-xxx`), `Rules and validation`, and Test Cases (`TC-xxx`), evaluate all **8 Deep API Dimensions** (detailed in [references/api-deep-testing-checklist.md](references/api-deep-testing-checklist.md)):

1. **Contract, Schema & Header Integrity (`Functional`)**
   - Verify exact HTTP status code (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `415`, `422`, `429`), `Content-Type: application/json`, security headers (`X-Content-Type-Options: nosniff`, `Cache-Control`), and response body schema (types, required keys, enum domains, ISO-8601 dates, UUID formats, standardized error envelope `code`/`message` with zero stack-trace leakage).

2. **Authentication & Token Lifecycle (`Security` / `@security`)**
   - Missing token (`401`), malformed auth scheme (`Basic` instead of `Bearer`, empty Bearer), expired token, tampered JWT payload/signature, revoked session/token after logout, and refresh-token reuse detection.

3. **Authorization: BOLA/IDOR, BFLA & Mass Assignment (`Security` / `@security`)**
   - **BOLA / IDOR (OWASP API1)**: Authenticated User A accesses or mutates User B's resource ID (`GET`/`PUT`/`PATCH`/`DELETE /api/v1/items/:userBItemId`) $\to$ must return `403` or `404` with **zero mutation** to User B's data.
   - **BFLA (OWASP API5)**: Low-privilege role (`viewer`/`member`) invokes admin/privileged endpoints $\to$ `403 Forbidden`.
   - **Mass Assignment / BOPLA (OWASP API3)**: Inject privileged/read-only fields in request payload (`role: "admin"`, `isVerified: true`, `balance: 999999`, `tenantId`, `createdAt`) $\to$ verify field is rejected or ignored in persisted record.
   - **Data Over-Exposure**: Verify response JSON never leaks internal fields (`passwordHash`, `salt`, `resetToken`, internal flags).

4. **Field Validation, EP/BVA, Type Coercion & Injection (`Validation` / `Boundary` / `Security`)**
   - **Type & Structural Tampering**: Send number as string, string as number (`"abc"`), `null`, `[]`, `{}` in scalar fields, missing required fields, malformed JSON syntax, or wrong `Content-Type` (`text/plain`).
   - **String BVA**: Empty `""`, whitespace-only `"   "` (`DH-03`), leading/trailing spaces, `min - 1`, `min`, `max`, `max + 1`, and `UNICODE_OVERFLOW_PAYLOADS` (`\u0000\u200B\uFEFF`, emoji clusters, 1024+ chars).
   - **Numeric & Financial BVA**: `min - 1`, `min`, `max`, `max + 1`, `0`, negative numbers (`-1`), decimals on integer fields, `Number.MAX_SAFE_INTEGER + 1`.
   - **Injection Probes**: `SQLI_EDGE_PAYLOADS`, NoSQL operator injection (`{"$ne": null}`), path traversal, SSRF URLs, and `XSS_PAYLOADS` from `playwright/tests/support/deep-guards.ts`.

5. **State Persistence: Read-After-Write & Read-After-Reject (`persistence` / `Negative Side Effects`)**
   - **Read-After-Write**: After `POST`/`PUT`/`PATCH`/`DELETE`, execute a follow-up `GET` to prove the change actually persisted in the database (or returns `404` after `DELETE`).
   - **Read-After-Reject (`PA-04`)**: After a rejected mutation (`400`/`401`/`403`/`409`/`422`), execute a `GET` or state check to prove **no partial or unintended mutation** occurred.

6. **Idempotency, Concurrency & Race Conditions (`State & Concurrency`)**
   - **Idempotency**: Repeating `PUT` / `DELETE` or re-sending `POST` with the same `Idempotency-Key` header must not create duplicate records or return `500`.
   - **Concurrency / Race Probe**: Fire $N$ parallel requests via `Promise.all` (e.g., double coupon redemption, concurrent balance withdrawal, duplicate unique key creation) $\to$ assert exactly 1 succeeds and $N-1$ fail with `409 Conflict` / `422`, and final persisted state is mathematically exact.

7. **Pagination, Filtering, Sorting & Resource Limits (`Boundary` / OWASP API4)**
   - Boundary params: `page=0`, `page=-1`, `limit=0`, `limit=-1`, excessive `limit=10000` (must cap or reject with `400/422`), invalid sort field/direction, special URL characters (`%00`, `&`, `?`, `#`), and stable deterministic ordering across pages.

8. **Rate Limiting, Resilience & Performance Budget (`Resilience & Recovery`)**
   - Burst requests exceeding threshold $\to$ `429 Too Many Requests` with `Retry-After` header.
   - Upstream/downstream failure handling (no raw `500` stack trace) and response time SLA verification.

---

### Step 3: Playwright API Spec Implementation (`playwright/tests/`)

Follow the patterns in [references/playwright-api-patterns.md](references/playwright-api-patterns.md) and enforce these mandatory workspace rules:

1. **Imports & Fixtures**:
   - Always import `{ test, expect } from '../fixtures/test-fixtures'` (never from `@playwright/test`).
   - Use `{ request, api }` fixtures in test blocks (`request` is Playwright's `APIRequestContext`; `api` is `ApiClient` from `playwright/tests/api/api-client.ts`).
   - Read URLs and credentials exclusively via `env`, `requireEnv()`, or `optionalEnv()` from `playwright/tests/support/env.ts`.

2. **Traceability & ESLint Compliance (`playwright/eslint.config.mjs`)**:
   - `test.describe('REQ-xxx - <Feature>', { tag: '@REQ-xxx' }, () => { ... })`
   - Test title **must** start with `TC-xxx - AC-yyy <description>` and include priority tags (`@p0`..`@p3`, plus `@smoke`, `@api`, `@security` as appropriate).
   - No conditionals (`if`, `switch`, ternary) inside `test(...)` body (`playwright/no-conditional-in-test` is `error` in ESLint!). Put helper logic, cleanup tolerance (`status !== 404`), or request builders inside `ApiClient` (`playwright/tests/api/api-client.ts`) or support modules where test-body ESLint rules do not block helper control flow.

3. **Strong Assertions (No `weak-existence-assertion`)**:
   - `tools/qa` flags any test whose only assertions are `toBeDefined()` or `toBeTruthy()`.
   - Every API test must assert:
     1. Exact HTTP status (`expect(response.status()).toBe(201)`).
     2. Critical headers (`expect(response.headers()['content-type']).toContain('application/json')`).
     3. Concrete business fields (`expect(body).toMatchObject({ email: payload.email, role: 'viewer' })`, `expect(body.id).toMatch(/^[0-9a-f-]{36}$/i)`).
     4. Side-effect proof (Read-After-Write `GET` or Read-After-Reject `GET`).

4. **Parallel Isolation & Idempotent Teardown (`PA-03`)**:
   - Nightly CI runs with `fullyParallel: true` and sharding. Never share mutable entity IDs or accounts that lock/mutate across tests.
   - Generate unique test data per worker/test (`crypto.randomUUID()`, `Date.now()`) and clean up created resources in `try / finally` or `test.afterEach` using idempotent `api.delete*(id)` helpers.

---

### Step 4: Zero False-Positive Bug Confirmation & Quality Gates

1. **Zero False-Positive & Reproducibility Gate (When Hunting API Bugs)**:
   - **Never guess or report an API bug from a single accidental failure.** Before logging any `BUG-xx`:
     - **Rule Out Test Faults First**: Verify the failure is not caused by a test script bug (wrong endpoint path, stale token, polluted DB state from a previous run, missing `await`, or wrong Content-Type header in the test). If the test is wrong, fix the test and re-run — never report it as an application bug.
     - **Reproducibility Verification**: Re-run the isolated API call or Playwright spec (`npx playwright test <spec> --repeat-each=3`) to confirm the issue still occurs on re-check. Only report a **Confirmed Bug (`BUG-xx`)** when it reproduces consistently with identical HTTP status, response payload, and state mutation (or via a `Promise.all` race probe for concurrency bugs).
     - **Dual Proof**: Attach both the exact request/response telemetry (`method`, `url`, `payload`, `status`, `response body`, Read-After-Write/Reject check) and the backend source `file:line` root cause (when backend code is in scope).

After creating or updating requirements, test cases, or API specs, run the verification pipeline in order:

2. **Inside `playwright/`**:
   ```bash
   npm run verify
   ```
   *(Runs TypeScript `tsc --noEmit`, ESLint rules, and `playwright test --list`)*

3. **At repository root**:
   ```bash
   npm run qa:matrix
   npm run qa:check
   npm test
   ```
   *(Must result in 0 `blocker` and 0 `major` findings, clean Hub/Project boundary, and 100% passing unit tests).*
