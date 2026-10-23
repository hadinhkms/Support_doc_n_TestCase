---
id: REQ-001
title: Sign in with email and password
status: Ready for Test
version: 1.1
risk: High
owner: Auth squad
slug: sign-in
test_cases: test-cases/REQ-001-sign-in.md
---

# REQ-001: Sign in with email and password

- **Status**: Ready for Test
- **Owner**: Auth squad / PO: @product-minh
- **Version**: 1.1
- **Risk**: High
- **Related pages/modules**: `/login`, `/dashboard`, `POST /api/auth/login`, session cookie
- **Source**: Product requirement
- **Page exposure**: Public
- **UI coverage**: Required
- **XSS applicability**: Applicable

> Đây là **ví dụ mẫu chuẩn (Gold Standard Reference) chạy được end-to-end** của toàn bộ luồng
> `REQ -> AC -> TC -> AUTO` tích hợp đầy đủ 4 lớp bảo vệ Deep Bug Hunting.

## Business goal

Người dùng đã có tài khoản cần đăng nhập để truy cập dữ liệu riêng của mình.
Đây là cổng vào của toàn bộ sản phẩm: lỗi ở đây chặn mọi luồng khác và là bề mặt
tấn công chính, nên được xếp Risk High.

## Coverage notes

| Aspect | Status | Notes |
|---|---|---|
| UI/UX Geometry | Required | `expectNoHorizontalScroll`, `expectNoTextOverflow`, `expectNotOccluded`, `expectInteractiveA11y`, `expectResponsiveIntegrity` |
| XSS Security | Applicable | `expectSafeXssRender` với `XSS_PAYLOADS` trên vùng thông báo lỗi đăng nhập |
| Idempotency | Required | `expectIdempotentSubmit` chống gửi trùng `POST /api/auth/login` khi nhấn đúp |
| State Persistence | Required | `expectStatePersistence` kiểm chứng session bền vững sau `page.reload()` |

## Scope

### In scope

- Đăng nhập bằng email + password trên web.
- Thông báo lỗi khi credential không hợp lệ và escape an toàn trước XSS.
- Duy trì session sau khi đăng nhập và tải lại trang.
- Chặn truy cập trang cần đăng nhập khi chưa đăng nhập.
- Giới hạn số lần thử sai và chống gửi trùng khi nhấn liên tiếp.
- Đảm bảo bố cục hình học, khả năng tiếp cận (A11y) và hiển thị đa kích thước màn hình.

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

### AC-003: Email sai định dạng bị chặn ở client

**Given** người dùng đang ở `/login`
**When** nhập email sai định dạng (thiếu `@` hoặc thiếu domain) và submit
**Then** hiển thị lỗi validation ngay tại trường Email, không gửi request lên server

### AC-004: Session tồn tại qua reload

**Given** người dùng vừa đăng nhập thành công
**When** tải lại trang
**Then** vẫn ở trạng thái đã đăng nhập, không bị đẩy về `/login`

### AC-005: Chặn truy cập khi chưa đăng nhập

**Given** người dùng chưa đăng nhập
**When** truy cập trực tiếp `/dashboard`
**Then** bị chuyển về `/login` và không thấy bất kỳ dữ liệu nào của dashboard

### AC-006: Màn đăng nhập đạt chuẩn hình học giao diện và accessibility

**Given** người dùng mở `/login` bằng chuột, bàn phím hoặc screen reader
**When** kiểm tra hình học phần tử, cây tiếp cận và quét WCAG 2.1 mức A/AA
**Then** không tràn ngang, không cắt chữ, nút `Sign in` không bị che khuất, các điều khiển có đủ accessible name và thứ tự Tab chuẩn

### AC-007: Giới hạn số lần thử sai

**Given** một email đã thử sai 5 lần trong vòng 15 phút
**When** thử đăng nhập lần thứ 6
**Then** tài khoản bị khoá tạm 15 phút và hiển thị thông báo kèm thời gian mở khoá

### AC-008: Giao diện đăng nhập tương thích đa kích thước màn hình

**Given** người dùng mở `/login` trên Desktop (`1440x900`), Tablet (`768x1024`) và Mobile (`375x667`)
**When** thay đổi kích thước viewport qua các mốc chuẩn
**Then** các trường `Email`, `Password`, `Sign in` luôn hiển thị nguyên vẹn, không tràn khung ngang

### AC-009: Chống gửi trùng khi nhấn liên tiếp vào nút đăng nhập

**Given** người dùng đã nhập email và password hợp lệ tại `/login`
**When** nhấn đúp liên tiếp vào nút `Sign in`
**Then** nút khóa trạng thái đang xử lý và trình duyệt gửi tối đa 1 request `POST /api/auth/login`

### AC-010: Hiển thị thông báo lỗi an toàn trước mã độc XSS

**Given** người dùng nhập chuỗi chứa payload HTML/script vào trường `Email` tại `/login`
**When** nhấn `Sign in` và hệ thống hiển thị thông báo lỗi
**Then** chuỗi đầu vào được escape an toàn, không phát sinh dialog hay phần tử thực thi mã độc

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Email | `user@example.com` | `not-an-email`, rỗng | 254 ký tự (max), 255 | Lỗi validation tại trường, không submit | TC-004, TC-014 |
| Password | 8-64 ký tự | rỗng, 7 ký tự | 8, 64, 65 | 7 và 65 -> lỗi validation; 8 và 64 -> chấp nhận | TC-012, TC-015 |
| Failed attempts | 1-5 | - | 5, 6 | Lần 6 -> khoá 15 phút (AC-007) | TC-002, TC-009 |
| Session idle | < 24h | - | 24h, 24h+1m | Quá 24h -> đẩy về `/login` | TC-005, TC-010 |
| Layout & Responsive | Desktop/Tablet/Mobile | Tràn ngang, đè nút | 375px - 1440px | Hiển thị nguyên vẹn, đủ nhãn A11y | TC-016, TC-017 |
| Submit & XSS Guard | 1 lần nhấn, chuỗi thường | Double-click, payload XSS | 2 lần nhấn < 50ms | Tối đa 1 POST, escape XSS an toàn | TC-018, TC-019 |

## Non-functional expectations

- Performance: phản hồi đăng nhập p95 < 1s ở môi trường staging.
- Accessibility: WCAG 2.1 AA (AC-006).
- Security/permission: thông báo lỗi chung (AC-002); cookie `HttpOnly` + `Secure` + `SameSite=Lax`; chống XSS (AC-010).

## Open questions and assumptions

- [x] Q-004: Thông báo lỗi có phân biệt "email không tồn tại" không? -> **Không**, dùng chung một thông báo (đã chốt 2026-09-19).

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| Thông báo lỗi chung cho cả 2 trường hợp sai | Chốt trong buổi refinement 2026-09-19 | High | Confirmed |
| Bộ kiểm chứng Deep Bug Hunting (AC-006, AC-008..AC-010) | Chuẩn hóa từ Plan 14 (v1.2) | High | Confirmed |

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | 2026-09-19 | Bản đầu tiên | - | - |
| 1.1 | 2026-10-23 | Nâng cấp chuẩn Deep Bug Hunting (AC-008..AC-010, TC-016..TC-019) | AC-003..AC-010 / TC-004..TC-019 | Full |
