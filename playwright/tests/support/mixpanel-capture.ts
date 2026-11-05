import { expect, type Page, type Request } from '@playwright/test';
import { optionalEnv } from './env';

/**
 * Plan 17 Phase 2: bắt và decode request Mixpanel khi chạy flow thật, để spec verify
 * event tracking qua network thay vì chỉ kiểm "có request tới Mixpanel".
 * Hỗ trợ: form `data=<base64|JSON>`, JSON body (object hoặc array/batch), GET `?data=`.
 */
export type MixpanelRecord = Record<string, unknown>;

export interface MixpanelEvent {
  event: string;
  properties: MixpanelRecord;
  url: string;
}

export interface MixpanelCapture {
  /** Event từ endpoint `/track`, theo thứ tự request. */
  readonly events: MixpanelEvent[];
  /** Bản ghi `/engage` (user profile) và `/groups`. */
  readonly profiles: MixpanelRecord[];
  /** URL request khớp Mixpanel nhưng không đọc/decode được body (ví dụ beacon rỗng). */
  readonly undecoded: string[];
  stop(): void;
}

const DEFAULT_HOST = /(^|\.)mixpanel\.com$/i;
const ENDPOINT = /\/(track|engage|groups)\/?$/i;

function parseJsonRecords(text: string): MixpanelRecord[] | null {
  try {
    const value: unknown = JSON.parse(text);
    const list = Array.isArray(value) ? value : [value];
    return list.filter((item): item is MixpanelRecord => typeof item === 'object' && item !== null);
  } catch {
    return null;
  }
}

function decodeDataParam(data: string): MixpanelRecord[] {
  const direct = parseJsonRecords(data);
  if (direct) return direct;
  // URLSearchParams biến '+' chưa encode thành khoảng trắng; base64 không có khoảng trắng.
  const decoded = Buffer.from(data.replace(/ /g, '+'), 'base64').toString('utf8');
  return parseJsonRecords(decoded) ?? [];
}

/** Decode body (hoặc query string) của một request Mixpanel thành danh sách bản ghi. */
export function decodeMixpanelBody(raw: string): MixpanelRecord[] {
  const text = raw.trim();
  if (text === '') return [];
  if (text.startsWith('[') || text.startsWith('{')) return parseJsonRecords(text) ?? [];
  const data = new URLSearchParams(text).get('data');
  return data === null ? [] : decodeDataParam(data);
}

function hostMatcher(hosts?: string[]): (host: string) => boolean {
  const extra = hosts ?? optionalEnv('MIXPANEL_API_HOST', '').split(',');
  const list = extra.map((h) => h.trim().toLowerCase()).filter(Boolean);
  return (host) => DEFAULT_HOST.test(host) || list.includes(host.toLowerCase());
}

/**
 * Bắt đầu lắng nghe request Mixpanel trên `page`. Gọi TRƯỚC khi thao tác flow.
 * Proxy (`api_host` riêng): truyền `hosts` hoặc đặt env `MIXPANEL_API_HOST` (phân tách bằng dấu phẩy).
 */
export function startMixpanelCapture(page: Page, options?: { hosts?: string[] }): MixpanelCapture {
  const isMixpanelHost = hostMatcher(options?.hosts);
  const events: MixpanelEvent[] = [];
  const profiles: MixpanelRecord[] = [];
  const undecoded: string[] = [];

  const onRequest = (req: Request): void => {
    if (req.method() === 'OPTIONS') return; // CORS preflight, không có payload
    const url = new URL(req.url());
    const endpoint = ENDPOINT.exec(url.pathname)?.[1]?.toLowerCase();
    if (!endpoint || !isMixpanelHost(url.hostname)) return;
    const records = decodeMixpanelBody(req.postData() ?? url.search.replace(/^\?/, ''));
    if (records.length === 0) {
      undecoded.push(req.url());
      return;
    }
    for (const record of records) {
      if (endpoint !== 'track') {
        profiles.push(record);
        continue;
      }
      const properties = (record.properties ?? {}) as MixpanelRecord;
      events.push({ event: String(record.event ?? ''), properties, url: req.url() });
    }
  };

  page.on('request', onRequest);
  return { events, profiles, undecoded, stop: () => page.off('request', onRequest) };
}

export interface ExpectMixpanelEventOptions {
  /** Subset property phải có ở MỌI event khớp; hỗ trợ asymmetric matcher (`expect.any(String)`). */
  properties?: MixpanelRecord;
  /** Lọc event cùng tên trước khi đếm/so property (ví dụ theo `button_name`). */
  where?: (event: MixpanelEvent) => boolean;
  /** Số lần bắn chính xác; bỏ trống = ít nhất 1. */
  count?: number;
  /** Chờ tối đa (SDK có thể batch/flush trễ). Mặc định 10s. */
  timeoutMs?: number;
  /** Sau khi đủ `count`, chờ thêm để bắt bắn trùng. Mặc định 500ms. */
  settleMs?: number;
}

function matching(capture: MixpanelCapture, name: string, where?: (e: MixpanelEvent) => boolean) {
  return capture.events.filter((e) => e.event === name && (where ? where(e) : true));
}

function describeCapture(capture: MixpanelCapture): string {
  const names = capture.events.map((e) => e.event).join(', ') || '(none)';
  const skipped = capture.undecoded.length ? `; undecoded requests: ${capture.undecoded.length}` : '';
  return `captured events: ${names}${skipped}`;
}

/** Chờ event `name` được bắn, kiểm số lần (nếu có) và property bắt buộc. Trả về các event khớp. */
export async function expectMixpanelEvent(
  capture: MixpanelCapture,
  name: string,
  options: ExpectMixpanelEventOptions = {},
): Promise<MixpanelEvent[]> {
  const { properties, where, count, timeoutMs = 10_000, settleMs = 500 } = options;
  const minimum = count ?? 1;
  await expect
    .poll(() => matching(capture, name, where).length, {
      message: `Mixpanel event "${name}" not fired ${minimum}x — ${describeCapture(capture)}`,
      timeout: timeoutMs,
    })
    .toBeGreaterThanOrEqual(minimum);

  if (count !== undefined) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    const fired = matching(capture, name, where).length;
    expect(fired, `Mixpanel event "${name}" must fire exactly ${count}x (duplicate firing?)`).toBe(count);
  }

  const found = matching(capture, name, where);
  if (properties) {
    found.forEach((e, i) => {
      expect(e.properties, `Mixpanel event "${name}" #${i + 1} properties`).toMatchObject(properties);
    });
  }
  return found;
}

/** Kiểm event `name` KHÔNG được bắn trong khoảng `settleMs` (mặc định 1s). */
export async function expectNoMixpanelEvent(
  capture: MixpanelCapture,
  name: string,
  options: { settleMs?: number; where?: (event: MixpanelEvent) => boolean } = {},
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, options.settleMs ?? 1_000));
  const fired = matching(capture, name, options.where).length;
  expect(fired, `Mixpanel event "${name}" must not fire — ${describeCapture(capture)}`).toBe(0);
}
