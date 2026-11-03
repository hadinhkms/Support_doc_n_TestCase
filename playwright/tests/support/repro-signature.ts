import { sha256 } from './evidence-integrity';

/**
 * Signature ổn định của lỗi (reproduction-protocol §3 bước 6): cùng nguyên nhân → cùng hash,
 * khác assertion/locator/giá trị → khác hash. Bỏ ANSI, stack, thời điểm, đường dẫn, port và id
 * biến động; GIỮ dòng thông điệp, `Locator:`, Expected/Received và các dòng diff `-`/`+` của
 * toEqual. Mọi error của attempt (soft assertion) đều góp vào signature.
 */
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const VOLATILE: [RegExp, string][] = [
  [/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<ts>'],
  [/\b\d+(\.\d+)?\s?ms\b/g, '<ms>'],
  [/(?:[A-Za-z]:)?[\\/][^\s:'"]+\.(?:ts|js|mjs)(?::\d+){0,2}/g, '<file>'],
  // Chỉ digest dài (≥ 32 hex, cỡ md5/sha) — id ngắn hơn có thể là dữ liệu thật cần phân biệt.
  [/\b[0-9a-f]{32,}\b/gi, '<hex>'],
  // Port chỉ khi đứng sau host, để "10:30" và "10:45" (giờ) không bị gộp.
  [/\b(localhost|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9-]+(?:\.[a-z0-9-]+)+):\d{2,5}\b/gi, '$1:<port>'],
  [/\b(req|state)-[A-Za-z0-9_.~-]+/g, '$1-<id>'],
];
const KEEP = /^(Locator:|[-+]?\s*(Expected|Received)\b|[-+]\s)/;

function oneError(error: string): string {
  const lines = error
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/^\s*at\s/.test(l) && !/^\s*Call log:/.test(l));
  const head = (lines[0] ?? '').trim().replace(/^Error:\s*/, '');
  const keep = lines.slice(1).map((l) => l.trim()).filter((l) => KEEP.test(l));
  return [head, ...keep].join(' | ');
}

export function failureSignature(errors: readonly string[]): { text: string; hash: string } | null {
  const parts = errors.filter((e) => e.trim().length > 0).map(oneError);
  if (parts.length === 0) return null;
  let text = parts.join(' || ');
  for (const [pattern, replacement] of VOLATILE) text = text.replace(pattern, replacement);
  return { text, hash: sha256(Buffer.from(text, 'utf8')).slice(0, 16) };
}
