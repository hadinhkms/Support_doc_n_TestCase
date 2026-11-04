'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { impactedReqs, grepFragment, importTargets, repoIo } = require('./pr-impact');

// Mô phỏng layout thật: spec -> fixtures/test-fixtures -> pages/* -> pages/base.page.
const FILES = {
  'playwright/tests/auth/login.spec.ts':
    "import { test } from '../fixtures/test-fixtures';\ntest.describe('x', { tag: '@REQ-001' }, () => {});",
  'playwright/tests/orders/orders.spec.ts':
    "import { users } from '../data/users';\ntest.describe('y', { tag: '@REQ-007' }, () => {});",
  'playwright/tests/misc/untagged.spec.ts': "import { LoginPage } from '../pages/login.page';",
  'playwright/tests/fixtures/test-fixtures.ts':
    "import { LoginPage } from '../pages/login.page';\nimport {\n  DashboardPage,\n} from '../pages/dashboard.page';",
  'playwright/tests/pages/login.page.ts': "import { BasePage } from './base.page';",
  'playwright/tests/pages/dashboard.page.ts': "import { BasePage } from './base.page';",
  'playwright/tests/pages/base.page.ts': "import type { Page } from '@playwright/test';",
  'playwright/tests/data/users.ts': "export * from '../support/env';",
  'playwright/tests/support/env.ts': '',
};
const io = {
  readFile: (p) => FILES[p] ?? null,
  listFiles: () => Object.keys(FILES),
};

test('requirement and test-case files map to their REQ id', () => {
  const files = ['requirements/REQ-001-sign-in.md', 'test-cases/REQ-002-sign-up.automation-plan.md'];
  assert.deepEqual(impactedReqs(files, io), ['REQ-001', 'REQ-002']);
});

test('a changed spec maps to the @REQ tags it declares', () => {
  assert.deepEqual(impactedReqs(['playwright/tests/orders/orders.spec.ts'], io), ['REQ-007']);
});

test('a page reached only through a fixture still selects the spec (fixture -> page -> spec)', () => {
  assert.deepEqual(impactedReqs(['playwright/tests/pages/dashboard.page.ts'], io), ['REQ-001']);
});

test('a deep shared module selects every REQ that reaches it, including via re-exports', () => {
  assert.deepEqual(impactedReqs(['playwright/tests/pages/base.page.ts'], io), ['REQ-001']);
  assert.deepEqual(impactedReqs(['playwright/tests/support/env.ts'], io), ['REQ-007']);
});

test('unrelated, deleted or traceability-only changes select nothing', () => {
  const files = ['README.md', 'test-cases/traceability.md', 'playwright/tests/gone/deleted.spec.ts', ''];
  assert.deepEqual(impactedReqs(files, io), []);
  assert.equal(grepFragment([]), '');
});

test('Windows separators and ./ prefixes are normalised', () => {
  assert.deepEqual(impactedReqs(['.\\requirements\\REQ-003-x.md'], io), ['REQ-003']);
});

test('grep fragment anchors each id so REQ-001 does not match REQ-0010', () => {
  const fragment = grepFragment(['REQ-001', 'REQ-007']);
  assert.equal(fragment, '@REQ-001\\b|@REQ-007\\b');
  const re = new RegExp(fragment);
  assert.ok(re.test('REQ-001 - Sign in @REQ-001 @p1'));
  assert.ok(!re.test('@REQ-0010'));
});

test('importTargets resolves relative paths and ignores package imports', () => {
  const file = 'playwright/tests/auth/login.spec.ts';
  const text = "import { a } from '../pages/login.page';\nimport { b } from '@playwright/test';\nexport * from './x.ts';";
  assert.deepEqual(importTargets(file, text), ['playwright/tests/pages/login.page', 'playwright/tests/auth/x']);
});

test('against the real repo, page objects behind test-fixtures select REQ-001', () => {
  for (const file of ['playwright/tests/pages/login.page.ts', 'playwright/tests/pages/dashboard.page.ts']) {
    assert.deepEqual(impactedReqs([file], repoIo()), ['REQ-001'], file);
  }
});
