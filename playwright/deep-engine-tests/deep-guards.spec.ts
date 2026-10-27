import { test, expect } from '../tests/fixtures/test-fixtures';
import {
  expectBoundaryRejected,
  expectIdempotentSubmit,
  expectMultiTabConcurrency,
  expectNetworkFaultRecovery,
  expectPerformanceBudget,
  expectSafeXssRender,
  expectStatePersistence,
} from '../tests/support/deep-guards';

test.describe('Deep Logic & Security Invariant Guards (HM-06..HM-08)', () => {
  test('HM-06 - TC-14-P3-01 expectIdempotentSubmit catches unguarded double-click sending 2 POST requests', async ({
    page,
  }) => {
    await page.route('https://app.local/api/submit', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.setContent(`
      <button id="submit-unguarded" type="button">Pay Now</button>
      <script>
        document.getElementById('submit-unguarded').addEventListener('click', () => {
          fetch('https://app.local/api/submit', { method: 'POST' });
        });
      </script>
    `);

    await expect(
      expectIdempotentSubmit(page, page.locator('#submit-unguarded'), '/api/submit', { settleMs: 120 }),
    ).rejects.toThrow(/Expected exactly 1 mutation request, got 2/);
  });

  test('HM-06 - TC-14-P3-02 expectIdempotentSubmit passes when button locks on click and catches missing lock', async ({
    page,
  }) => {
    await page.route('https://app.local/api/submit', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.setContent(`
      <button id="submit-guarded" type="button">Pay Now</button>
      <button id="submit-no-ui-lock" type="button">Silent Guard</button>
      <script>
        const guarded = document.getElementById('submit-guarded');
        guarded.addEventListener('click', () => {
          if (guarded.disabled) return;
          guarded.disabled = true;
          guarded.setAttribute('aria-busy', 'true');
          fetch('https://app.local/api/submit', { method: 'POST' });
        });

        let sent = false;
        document.getElementById('submit-no-ui-lock').addEventListener('click', () => {
          if (sent) return;
          sent = true;
          fetch('https://app.local/api/submit', { method: 'POST' });
        });
      </script>
    `);

    const response = await expectIdempotentSubmit(page, page.locator('#submit-guarded'), '/api/submit', {
      settleMs: 120,
    });
    expect(response.status()).toBe(200);

    await expect(
      expectIdempotentSubmit(page, page.locator('#submit-no-ui-lock'), '/api/submit', { settleMs: 120 }),
    ).rejects.toThrow(/Expected submit button to be disabled or aria-busy/);
  });

  test('HM-07 - TC-14-P3-03 expectSafeXssRender catches raw innerHTML XSS injection and passes on safe textContent sink', async ({
    page,
  }) => {
    await page.setContent(`
      <input id="q-unsafe" type="text" />
      <input id="q-safe" type="text" />
      <div id="unsafe-sink"></div>
      <div id="safe-sink"></div>
      <script>
        const unsafeInput = document.getElementById('q-unsafe');
        unsafeInput.addEventListener('input', () => {
          document.getElementById('unsafe-sink').innerHTML = unsafeInput.value;
        });
        const safeInput = document.getElementById('q-safe');
        safeInput.addEventListener('input', () => {
          document.getElementById('safe-sink').textContent = safeInput.value;
        });
      </script>
    `);

    await expect(
      expectSafeXssRender(
        page,
        async (payload) => {
          await page.locator('#q-unsafe').fill(payload);
        },
        { sinkLocator: page.locator('#unsafe-sink') },
      ),
    ).rejects.toThrow(/__xss_triggered sentinel fired|Dangerous DOM elements injected/);

    await expectSafeXssRender(
      page,
      async (payload) => {
        await page.locator('#q-safe').fill(payload);
      },
      { sinkLocator: page.locator('#safe-sink') },
    );
  });

  test('HM-08 - TC-14-P3-04 expectStatePersistence catches volatile RAM-only state and passes on persistent storage', async ({
    page,
  }) => {
    await page.route('https://app.local/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <body>
              <div id="volatile-status">Draft</div>
              <div id="persisted-status">Draft</div>
              <script>
                const saved = localStorage.getItem('docStatus');
                if (saved) {
                  document.getElementById('persisted-status').textContent = saved;
                }
              </script>
            </body>
          </html>
        `,
      });
    });

    await page.goto('https://app.local/settings');
    await page.evaluate(() => {
      const el = document.getElementById('volatile-status');
      if (el) el.textContent = 'Published';
    });

    await expect(
      expectStatePersistence(page, async () => {
        await expect(page.locator('#volatile-status')).toHaveText('Published', { timeout: 400 });
      }),
    ).rejects.toThrow(/Published/);

    await page.evaluate(() => {
      localStorage.setItem('docStatus', 'Published');
      const el = document.getElementById('persisted-status');
      if (el) el.textContent = 'Published';
    });

    await expectStatePersistence(
      page,
      async () => {
        await expect(page.locator('#persisted-status')).toHaveText('Published');
      },
      { expectStorageKeys: [{ storage: 'local', key: 'docStatus' }] },
    );
  });

  test('HM-08 - TC-14-P3-05 expectBoundaryRejected and expectPerformanceBudget enforce client block and latency budget', async ({
    page,
  }) => {
    await page.route('https://app.local/api/save', async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });

    await page.setContent(`
      <button id="blocked-btn" type="button">Blocked Save</button>
      <button id="leaky-btn" type="button">Leaky Save</button>
      <div id="err-msg" style="display:none">Invalid boundary value</div>
      <script>
        document.getElementById('blocked-btn').addEventListener('click', () => {
          document.getElementById('err-msg').style.display = 'block';
        });
        document.getElementById('leaky-btn').addEventListener('click', () => {
          document.getElementById('err-msg').style.display = 'block';
          fetch('https://app.local/api/save', { method: 'POST' });
        });
      </script>
    `);

    await expectBoundaryRejected(
      page,
      async () => {
        await page.locator('#blocked-btn').click();
      },
      page.locator('#err-msg'),
      { expectedPattern: /Invalid boundary value/, mutationUrlPattern: '/api/save' },
    );

    await expect(
      expectBoundaryRejected(
        page,
        async () => {
          await page.locator('#leaky-btn').click();
        },
        page.locator('#err-msg'),
        { mutationUrlPattern: '/api/save' },
      ),
    ).rejects.toThrow(/Expected 0 mutation requests/);

    const perf = await expectPerformanceBudget(
      page,
      async () => {
        await page.locator('#blocked-btn').click();
      },
      { maxActionMs: 2000 },
    );
    expect(perf.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  test('HM-08 - TC-14-P3-06 expectNetworkFaultRecovery and expectMultiTabConcurrency verify fault recovery and tab conflict guard', async ({
    page,
    runtimeTrap,
  }) => {
    await page.setContent(`
      <input id="title-input" value="Xe Mazda CX-5 2025" />
      <input id="secret-input" value="123456" />
      <button id="save-post" type="button">Save Post</button>
      <div id="fault-banner" style="display:none"></div>
      <script>
        const btn = document.getElementById('save-post');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await fetch('https://app.local/api/posts', { method: 'POST' });
            if (!res.ok) {
              document.getElementById('fault-banner').textContent = 'Server error, please retry';
              document.getElementById('fault-banner').style.display = 'block';
              document.getElementById('secret-input').value = '';
            }
          } finally {
            btn.disabled = false;
          }
        });
      </script>
    `);

    await expectNetworkFaultRecovery(
      page,
      async () => {
        await page.locator('#save-post').click();
      },
      {
        urlPattern: '**/api/posts',
        faultMode: 'http-500',
        errorLocator: page.locator('#fault-banner'),
        expectedErrorPattern: /Server error/,
        submitButton: page.locator('#save-post'),
        preservedInputs: [{ locator: page.locator('#title-input'), expectedValue: 'Xe Mazda CX-5 2025' }],
        clearedInputs: [page.locator('#secret-input')],
        allowRuntimeTrap: runtimeTrap,
      },
    );

    let currentVersion = 1;
    await page.context().route('https://app.local/api/doc', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.version !== currentVersion) {
          await route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Version conflict"}' });
          return;
        }
        currentVersion += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: `{"version":${currentVersion}}` });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <div id="conflict-alert" style="display:none">Conflict detected</div>
          <button id="save-doc" type="button">Save Doc</button>
          <script>
            window.__ver = ${currentVersion};
            document.getElementById('save-doc').addEventListener('click', async () => {
              const res = await fetch('https://app.local/api/doc', {
                method: 'PUT',
                body: JSON.stringify({ version: window.__ver }),
              });
              if (res.status === 409) {
                document.getElementById('conflict-alert').style.display = 'block';
              }
            });
          </script>
        `,
      });
    });

    await expectMultiTabConcurrency(page, {
      setupBothTabs: async (tabA, tabB) => {
        await tabA.goto('https://app.local/api/doc');
        await tabB.goto('https://app.local/api/doc');
      },
      tabAAction: async (tabA) => {
        await tabA.locator('#save-doc').click();
      },
      tabBConflictingAction: async (tabB) => {
        await tabB.locator('#save-doc').click();
      },
      verifyConflictOrIsolation: async (_tabA, tabB) => {
        await expect(tabB.locator('#conflict-alert')).toBeVisible();
      },
    });
  });
});
