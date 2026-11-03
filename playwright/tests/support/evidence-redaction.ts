import { redactSensitiveText } from '../fixtures/runtime-trap-redaction';

/**
 * Redaction trước khi persist evidence (evidence-contract §4).
 * Mở rộng `redactSensitiveText` của runtime-trap (query param + Bearer/Basic) thêm:
 * key nhạy cảm lồng nhau, cặp `key=value` / JSON trong chuỗi, cookie, JWT và
 * giá trị secret đã biết (env credential + canary) dưới dạng literal.
 */
export type Sensitivity = 'SHAREABLE' | 'RESTRICTED';

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /(authorization|cookie|password|passwd|secret|token|api[-_]?key|session|sid|otp|credential)/i;
const INLINE_PAIR =
  /(\b(?:password|passwd|secret|token|access_token|refresh_token|otp|api[-_]?key|session|sid)\b"?\s*[:=]\s*"?)([^\s,"&;}]+)/gi;
const COOKIE_LINE = /(\b(?:set-)?cookie\s*:\s*)[^\r\n]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/g;
const SECRET_FLAG = /^--?(token|password|passwd|secret|api[-_]?key|otp|cookie|auth)$/i;
const SECRET_ENV_NAME = /(PASSWORD|PASSWD|TOKEN|SECRET|API_KEY|APIKEY|OTP|COOKIE)/i;
const MIN_SECRET_LENGTH = 6;
const MAX_DEPTH = 20;

/**
 * Giá trị secret đã biết trong process: env credential (`TEST_USER_PASSWORD`, `API_TOKEN`...)
 * và canary khai báo qua `EVIDENCE_SECRET_CANARIES` (phân tách bằng dấu phẩy).
 * Chỉ dùng để dò/xóa; không bao giờ ghi các giá trị này ra artifact.
 */
export function knownSecretValues(env: NodeJS.ProcessEnv = process.env): string[] {
  const values = new Set<string>();
  for (const [name, value] of Object.entries(env)) {
    if (value && SECRET_ENV_NAME.test(name) && value.length >= MIN_SECRET_LENGTH) values.add(value);
  }
  for (const canary of (env.EVIDENCE_SECRET_CANARIES ?? '').split(',')) {
    if (canary.trim().length >= MIN_SECRET_LENGTH) values.add(canary.trim());
  }
  return [...values].sort((a, b) => b.length - a.length);
}

export function redactText(input: string, secrets: readonly string[] = []): string {
  if (!input) return input;
  let out = redactSensitiveText(input)
    .replace(INLINE_PAIR, `$1${REDACTED}`)
    .replace(COOKIE_LINE, `$1${REDACTED}`)
    .replace(JWT, REDACTED);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join(REDACTED);
  }
  return out;
}

/** Redact đệ quy object/array; key nhạy cảm bị thay toàn bộ giá trị. */
export function redactValue(value: unknown, secrets: readonly string[] = [], depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED_DEPTH]';
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, secrets, depth + 1);
    }
    return out;
  }
  return value;
}

/** Redact command theo thứ tự argument; `--token X` thì X bị thay, giữ nguyên vị trí. */
export function redactArgv(argv: readonly string[], secrets: readonly string[] = []): string[] {
  return argv.map((arg, index) =>
    index > 0 && SECRET_FLAG.test(argv[index - 1]) ? REDACTED : redactText(arg, secrets),
  );
}

/** Trả về các secret/canary còn xuất hiện trong bytes (utf8 và utf16le). */
export function findSecretsInBytes(bytes: Buffer, secrets: readonly string[]): string[] {
  return secrets.filter(
    (secret) =>
      bytes.includes(Buffer.from(secret, 'utf8')) || bytes.includes(Buffer.from(secret, 'utf16le')),
  );
}

export function isTextualMime(mime: string): boolean {
  return /^text\/|^application\/(json|xml|x-ndjson)|\+json$|\+xml$/i.test(mime);
}

/**
 * Text đã redact và sạch secret → SHAREABLE.
 * Binary (ảnh/trace/HAR/video) không sanitize được bằng regex → RESTRICTED,
 * trừ khi caller khai `synthetic` (chỉ dữ liệu giả lập) VÀ quét bytes sạch.
 */
export function classifySensitivity(input: {
  mime: string;
  leakedSecrets: number;
  synthetic?: boolean;
  restricted?: boolean;
}): Sensitivity {
  if (input.restricted || input.leakedSecrets > 0) return 'RESTRICTED';
  if (isTextualMime(input.mime)) return 'SHAREABLE';
  return input.synthetic ? 'SHAREABLE' : 'RESTRICTED';
}
