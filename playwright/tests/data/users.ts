import { requireEnv } from '../support/env';

export type TestUser = {
  readonly email: string;
  readonly password: string;
  readonly role: 'admin' | 'viewer';
};

/** Tài khoản chính, có quyền đầy đủ. */
export const standardUser = (): TestUser => ({
  email: requireEnv('TEST_USER_EMAIL'),
  password: requireEnv('TEST_USER_PASSWORD'),
  role: 'admin',
});

/** Tài khoản quyền thấp, dùng cho test authorization / data isolation. */
export const viewerUser = (): TestUser => ({
  email: requireEnv('TEST_VIEWER_EMAIL'),
  password: requireEnv('TEST_VIEWER_PASSWORD'),
  role: 'viewer',
});

/**
 * Dữ liệu không hợp lệ dùng cho negative/boundary case.
 * Giữ ở một chỗ để test case và script không lệch nhau.
 */
export const invalidCredentials = {
  wrongPassword: 'Wrong-Password-123!',
  unknownEmail: 'no-such-user@example.com',
  malformedEmail: 'not-an-email',
} as const;

/**
 * Email hợp lệ về cú pháp có đúng `length` ký tự (TC-014, biên 254/255 của REQ-001).
 * Local-part 64 ký tự, mỗi label domain <= 63 ký tự -> chỉ tổng độ dài là biến.
 */
export function emailOfLength(length: number): string {
  const prefix = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.`;
  const lastLabel = length - prefix.length - '.com'.length;
  if (lastLabel < 1 || lastLabel > 63) throw new Error(`emailOfLength: unsupported length ${length}`);
  return `${prefix}${'d'.repeat(lastLabel)}.com`;
}

/** Sinh email duy nhất cho mỗi lần chạy -> test độc lập, rerunnable. */
export function uniqueEmail(prefix = 'qa'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
