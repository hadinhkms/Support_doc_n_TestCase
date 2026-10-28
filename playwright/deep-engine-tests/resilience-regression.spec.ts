import { test, expect } from '../tests/fixtures/test-fixtures';
import { expectNetworkFaultRecovery } from '../tests/support/deep-guards';

for (const faultMode of ['http-500', 'http-503', 'network-abort'] as const) {
  test(`HM-08 - network recovery acknowledges only the injected ${faultMode} record`, async ({ page, runtimeTrap }) => {
    await page.route('https://recovery.local/**', async (route) => {
      if (route.request().url().endsWith('/api/save')) {
        await route.fulfill({ status: 500, body: 'Unexpected later failure' });
        return;
      }
      await route.fulfill({
        contentType: 'text/html',
        body: `<input aria-label="Title" value="Keep me" />
          <button type="button">Save</button><p role="alert" hidden>Could not save</p>
          <script>
            document.querySelector('button').onclick = async function () {
              this.disabled = true;
              try {
                const response = await fetch('/api/save', { method: 'POST' });
                if (!response.ok) document.querySelector('[role=alert]').hidden = false;
              } catch {
                document.querySelector('[role=alert]').hidden = false;
              } finally { this.disabled = false; }
            };
          </script>`,
      });
    });
    await page.goto('https://recovery.local/form');
    const save = page.getByRole('button', { name: 'Save' });
    await expectNetworkFaultRecovery(page, async () => { await save.click(); }, {
      urlPattern: faultMode === 'http-503' ? /\/api\/save$/ : '**/api/save',
      faultMode,
      errorLocator: page.getByRole('alert'),
      submitButton: save,
      preservedInputs: [{ locator: page.getByRole('textbox', { name: 'Title' }), expectedValue: 'Keep me' }],
      allowRuntimeTrap: runtimeTrap,
    });
    expect(runtimeTrap.records.filter((record) =>
      record.source === (faultMode === 'network-abort' ? 'requestfailed' : 'http-5xx'),
    )).toHaveLength(1);
    expect(runtimeTrap.getUnexpectedRecords()).toEqual([]);

    // The same endpoint must still be monitored after the injected action finishes.
    const laterResponse = page.waitForResponse('https://recovery.local/api/save');
    await save.click();
    expect((await laterResponse).status()).toBe(500);
    await runtimeTrap.flushBrowserQueue();
    const unexpected = runtimeTrap.getUnexpectedRecords();
    expect(unexpected).toHaveLength(1);
    expect(unexpected[0]).toMatchObject({ source: 'http-5xx', status: 500, method: 'POST' });
    expect(() => runtimeTrap.assertClean()).toThrow(/HTTP 500/);
  });
}
