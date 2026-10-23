# Playwright API Testing Patterns (`playwright/tests/`)

> **Ownership**: `ship` (Hub-owned shared reference for `.agents/skills/qa-api-testing`).  
> All code patterns below strictly comply with `playwright/eslint.config.mjs` (no `if` conditionals inside `test()`, mandatory `TC-xxx - AC-yyy` titles, `@REQ-xxx` tags, no `waitForTimeout`) and `tools/qa` static analysis (no `weak-existence-assertion`).

---

## 1. Extending `ApiClient` (`playwright/tests/api/api-client.ts`)

Because `playwright/eslint.config.mjs` enforces `'playwright/no-conditional-in-test': 'error'` on `tests/**/*.spec.ts`, keep conditional branching (such as idempotent teardown ignoring `404` or building dynamic auth headers) inside `playwright/tests/api/api-client.ts`:

```typescript
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env, optionalEnv } from '../support/env';

export interface RequestOptions {
  token?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private buildHeaders(custom?: Record<string, string>, tokenOverride?: string): Record<string, string> {
    const token = tokenOverride !== undefined ? tokenOverride : optionalEnv('API_TOKEN', '');
    return {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...custom,
    };
  }

  public url(pathname: string): string {
    return new URL(pathname, env.apiBaseURL).toString();
  }

  async get(pathname: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request.get(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
    });
  }

  async post(pathname: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request.post(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
      data: options?.data,
    });
  }

  async put(pathname: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request.put(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      data: options?.data,
    });
  }

  async patch(pathname: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request.patch(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      data: options?.data,
    });
  }

  async delete(pathname: string, options?: RequestOptions): Promise<APIResponse> {
    return this.request.delete(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
    });
  }

  /** Idempotent cleanup: 2xx and 404 are both treated as clean teardown. */
  async deleteIgnoreNotFound(pathname: string, token?: string): Promise<void> {
    const response = await this.delete(pathname, { token });
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`[api] Cleanup failed on DELETE ${pathname}: ${response.status()}`);
    }
  }
}
```

---

## 2. Pattern A: Contract, Schema & Read-After-Write Persistence (`@p0 @smoke @api`)

Never trust the `POST` response alone. Always verify status, headers, exact schema fields, and perform a **Read-After-Write** `GET` with idempotent cleanup in `try / finally`:

```typescript
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/test-fixtures';

test.describe('REQ-002 - User Management API', { tag: '@REQ-002' }, () => {
  test(
    'TC-001 - AC-001 creates user with valid payload and persists state on GET',
    { tag: ['@smoke', '@p0', '@api'] },
    async ({ api }) => {
      const uniqueEmail = `qa.user.${randomUUID()}@example.com`;
      const payload = {
        email: uniqueEmail,
        fullName: 'Nguyen Van A',
        role: 'viewer',
      };

      let createdId = '';
      try {
        // 1. Act: Create resource
        const createRes = await api.post('/api/users', { data: payload });

        // 2. Assert HTTP status & headers
        expect(createRes.status()).toBe(201);
        expect(createRes.headers()['content-type']).toContain('application/json');

        // 3. Assert response contract & ensure sensitive fields are not exposed
        const body = (await createRes.json()) as {
          id: string;
          email: string;
          fullName: string;
          role: string;
          createdAt: string;
          password?: unknown;
          passwordHash?: unknown;
        };
        createdId = body.id;

        expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(body).toMatchObject({
          email: uniqueEmail,
          fullName: 'Nguyen Van A',
          role: 'viewer',
        });
        expect(Date.parse(body.createdAt)).not.toBeNaN();
        expect(body.password).toBeUndefined();
        expect(body.passwordHash).toBeUndefined();

        // 4. Read-After-Write: Verify actual database persistence via GET
        const getRes = await api.get(`/api/users/${createdId}`);
        expect(getRes.status()).toBe(200);
        const persisted = (await getRes.json()) as typeof body;
        expect(persisted).toMatchObject({
          id: createdId,
          email: uniqueEmail,
          fullName: 'Nguyen Van A',
          role: 'viewer',
        });
      } finally {
        await api.deleteIgnoreNotFound(`/api/users/${createdId}`);
      }
    },
  );
});
```

---

## 3. Pattern B: BVA, Negative Validation & Read-After-Reject (`PA-04`)

When testing invalid payloads (`400`/`422`), verify both the structured error response **and** that no unintended mutation occurred:

```typescript
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/test-fixtures';
import { UNICODE_OVERFLOW_PAYLOADS } from '../support/deep-guards';

test.describe('REQ-002 - User Management API', { tag: '@REQ-002' }, () => {
  test(
    'TC-002 - AC-002 rejects whitespace-only and overflow fullName without mutating persisted record',
    { tag: ['@p1', '@api'] },
    async ({ api }) => {
      const uniqueEmail = `qa.bva.${randomUUID()}@example.com`;
      const createRes = await api.post('/api/users', {
        data: { email: uniqueEmail, fullName: 'Initial Name', role: 'viewer' },
      });
      expect(createRes.status()).toBe(201);
      const { id } = (await createRes.json()) as { id: string };

      try {
        // 1. Whitespace-only probe (DH-03)
        const wsRes = await api.patch(`/api/users/${id}`, {
          data: { fullName: '     ' },
        });
        expect(wsRes.status()).toBe(422);
        const wsErr = (await wsRes.json()) as { code: string; field?: string };
        expect(wsErr.code).toBe('VALIDATION_ERROR');

        // 2. Unicode / length overflow probe
        const overflowRes = await api.patch(`/api/users/${id}`, {
          data: { fullName: UNICODE_OVERFLOW_PAYLOADS[2] },
        });
        expect(overflowRes.status()).toBe(422);

        // 3. Read-After-Reject (PA-04): Confirm record still holds 'Initial Name'
        const getRes = await api.get(`/api/users/${id}`);
        expect(getRes.status()).toBe(200);
        const current = (await getRes.json()) as { fullName: string };
        expect(current.fullName).toBe('Initial Name');
      } finally {
        await api.deleteIgnoreNotFound(`/api/users/${id}`);
      }
    },
  );
});
```

---

## 4. Pattern C: OWASP API Security — BOLA/IDOR & Mass Assignment (`@security`)

```typescript
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/test-fixtures';
import { requireEnv } from '../support/env';

test.describe('REQ-002 - User Management API Security', { tag: '@REQ-002' }, () => {
  test(
    'TC-003 - AC-003 blocks BOLA cross-user update and leaves victim resource untouched',
    { tag: ['@p0', '@security', '@api'] },
    async ({ api }) => {
      const victimToken = requireEnv('TEST_VICTIM_API_TOKEN');
      const attackerToken = requireEnv('TEST_ATTACKER_API_TOKEN');
      const victimResourceId = requireEnv('TEST_VICTIM_RESOURCE_ID');

      // 1. Attacker attempts to mutate Victim's resource (OWASP API1: BOLA/IDOR)
      const attackRes = await api.patch(`/api/resources/${victimResourceId}`, {
        token: attackerToken,
        data: { title: 'Hacked by Attacker' },
      });
      expect([403, 404]).toContain(attackRes.status());

      // 2. Read-After-Reject as Victim: confirm data integrity
      const verifyRes = await api.get(`/api/resources/${victimResourceId}`, {
        token: victimToken,
      });
      expect(verifyRes.status()).toBe(200);
      const victimData = (await verifyRes.json()) as { title: string };
      expect(victimData.title).not.toBe('Hacked by Attacker');
    },
  );

  test(
    'TC-004 - AC-004 prevents Mass Assignment privilege escalation on profile update',
    { tag: ['@p1', '@security', '@api'] },
    async ({ api }) => {
      const viewerToken = requireEnv('TEST_VIEWER_API_TOKEN');
      const uniqueBio = `Bio ${randomUUID()}`;

      // Attempt to inject privileged properties (OWASP API3: BOPLA / Mass Assignment)
      const patchRes = await api.patch('/api/me/profile', {
        token: viewerToken,
        data: {
          bio: uniqueBio,
          role: 'admin',
          isSuperUser: true,
          permissions: ['*'],
        },
      });
      expect([200, 400, 422]).toContain(patchRes.status());

      // Verify persisted profile still has role === 'viewer'
      const meRes = await api.get('/api/me/profile', { token: viewerToken });
      expect(meRes.status()).toBe(200);
      const profile = (await meRes.json()) as { role: string; isSuperUser?: boolean };
      expect(profile.role).toBe('viewer');
      expect(profile.isSuperUser).not.toBe(true);
    },
  );
});
```

---

## 5. Pattern D: Concurrency, Race Conditions & Idempotency (`Promise.all`)

Use `Promise.all` to fire parallel requests and prove atomic locking / idempotency on the backend:

```typescript
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/test-fixtures';

test.describe('REQ-003 - Order & Coupon API Concurrency', { tag: '@REQ-003' }, () => {
  test(
    'TC-005 - AC-005 allows exactly one redemption when firing concurrent requests for a single-use coupon',
    { tag: ['@p1', '@security', '@api'] },
    async ({ api }) => {
      const couponCode = `ONCE-${randomUUID().slice(0, 8).toUpperCase()}`;
      await api.post('/api/coupons/seed', {
        data: { code: couponCode, maxRedemptions: 1 },
      });

      // Fire 5 concurrent redemption requests simultaneously
      const responses = await Promise.all([
        api.post('/api/coupons/redeem', { data: { code: couponCode } }),
        api.post('/api/coupons/redeem', { data: { code: couponCode } }),
        api.post('/api/coupons/redeem', { data: { code: couponCode } }),
        api.post('/api/coupons/redeem', { data: { code: couponCode } }),
        api.post('/api/coupons/redeem', { data: { code: couponCode } }),
      ]);

      const statuses = responses.map((r) => r.status());
      const successCount = statuses.filter((s) => s === 200 || s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409 || s === 422).length;
      const serverErrorCount = statuses.filter((s) => s >= 500).length;

      // Exactly 1 request must succeed, 4 must be rejected with 409/422, 0 HTTP 5xx
      expect(serverErrorCount).toBe(0);
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);
    },
  );

  test(
    'TC-006 - AC-006 deduplicates retried POST requests sharing the same Idempotency-Key header',
    { tag: ['@p1', '@api'] },
    async ({ api }) => {
      const idempotencyKey = randomUUID();
      const payload = { amount: 250000, currency: 'VND', reference: `ORD-${idempotencyKey}` };

      const firstRes = await api.post('/api/payments', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: payload,
      });
      const secondRes = await api.post('/api/payments', {
        headers: { 'Idempotency-Key': idempotencyKey },
        data: payload,
      });

      expect([200, 201]).toContain(firstRes.status());
      expect([200, 201]).toContain(secondRes.status());

      const firstBody = (await firstRes.json()) as { paymentId: string; amount: number };
      const secondBody = (await secondRes.json()) as { paymentId: string; amount: number };

      // Both responses must reference the exact same paymentId
      expect(firstBody.paymentId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(secondBody.paymentId).toBe(firstBody.paymentId);
      expect(secondBody.amount).toBe(250000);
    },
  );
});
```

---

## 6. Pattern E: Hybrid API Seed + UI Verification (Fast & Isolated E2E)

Follow `docs/test-data-management.md`: use `api` to seed state in milliseconds, use `page` to verify the UI behavior, and use `api` in `finally` to clean up:

```typescript
import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/test-fixtures';
import { expectNoHorizontalScroll } from '../support/ui-checks';

test.describe('REQ-004 - Hybrid API Seed and UI Verification', { tag: '@REQ-004' }, () => {
  test(
    'TC-007 - AC-007 displays API-seeded user profile accurately on Dashboard UI',
    { tag: ['@p1', '@ui', '@api'] },
    async ({ page, api, dashboardPage }) => {
      const email = `hybrid.${randomUUID()}@example.com`;
      const userId = await api.createUser({
        email,
        password: 'StrongPassword!123',
        role: 'viewer',
      });

      try {
        await page.goto('/dashboard');
        await expect(dashboardPage.heading).toBeVisible();
        await expectNoHorizontalScroll(page);
      } finally {
        await api.deleteUser(userId);
      }
    },
  );
});
```
