# Playwright Automation

## Cài đặt

```powershell
npm install
npx playwright install
Copy-Item .env.example .env   # rồi điền giá trị thật
```

Biến môi trường đọc qua `requireEnv()` trong [tests/support/env.ts](tests/support/env.ts): thiếu biến thì test **fail ngay kèm hướng dẫn**, không chạy tiếp với giá trị giả.

## Kiểm tra trước khi mở PR

```powershell
npm run verify   # tsc --noEmit + eslint + playwright test --list
```

Cả ba bước đều chạy được mà không cần ứng dụng thật.

## Cách chuyển một test case thành script

1. Lấy `REQ`, `AC`, `TC`, priority và test data từ file test case.
2. Xác định URL/route và trạng thái precondition.
3. Chọn locator theo [docs/selector-convention.md](../docs/selector-convention.md).
4. Viết từng action đúng như step trong test case; dùng `test.step()` khi case có nhiều giai đoạn.
5. Sau mỗi business action, assert kết quả quan sát được.
6. Assert side effect: URL, record, status, message hoặc permission.
7. Chạy độc lập hai lần để kiểm tra rerun và cleanup.
8. Chạy trên CI với trace khi fail.

Đặt title theo `TC-xxx - AC-yyy <mô tả>` và gắn tag priority. ESLint sẽ báo lỗi nếu title không mở đầu bằng mã `TC-xxx`.

## Kiến trúc

```
tests/
  auth.setup.ts      đăng nhập 1 lần -> .auth/user.json, các project khác dùng lại
  support/env.ts     đọc biến môi trường kiểu fail-fast
  support/paths.ts   đường dẫn storageState, dùng chung với playwright.config.ts
  data/users.ts      tài khoản test, dữ liệu không hợp lệ, sinh email duy nhất
  pages/             page object - chỉ gom locator, KHÔNG chứa assertion nghiệp vụ
  api/api-client.ts  seed/cleanup qua API
  fixtures/          test object dùng chung (import `test` từ đây, không từ @playwright/test)
  auth/, a11y/       spec theo domain
```

Trong spec, import như sau:

```ts
import { test, expect } from '../fixtures/test-fixtures';
```

Fixture sẽ tự cấp `loginPage`, `dashboardPage` và `api`.

## Auth dùng lại session

Project `setup` chạy `auth.setup.ts` một lần, lưu session ra `.auth/user.json`. Mọi project khác khai báo `dependencies: ['setup']` và `storageState`, nên không phải đăng nhập lại qua UI.

Test **về chính luồng đăng nhập** phải ghi đè để bắt đầu từ trạng thái chưa đăng nhập:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

## Quy ước bị ESLint chặn

Chạy `npm run lint`. Các rule đang bật (xem [eslint.config.mjs](eslint.config.mjs)):

| Vi phạm | Rule |
|---|---|
| `waitForTimeout`, `waitForSelector`, `networkidle` | `playwright/no-wait-for-*`, `no-networkidle` |
| `page.$`, `$$`, `$eval` | `playwright/no-element-handle`, `no-eval` |
| `test.only`, `page.pause()` | `playwright/no-focused-test`, `no-page-pause` |
| `if/else` trong test, `expect` có điều kiện | `playwright/no-conditional-in-test`, `no-conditional-expect` |
| Test không có assertion | `playwright/expect-expect` |
| `expect(await x.isVisible())` | `playwright/prefer-web-first-assertions` |
| `click({ force: true })` | `playwright/no-force-option` |
| Selector CSS `.class` / `#id` / `:nth-` | `no-restricted-syntax` |
| Title không bắt đầu bằng `TC-xxx` | `no-restricted-syntax` |

## Script mẫu

[tests/auth/login.spec.ts](tests/auth/login.spec.ts) và [tests/a11y/login.a11y.spec.ts](tests/a11y/login.a11y.spec.ts) là ví dụ đầy đủ cho REQ-001, có traceability, tag, page object, `test.step` và assertion cả kết quả chính lẫn side effect.

Đây là template: chúng giả định một ứng dụng có `/login` và `/dashboard`, **không** giả định ứng dụng đó đang chạy tại `localhost:3000`. Thay route, locator và test data cho đúng sản phẩm thật.
