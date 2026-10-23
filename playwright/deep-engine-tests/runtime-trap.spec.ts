import {
  test,
  expect,
  expectNoConsoleOrPageError,
  expectExpectedError,
} from '../tests/fixtures/test-fixtures';

test.describe('Phase 1 - Runtime Bug-Trap Fixture (HM-01 & HM-02)', () => {
  test('HM-01 - TC-14-P1-01 trap catches unhandled Promise.reject and console.error after flushing browser queue', async ({
    page,
    runtimeTrap,
  }) => {
    await page.setContent(`
      <script>
        console.error('Fatal state corruption in checkout widget');
        Promise.reject(new Error('boom async unhandled rejection'));
      </script>
      <main><h1>HM-01 Mutation</h1></main>
    `);

    await runtimeTrap.flushBrowserQueue();

    const unexpected = runtimeTrap.getUnexpectedRecords();
    expect(unexpected).toHaveLength(2);
    expect(unexpected.some((r) => r.source === 'console.error' && /Fatal state corruption/.test(r.message))).toBe(
      true,
    );
    expect(unexpected.some((r) => r.source === 'pageerror' && /boom async unhandled rejection/.test(r.message))).toBe(
      true,
    );

    expect(() => runtimeTrap.assertClean()).toThrow(
      /Runtime Bug-Trap phát hiện 2 lỗi ngầm[\s\S]*Fatal state corruption[\s\S]*boom async unhandled rejection/,
    );

    // Cho phép lỗi đột biến đã kiểm chứng để teardown của chính bài test harness này đóng sạch.
    runtimeTrap.allow({
      source: '*',
      pattern: /.*/,
      reason: 'HM-01 mutation verified and acknowledged by harness test',
    });
  });

  test('HM-01 - TC-14-P1-02 allow rule requires non-empty reason and suppresses matching console and pageerror', async ({
    page,
    runtimeTrap,
  }) => {
    expect(() =>
      runtimeTrap.allow({
        source: 'console.error',
        pattern: /legacy/,
        reason: '   ',
      }),
    ).toThrow(/bắt buộc phải khai báo trường reason không rỗng/);

    runtimeTrap.allow({
      source: 'console.error',
      pattern: /known-third-party-deprecation/,
      reason: 'Known third-party warning tracked in ticket #101',
    });
    runtimeTrap.allow({
      source: 'pageerror',
      pattern: /harmless- telemetry-abort/,
      reason: 'Telemetry offline mode expected in sandbox',
    });

    await page.setContent(`
      <script>
        console.error('known-third-party-deprecation: legacy API');
        Promise.reject(new Error('harmless- telemetry-abort'));
      </script>
      <p>Clean with explicit allow rules</p>
    `);

    await runtimeTrap.flushBrowserQueue();
    expect(runtimeTrap.records).toHaveLength(2);
    expect(runtimeTrap.getUnexpectedRecords()).toEqual([]);
    expectNoConsoleOrPageError(runtimeTrap);
  });

  test('HM-02 - TC-14-P1-03 trap catches HTTP 500 and redacts sensitive Authorization header and URL token', async ({
    page,
    runtimeTrap,
  }) => {
    await page.route('https://harness.local/**', async (route) => {
      if (route.request().url().includes('/api/orders')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection pool exhausted' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<main><h1>Orders Host</h1></main>',
      });
    });

    await page.goto('https://harness.local/checkout');
    await page.setContent(`
      <button id="order-btn" type="button">Place Order</button>
      <script>
        document.getElementById('order-btn').addEventListener('click', () => {
          fetch('https://harness.local/api/orders?token=super_secret_query_token&orderId=99', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ultraSecretSignature',
              'X-Api-Key': 'raw-private-api-key-12345'
            },
            body: JSON.stringify({ item: 'book' })
          });
        });
      </script>
    `);

    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect.poll(() => runtimeTrap.getUnexpectedRecords().length).toBe(1);

    const [record] = runtimeTrap.getUnexpectedRecords();
    expect(record?.source).toBe('http-5xx');
    expect(record?.status).toBe(500);
    expect(record?.method).toBe('POST');
    expect(record?.url).toContain('token=[REDACTED]');
    expect(record?.url).not.toContain('super_secret_query_token');

    const serialized = JSON.stringify(record);
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('ultraSecretSignature');
    expect(serialized).not.toContain('raw-private-api-key-12345');
    expect(serialized).not.toContain('super_secret_query_token');

    expect(() => runtimeTrap.assertClean()).toThrow(/\[http-5xx\] HTTP 500 on POST/);

    runtimeTrap.allow({
      source: 'http-5xx',
      pattern: '/api/orders',
      status: 500,
      reason: 'HM-02 500 error verified and acknowledged by harness test',
    });
  });

  test('HM-02 - TC-14-P1-04 control pass on HTTP 200 and benign aborted image request', async ({
    page,
    runtimeTrap,
  }) => {
    await page.route('https://harness.local/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/api/health')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok' }),
        });
        return;
      }
      if (url.endsWith('/banner.png')) {
        await route.abort('aborted');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<main><h1>Health Host</h1></main>',
      });
    });

    await page.goto('https://harness.local/home');
    await page.setContent(`
      <img src="https://harness.local/banner.png" alt=" Decorative banner " />
      <script>
        fetch('https://harness.local/api/health');
      </script>
    `);

    await runtimeTrap.flushBrowserQueue();
    expect(runtimeTrap.getUnexpectedRecords()).toEqual([]);
    expectNoConsoleOrPageError(runtimeTrap);
  });

  test('HM-02 - TC-14-P1-05 expectExpectedError passes when expected 500 occurs and fails when it does not occur', async ({
    page,
    runtimeTrap,
  }) => {
    await page.route('https://harness.local/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/fail-expected')) {
        await route.fulfill({ status: 503, body: 'Service Unavailable' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<main>Host</main>' });
    });

    await page.goto('https://harness.local/test');
    await page.setContent(`
      <button id="btn-503" type="button">Trigger 503</button>
      <button id="btn-200" type="button">Trigger 200</button>
      <script>
        document.getElementById('btn-503').addEventListener('click', () => {
          fetch('https://harness.local/api/fail-expected');
        });
        document.getElementById('btn-200').addEventListener('click', () => {
          fetch('https://harness.local/api/ok-endpoint');
        });
      </script>
    `);

    const matched = await expectExpectedError(
      runtimeTrap,
      {
        source: 'http-5xx',
        pattern: '/api/fail-expected',
        status: 503,
        reason: 'Negative test verifying 503 resilience',
      },
      async () => {
        await page.getByRole('button', { name: 'Trigger 503' }).click();
        await expect.poll(() => runtimeTrap.records.length).toBeGreaterThan(0);
      },
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.status).toBe(503);

    let missingErrorCaught = false;
    try {
      await expectExpectedError(
        runtimeTrap,
        {
          source: 'http-5xx',
          pattern: '/api/never-fails',
          status: 500,
          reason: 'Verify expectExpectedError rejects when fault is absent',
        },
        async () => {
          await page.getByRole('button', { name: 'Trigger 200' }).click();
        },
      );
    } catch (err) {
      missingErrorCaught = /expectExpectedError thất bại/.test(String(err));
    }
    expect(missingErrorCaught).toBe(true);
    expectNoConsoleOrPageError(runtimeTrap);
  });
});
