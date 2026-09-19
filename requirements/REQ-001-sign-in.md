---
id: REQ-001
title: Sign in with email and password
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
slug: sign-in
test_cases: test-cases/REQ-001-sign-in.md
---

# REQ-001: Sign in with email and password

- Status: Ready for Test
- Owner: Auth squad / PO: @product-minh
- Version: 1.0
- Risk: High
- Related pages/modules: `/login`, `/dashboard`, `POST /api/auth/login`, session cookie
- Source: Product requirement

> Đây là **ví dụ mẫu chạy được end-to-end** của toàn bộ luồng
> `REQ -> AC -> TC -> AUTO`. Ứng dụng thật chưa tồn tại tại `localhost:3000`;
> giữ file này làm khuôn mẫu khi viết requirement đầu tiên cho dự án thật.

## Business goal

Người dùng đã có tài khoản cần đăng nhập để truy cập dữ liệu riêng của mình.
Đây là cổng vào của toàn bộ sản phẩm: lỗi ở đây chặn mọi luồng khác và là bề mặt
tấn công chính, nên được xếp Risk High.

## Scope

### In scope

- Đăng nhập bằng email + password trên web.
- Thông báo lỗi khi credential không hợp lệ.
- Duy trì session sau khi đăng nhập.
- Chặn truy cập trang cần đăng nhập khi chưa đăng nhập.
- Giới hạn số lần thử sai.

### Out of scope

- Đăng ký tài khoản mới (REQ-002).
- Quên mật khẩu / đặt lại mật khẩu (REQ-003).
- SSO, OAuth, đăng nhập bằng mạng xã hội.
- Xác thực hai yếu tố (backlog).

## Actors and preconditions

- Actor/role: `admin` (quyền đầy đủ), `viewer` (quyền đọc).
- Preconditions: tài khoản đã tồn tại và ở trạng thái `active`.
- Test data: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`, `TEST_VIEWER_EMAIL` / `TEST_VIEWER_PASSWORD`
  (xem `playwright/.env.example`).

## Acceptance criteria

### AC-001: Đăng nhập thành công với credential hợp lệ

**Given** người dùng có tài khoản `active` và đang ở `/login`
**When** nhập đúng email + password và bấm `Sign in`
**Then** được chuyển tới `/dashboard`, thấy heading `Dashboard` và cookie session được thiết lập

### AC-002: Credential sai bị từ chối với thông báo chung

**Given** người dùng đang ở `/login`
**When** nhập sai password, hoặc nhập email không tồn tại
**Then** hiển thị thông báo `Invalid email or password`, ở lại `/login`, không tạo session

Thông báo phải **giống hệt nhau** cho hai trường hợp, để không lộ email nào đã đăng ký
(user enumeration).

### AC-003: Email sai định dạng bị chặn ở client

**Given** người dùng đang ở `/login`
**When** nhập email sai định dạng (thiếu `@` hoặc thiếu domain) và submit
**Then** hiển thị lỗi validation ngay tại trường Email, không gửi request lên server

### AC-004: Session tồn tại qua reload

**Given** người dùng vừa đăng nhập thành công
**When** tải lại trang
**Then** vẫn ở trạng thái đã đăng nhập, không bị đẩy về `/login`

Session hết hạn sau 24 giờ không hoạt động.

### AC-005: Chặn truy cập khi chưa đăng nhập

**Given** người dùng chưa đăng nhập
**When** truy cập trực tiếp `/dashboard`
**Then** bị chuyển về `/login` và không thấy bất kỳ dữ liệu nào của dashboard

### AC-006: Màn đăng nhập đạt chuẩn accessibility

**Given** người dùng dùng bàn phím hoặc screen reader
**When** mở `/login`
**Then** trang không có vi phạm WCAG 2.1 mức A/AA, và thứ tự Tab là Email -> Password -> Sign in

### AC-007: Giới hạn số lần thử sai

**Given** một email đã thử sai 5 lần trong vòng 15 phút
**When** thử đăng nhập lần thứ 6
**Then** tài khoản bị khoá tạm 15 phút và hiển thị thông báo kèm thời gian mở khoá

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | `user@example.com` | `not-an-email`, rỗng | 254 ký tự (max), 255 | Lỗi validation tại trường, không submit | TC-004 |
| Password | 8-64 ký tự | rỗng, 7 ký tự | 8, 64, 65 | 7 và 65 -> lỗi validation; 8 và 64 -> chấp nhận | TC-012 |
| Failed attempts | 1-5 | - | 5, 6 | Lần 6 -> khoá 15 phút (AC-007) | TC-009 |
| Session idle | < 24h | - | 24h, 24h+1m | Quá 24h -> đẩy về `/login` | TC-010 |

## Non-functional expectations

- Performance: phản hồi đăng nhập p95 < 1s ở môi trường staging.
- Accessibility: WCAG 2.1 AA (AC-006).
- Security/permission: thông báo lỗi chung (AC-002); password không xuất hiện trong URL, log
  hay response; cookie session `HttpOnly` + `Secure` + `SameSite=Lax`.
- Browser/device: Chrome, Firefox, Safari (2 bản mới nhất) + Chrome trên Android.

## Open questions and assumptions

- [ ] Q-001: Lần thử sai đếm theo email hay theo IP? - Owner: @product-minh - Due: 2026-09-26
- [ ] Q-002: Sau khi khoá, người dùng có nhận email cảnh báo không? - Owner: @product-minh - Due: 2026-09-26
- [ ] Q-003: Có CAPTCHA trước khi khoá hay khoá thẳng? Ảnh hưởng tới khả năng automation TC-009. - Owner: @auth-dev - Due: 2026-09-26
- [x] Q-004: Thông báo lỗi có phân biệt "email không tồn tại" không? -> **Không**, dùng chung một thông báo (đã chốt 2026-09-19).

Giả định đang áp dụng: `data-testid="email-error"` tồn tại trên trường Email.
Nếu dev chưa thêm, TC-004 chưa chạy được — xem `docs/selector-convention.md`, mục "Yêu cầu gửi dev".

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| Thông báo lỗi chung cho cả 2 trường hợp sai | Chốt trong buổi refinement 2026-09-19 | High | Confirmed |
| Session hết hạn sau 24h | API contract `POST /api/auth/login`, `maxAge` | Medium | Inferred |
| Thứ tự Tab Email -> Password -> Sign in | Design spec Figma, frame `Login / Desktop` | Medium | Inferred |
| Khoá 15 phút sau 5 lần sai | Chưa có tài liệu, chỉ nghe trong họp | Low | Needs confirmation |

## Gaps found from automation

- Untested behavior: session hết hạn sau 24h (AC-004) — chưa có cách tua thời gian ở môi trường test.
- Weak or missing assertion: chưa assert thuộc tính cookie (`HttpOnly`, `Secure`, `SameSite`).
- Hard-coded or unsafe test data: không có — toàn bộ credential đi qua `requireEnv()`.
- Hidden dependency/setup: `tests/auth.setup.ts` giả định login thành công; nếu tài khoản bị khoá
  bởi AC-007 thì toàn bộ suite fail theo. Cần tài khoản riêng cho test AC-007.

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | 2026-09-19 | Bản đầu tiên | - | - |

ID (`REQ-xxx`, `AC-xxx`) không được đổi sau khi đã dùng trong test case hoặc script.
Thay đổi lớn -> tăng version, thêm dòng ở bảng trên và rà lại các TC bị ảnh hưởng.

## Related artifacts

- Test cases: `test-cases/REQ-001-sign-in.md`
- Automation plan: `test-cases/REQ-001-sign-in.automation-plan.md`
- Automation: `playwright/tests/auth/login.spec.ts`, `playwright/tests/a11y/login.a11y.spec.ts`
