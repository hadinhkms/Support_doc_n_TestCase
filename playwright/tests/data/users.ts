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

/** Sinh email duy nhất cho mỗi lần chạy -> test độc lập, rerunnable. */
export function uniqueEmail(prefix = 'qa'): string {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
