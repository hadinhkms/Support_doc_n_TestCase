import { test, expect, type Page } from '@playwright/test';
import {
  decodeMixpanelBody,
  expectMixpanelEvent,
  expectNoMixpanelEvent,
  startMixpanelCapture,
} from '../tests/support/mixpanel-capture';

/**
 * Plan 17 Phase 2: self-test cho helper bắt event Mixpanel (HM-16).
 * Không cần app/Mixpanel thật: page.route() giả endpoint, page.setContent() bắn request.
 */
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
const SIGN_IN = { event: 'Sign In Completed', properties: { method: 'password', distinct_id: 'u-1' } };

/** Chặn MỌI request ra ngoài: endpoint giả trả 200, còn lại abort, không chạm mạng thật. */
async function fakeMixpanel(page: Page): Promise<void> {
  await page.route(/^https?:\/\//, (route) =>
    /\/(track|engage|groups)\/?(\?|$)/.test(route.request().url())
      ? route.fulfill({ status: 200, body: '1', headers: { 'Access-Control-Allow-Origin': '*' } })
      : route.abort(),
  );
}

/** Bắn request từ trang; `script` là thân hàm async chạy trong browser. */
async function fire(page: Page, script: string): Promise<void> {
  await page.setContent(`<script>(async () => { ${script} })();</script>`);
}

test.describe('Mixpanel capture helper (HM-16)', () => {
  test('HM-16 - TC-17-P2-01 decodeMixpanelBody handles base64 form, JSON data, batch and garbage', () => {
    const encoded = b64([SIGN_IN]);
    expect(decodeMixpanelBody(`data=${encodeURIComponent(encoded)}&ip=1`)).toEqual([SIGN_IN]);
    expect(decodeMixpanelBody(`data=${encoded}`), 'raw "+" in unencoded base64').toEqual([SIGN_IN]);
    expect(decodeMixpanelBody(`data=${encodeURIComponent(JSON.stringify(SIGN_IN))}`)).toEqual([SIGN_IN]);
    expect(decodeMixpanelBody(JSON.stringify([SIGN_IN, SIGN_IN]))).toHaveLength(2);
    expect(decodeMixpanelBody(JSON.stringify(SIGN_IN))).toEqual([SIGN_IN]);
    expect(decodeMixpanelBody('')).toEqual([]);
    expect(decodeMixpanelBody('data=%%%not-base64')).toEqual([]);
    expect(decodeMixpanelBody('foo=bar')).toEqual([]);
  });

  test('HM-16 - TC-17-P2-02 captures track and engage records and asserts event properties', async ({
    page,
  }) => {
    await fakeMixpanel(page);
    const capture = startMixpanelCapture(page);
    const track = encodeURIComponent(b64([SIGN_IN]));
    const engage = encodeURIComponent(b64({ $distinct_id: 'u-1', $set: { plan: 'free' } }));
    await fire(
      page,
      `const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
       await fetch('https://api-js.mixpanel.com/track/?verbose=1', { method: 'POST', headers: h, body: 'data=${track}' });
       await fetch('https://api-js.mixpanel.com/engage/', { method: 'POST', headers: h, body: 'data=${engage}' });`,
    );

    const found = await expectMixpanelEvent(capture, 'Sign In Completed', {
      count: 1,
      settleMs: 200,
      properties: { method: 'password', distinct_id: expect.any(String) },
    });
    expect(found[0].url).toContain('/track/');
    await expect.poll(() => capture.profiles.length).toBe(1);
    expect(capture.profiles[0]).toMatchObject({ $set: { plan: 'free' } });

    await expect(
      expectMixpanelEvent(capture, 'Sign In Completed', { properties: { method: 'google' } }),
    ).rejects.toThrow(/properties/);
  });

  test('HM-16 - TC-17-P2-03 detects duplicate firing when an exact count is required', async ({ page }) => {
    await fakeMixpanel(page);
    const capture = startMixpanelCapture(page);
    const body = JSON.stringify([{ event: 'Page Viewed', properties: { page: 'home' } }]);
    await fire(
      page,
      `for (let i = 0; i < 2; i++) {
         await fetch('https://api.mixpanel.com/track', { method: 'POST', body: ${JSON.stringify(body)} });
       }`,
    );

    await expect.poll(() => capture.events.length).toBe(2);
    await expect(
      expectMixpanelEvent(capture, 'Page Viewed', { count: 1, settleMs: 100 }),
    ).rejects.toThrow(/exactly 1x/);
    await expectMixpanelEvent(capture, 'Page Viewed', { count: 2, settleMs: 100 });
  });

  test('HM-16 - TC-17-P2-04 matches a proxy api_host and ignores unrelated hosts', async ({ page }) => {
    await fakeMixpanel(page);
    const capture = startMixpanelCapture(page, { hosts: ['track.app.local'] });
    const body = JSON.stringify({ event: 'Proxy Event', properties: {} });
    const other = JSON.stringify({ event: 'Not Mixpanel', properties: {} });
    await fire(
      page,
      `await fetch('https://track.app.local/track', { method: 'POST', body: ${JSON.stringify(body)} });
       await fetch('https://analytics.other.local/track', { method: 'POST', body: ${JSON.stringify(other)} });`,
    );

    await expectMixpanelEvent(capture, 'Proxy Event', { timeoutMs: 3_000 });
    await expectNoMixpanelEvent(capture, 'Not Mixpanel', { settleMs: 200 });
  });

  test('HM-16 - TC-17-P2-05 reports missing events with what was captured, and catches forbidden ones', async ({
    page,
  }) => {
    await fakeMixpanel(page);
    const capture = startMixpanelCapture(page);
    const body = JSON.stringify({ event: 'Sign In Failed', properties: { reason: 'wrong_password' } });
    await fire(page, `await fetch('https://api.mixpanel.com/track', { method: 'POST', body: ${JSON.stringify(body)} });`);

    await expect.poll(() => capture.events.length).toBe(1);
    await expect(
      expectMixpanelEvent(capture, 'Sign In Completed', { timeoutMs: 300 }),
    ).rejects.toThrow(/captured events: Sign In Failed/);
    await expect(expectNoMixpanelEvent(capture, 'Sign In Failed', { settleMs: 50 })).rejects.toThrow(
      /must not fire/,
    );
  });

  test('HM-16 - TC-17-P2-06 reads sendBeacon payloads and stop() detaches the listener', async ({ page }) => {
    await fakeMixpanel(page);
    const capture = startMixpanelCapture(page);
    const data = encodeURIComponent(b64({ event: 'Page Left', properties: {} }));
    await fire(page, `navigator.sendBeacon('https://api-js.mixpanel.com/track', new Blob(['data=${data}']));`);
    await expectMixpanelEvent(capture, 'Page Left', { timeoutMs: 3_000 });

    capture.stop();
    const late = JSON.stringify({ event: 'After Stop', properties: {} });
    await fire(page, `await fetch('https://api.mixpanel.com/track', { method: 'POST', body: ${JSON.stringify(late)} });`);
    await expectNoMixpanelEvent(capture, 'After Stop', { settleMs: 300 });
  });
});
