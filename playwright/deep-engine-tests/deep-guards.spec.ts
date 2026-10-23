import { test, expect } from '../tests/fixtures/test-fixtures';
import {
  expectBoundaryRejected,
  expectIdempotentSubmit,
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
});
