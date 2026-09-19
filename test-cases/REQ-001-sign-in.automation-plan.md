# Automation Plan: REQ-001 Sign in with email and password

Requirement: `requirements/REQ-001-sign-in.md` (v1.0)
Test cases: `test-cases/REQ-001-sign-in.md`

## Candidate selection

Chấm 1-5 theo `docs/automation-strategy.md`. `Maintenance` chấm ngược: 5 = rẻ, 1 = đắt.
Ngưỡng đề xuất automation: tổng từ 17/25, hoặc là P0/P1 critical path.

| Test case | Frequency | Risk | Stability | Feasibility | Maintenance | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| TC-001 | 5 | 5 | 5 | 5 | 5 | 25 | Automate |
| TC-002 | 5 | 4 | 5 | 5 | 5 | 24 | Automate |
| TC-003 | 5 | 4 | 5 | 5 | 5 | 24 | Automate |
| TC-004 | 4 | 2 | 5 | 4 | 4 | 19 | Automate |
| TC-005 | 5 | 4 | 4 | 5 | 5 | 23 | Automate |
| TC-006 | 5 | 5 | 5 | 5 | 5 | 25 | Automate |
| TC-007 | 4 | 3 | 3 | 5 | 3 | 18 | Automate |
| TC-008 | 4 | 3 | 4 | 5 | 4 | 20 | Automate |
| TC-013 | 4 | 4 | 5 | 4 | 5 | 22 | Automate (sprint tới) |
| TC-012 | 3 | 2 | 4 | 3 | 4 | 16 | Hoãn - chờ test id ở trường Password |
| TC-009 | 3 | 5 | 1 | 2 | 2 | 13 | Không automation |
| TC-010 | 2 | 3 | 2 | 1 | 2 | 10 | Không automation |
| TC-011 | 2 | 3 | 2 | 1 | 2 | 10 | Không automation |

TC-013 dưới diện "chưa làm nhưng nên làm": đã có điểm đủ cao, đưa vào backlog automation
thay vì để trôi. TC-009 tuy Risk 5 nhưng Stability và Feasibility quá thấp - ghi rõ ở mục
"Case không automation" của file test case kèm cách bù đắp.

## Script contract

| Mục | Giá trị |
|---|---|
| Spec file | `playwright/tests/auth/login.spec.ts`, `playwright/tests/a11y/login.a11y.spec.ts` |
| Test title | `TC-xxx - AC-yyy <mô tả ngắn>` |
| Tag | `@smoke`, `@p0`..`@p3`, `@security`, `@a11y` |
| Page object | `tests/pages/login.page.ts`, `tests/pages/dashboard.page.ts` |
| Setup | Không dùng `auth.setup.ts` - các test này kiểm chứng chính luồng đăng nhập nên ghi đè `storageState` về rỗng |
| Steps | `test.step()` cho TC-001; các case ngắn viết thẳng |
| Assertions | Kết quả chính (URL + heading) và side effect (cookie session, menu tài khoản) |
| Cleanup | Không tạo dữ liệu nên không cần cleanup |
| Evidence on failure | trace, screenshot, video - cấu hình ở `playwright.config.ts` |

## Automation readiness checklist

- [x] Stable locator available - `getByRole` / `getByLabel`; riêng lỗi validation email dùng
      `data-testid="email-error"` (đang là giả định, xem REQ-001 mục Open questions).
- [x] Test data can be seeded and cleaned up - dùng tài khoản cố định qua biến môi trường.
- [x] No real secret/OTP/payment dependency.
- [x] Expected result is deterministic.
- [x] Test is independent and rerunnable - mỗi test tự `goto('/login')` từ context sạch.
- [x] Requirement and test case IDs are included in title/tag.

## Rủi ro của bản thân bộ automation

- `auth.setup.ts` là điểm hỏng tập trung: nếu tài khoản chính bị khoá (AC-007) thì toàn bộ
  suite fail theo. Giảm thiểu: TC-009 không automation và dùng tài khoản riêng khi test tay.
- `data-testid="email-error"` chưa được xác nhận tồn tại. Nếu dev không thêm, TC-004 phải đổi
  sang assert theo `role=alert` hoặc bị hoãn.
- Quét axe (TC-007) có thể đỏ khi design đổi màu/contrast mà không phải lỗi hồi quy chức năng.
  Không tự nới lỏng rule - mở issue với design.
