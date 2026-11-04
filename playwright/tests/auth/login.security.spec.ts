import type { Page, Response } from '@playwright/test';
import { test, expect } from '../fixtures/test-fixtures';
import { viewerUser, invalidCredentials } from '../data/users';
import type { LoginPage } from '../pages/login.page';

/**
 * REQ-001 Sign in - probe bảo mật tầng HTTP trên ứng dụng thật (không phải self-test của helper).
 * Requirement : requirements/REQ-001-sign-in.md (AC-002, Q-004)
 * Test cases  : test-cases/REQ-001-sign-in.md
 *
 * Không đoán body request/response: bắt chính request mà UI gửi đi và chỉ so sánh hai phản hồi
 * với nhau, vì contract chỉ chốt rằng hai trường hợp không được phân biệt.
 */

type FlatBody = Record<string, string>;
type ResponseShape = { status: number; body: FlatBody };

async function submitAndCaptureShape(
  page: Page,
  loginPage: LoginPage,
  email: string,
  password: string,
): Promise<ResponseShape> {
  await loginPage.goto();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/api/auth/login'),
  );
  await loginPage.login(email, password);
  const response = await responsePromise;
  // Đọc body ngay: sau khi điều hướng trình duyệt có thể huỷ body.
  return { status: response.status(), body: await flatBody(response) };
}

/** Làm phẳng JSON thành path -> giá trị để so cả trường lồng nhau; body không phải JSON -> `$text`. */
async function flatBody(response: Response): Promise<FlatBody> {
  const text = await response.text();
  try {
    return flatten(JSON.parse(text));
  } catch {
    return { $text: text };
  }
}

function flatten(value: unknown, path = '$', out: FlatBody = {}): FlatBody {
  if (value !== null && typeof value === 'object' && Object.keys(value).length > 0) {
    for (const [key, child] of Object.entries(value)) flatten(child, `${path}.${key}`, out);
  } else {
    out[path] = JSON.stringify(value);
  }
  return out;
}

function withoutPaths(body: FlatBody, ignored: string[]): FlatBody {
  return Object.fromEntries(Object.entries(body).filter(([path]) => !ignored.includes(path)));
}

test.describe('REQ-001 - Sign in HTTP security', { tag: '@REQ-001' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'TC-021 - AC-002 wrong password and unknown email get indistinguishable login API responses',
    { tag: ['@p1', '@security'] },
    async ({ loginPage, page }) => {
      // AC-007 khoá email ở lần sai thứ 6 trong 15 phút. TC-002 + TC-021 cùng thử sai tài khoản viewer
      // ở mọi project -> nightly (3 project) đã đủ 6 lần dù app đúng. Probe tầng HTTP không phụ thuộc
      // trình duyệt nên chỉ chạy 1 project. So theo TÊN project: mobile-chrome cũng có browserName
      // 'chromium'. Còn lại: nightly 3+1, local 4+1, PR/push 1+1; retry vẫn có thể vượt 5.
      test.skip(
        test.info().project.name !== 'chromium',
        'HTTP-level probe; limits failed attempts on the viewer account (AC-007)',
      );
      // Tài khoản viewer, như TC-002: không cộng lần thử sai vào tài khoản của auth.setup.ts.
      const user = viewerUser();
      const { wrongPassword: password, unknownEmail } = invalidCredentials;

      const wrongPassword = await submitAndCaptureShape(page, loginPage, user.email, password);
      // Gửi email không tồn tại 2 lần: trường khác nhau giữa 2 lần là nhiễu tự nhiên
      // (requestId, timestamp) và được bỏ qua; mọi trường còn lại phải giống hệt.
      const unknownA = await submitAndCaptureShape(page, loginPage, unknownEmail, password);
      const unknownB = await submitAndCaptureShape(page, loginPage, unknownEmail, password);
      const volatile = Object.keys(unknownA.body).filter((path) => unknownA.body[path] !== unknownB.body[path]);
      test.info().annotations.push({ type: 'volatile-fields', description: volatile.join(', ') || '(none)' });

      expect(wrongPassword.status, 'phải là từ chối có chủ đích, không phải lỗi server').toBeLessThan(500);
      expect(unknownA.status, 'AC-002: status không được tiết lộ email có tồn tại').toBe(wrongPassword.status);
      expect(Object.keys(unknownA.body).sort(), 'AC-002: cấu trúc body không được khác nhau').toEqual(
        Object.keys(wrongPassword.body).sort(),
      );
      // Mọi trường đều là nhiễu (vd. body không phải JSON có nonce) -> không còn gì để so:
      // báo không kiểm chứng được thay vì pass rỗng.
      expect(
        Object.keys(withoutPaths(wrongPassword.body, volatile)).length,
        'không có trường ổn định nào để so sánh - cần xác định lại cách so body (Q-004)',
      ).toBeGreaterThan(0);
      expect(
        withoutPaths(unknownA.body, volatile),
        'AC-002: giá trị body (vd. mã lỗi lồng nhau) không được tiết lộ email có tồn tại',
      ).toEqual(withoutPaths(wrongPassword.body, volatile));
    },
  );
});
