# Test Cases: REQ-001 Sign in with email and password

Requirement: `requirements/REQ-001-sign-in.md` (v1.0)
Automation plan: `test-cases/REQ-001-sign-in.automation-plan.md`

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | `tests/auth/login.spec.ts` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | `tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-002 | TC-003 | Yes | `tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-003 | TC-004 | Yes | `tests/auth/login.spec.ts` | P2 |
| REQ-001 | AC-004 | TC-005 | Yes | `tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-005 | TC-006 | Yes | `tests/auth/login.spec.ts` | P0 |
| REQ-001 | AC-006 | TC-007 | Yes | `tests/a11y/login.a11y.spec.ts` | P2 |
| REQ-001 | AC-006 | TC-008 | Yes | `tests/a11y/login.a11y.spec.ts` | P2 |
| REQ-001 | AC-007 | TC-009 | No | - | P1 |
| REQ-001 | AC-004 | TC-010 | No | - | P2 |
| REQ-001 | AC-006 | TC-011 | No | - | P2 |
| REQ-001 | AC-002 | TC-012 | Candidate | - | P2 |
| REQ-001 | AC-001 | TC-013 | Yes | `tests/auth/login.spec.ts` | P1 |

## Test data and environment

- Environment: staging, `BASE_URL` (xem `playwright/.env.example`)
- User/role: `TEST_USER_EMAIL` (admin), `TEST_VIEWER_EMAIL` (viewer)
- Seed data: tài khoản cố định, tạo sẵn ở staging, không xoá sau khi chạy
- Cleanup: không tạo dữ liệu mới nên không cần cleanup. Riêng TC-009 làm khoá tài khoản
  nên **phải dùng tài khoản riêng**, không dùng `TEST_USER_EMAIL`.

## Test cases

### TC-001: Đăng nhập thành công đưa người dùng vào dashboard

- Type: Functional | Priority: P0 | Technique: EP (lớp hợp lệ)
- Automation: Yes | Tags: `@smoke @p0`
- Preconditions: tài khoản `active`, chưa đăng nhập
- Test data: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login` | Form hiện, nút `Sign in` khả dụng |
| 2 | Nhập email và password hợp lệ, bấm `Sign in` | Request được gửi |
| 3 | Quan sát điều hướng | URL chuyển sang `/dashboard`, heading `Dashboard` hiển thị |
| 4 | Quan sát side effect | Menu tài khoản hiển thị; tồn tại cookie session |

### TC-002: Sai password bị từ chối, không lộ trường nào sai

- Type: Security | Priority: P1 | Technique: EP (lớp không hợp lệ)
- Automation: Yes | Tags: `@p1 @security`
- Test data: email hợp lệ + `invalidCredentials.wrongPassword`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login` | Form hiện |
| 2 | Nhập email đúng, password sai, submit | Request được gửi |
| 3 | Quan sát thông báo | `Invalid email or password` hiển thị trong vùng `role=alert` |
| 4 | Quan sát URL và session | Vẫn ở `/login`, không vào được dashboard |

### TC-003: Email không tồn tại trả về đúng thông báo như sai password

- Type: Security | Priority: P1 | Technique: Decision table (email tồn tại x password đúng)
- Automation: Yes | Tags: `@p1 @security`
- Test data: `invalidCredentials.unknownEmail`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, nhập email chưa đăng ký + password bất kỳ, submit | Request được gửi |
| 2 | So sánh thông báo với TC-002 | Giống hệt: `Invalid email or password` |

### TC-004: Email sai định dạng bị chặn ở client

- Type: Validation | Priority: P2 | Technique: EP + BVA
- Automation: Yes | Tags: `@p2`
- Test data: `not-an-email`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, nhập `not-an-email` và password bất kỳ, submit | Không có request lên server |
| 2 | Quan sát trường Email | Lỗi validation hiển thị tại trường, vẫn ở `/login` |

### TC-005: Session tồn tại qua reload

- Type: Functional | Priority: P1 | Technique: State transition
- Automation: Yes | Tags: `@p1`

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập thành công | Ở `/dashboard` |
| 2 | Reload trang | Vẫn ở `/dashboard`, heading `Dashboard` hiển thị, không bị đẩy về `/login` |

### TC-006: Chưa đăng nhập không vào được dashboard

- Type: Security | Priority: P0 | Technique: Error guessing (truy cập URL trực tiếp)
- Automation: Yes | Tags: `@p0 @security`
- Preconditions: context sạch, không có cookie

| Step | Action | Expected result |
|---|---|---|
| 1 | Truy cập thẳng `/dashboard` | Bị chuyển về `/login` |
| 2 | Quan sát nội dung trang | Không thấy heading `Dashboard` hay dữ liệu nào của dashboard |

### TC-007: Trang đăng nhập không vi phạm WCAG 2.1 A/AA

- Type: Accessibility | Priority: P2 | Technique: Automated scan (axe-core)
- Automation: Yes | Tags: `@a11y @p2`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, chạy axe với tag `wcag2a, wcag2aa, wcag21a, wcag21aa` | Danh sách violation rỗng |

### TC-008: Form thao tác được hoàn toàn bằng bàn phím

- Type: Accessibility | Priority: P2 | Technique: State transition (focus order)
- Automation: Yes | Tags: `@a11y @p2`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, bấm Tab lần 1 | Focus ở trường Email |
| 2 | Tab lần 2 | Focus ở trường Password |
| 3 | Tab lần 3 | Focus ở nút `Sign in` |

### TC-009: Khoá tài khoản sau 5 lần thử sai

- Type: Security | Priority: P1 | Technique: BVA (lần thứ 5 và 6)
- **Automation: No** - xem lý do ở mục "Case không automation"
- Preconditions: **tài khoản chuyên dụng**, không dùng tài khoản của suite chính

| Step | Action | Expected result |
|---|---|---|
| 1 | Thử sai password 5 lần liên tiếp | Mỗi lần: `Invalid email or password` |
| 2 | Thử lần thứ 6 với password ĐÚNG | Bị từ chối, thông báo khoá kèm thời gian mở khoá |
| 3 | Chờ hết 15 phút, đăng nhập đúng | Vào được `/dashboard` |

### TC-010: Session hết hạn sau 24 giờ không hoạt động

- Type: Functional | Priority: P2 | Technique: BVA (24h, 24h+1m)
- **Automation: No** - cần tua thời gian, môi trường test chưa hỗ trợ

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập, để yên hơn 24h | Không thao tác gì |
| 2 | Thao tác bất kỳ | Bị đẩy về `/login` |

### TC-011: Screen reader đọc đúng nhãn và thông báo lỗi

- Type: Accessibility | Priority: P2 | Technique: Manual exploratory
- **Automation: No** - cần đánh giá của con người (NVDA/VoiceOver)

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login` bằng NVDA | Đọc đúng nhãn `Email`, `Password`, nút `Sign in` |
| 2 | Submit sai credential | Thông báo lỗi được đọc lên (live region) |

### TC-012: Biên độ dài password (8 / 64 / 65 ký tự)

- Type: Boundary | Priority: P2 | Technique: BVA
- **Automation: Candidate** - chờ dev expose test id cho lỗi ở trường Password

| Step | Action | Expected result |
|---|---|---|
| 1 | Nhập password 7 ký tự | Lỗi validation |
| 2 | Nhập password 8 và 64 ký tự | Được chấp nhận, submit đi tiếp |
| 3 | Nhập password 65 ký tự | Lỗi validation |

### TC-013: Thuộc tính bảo mật của cookie session

- Type: Security | Priority: P1 | Technique: Error guessing
- Automation: Yes | Tags: `@p1 @security`
- Preconditions: đăng nhập thành công bằng `TEST_USER_EMAIL`
- Test data: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập thành công, đọc cookie session | Có `HttpOnly`, `Secure`, `SameSite=Lax` |

## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-009 | Làm khoá tài khoản 15 phút nên gây nhiễu cho test chạy song song; phụ thuộc rate limit của môi trường; còn chờ Q-003 (có CAPTCHA hay không). | Test thủ công mỗi release + monitoring số lần khoá trên production |
| TC-010 | Cần chờ 24h hoặc tua thời gian server; staging chưa hỗ trợ. | Test ở tầng API/unit của module session |
| TC-011 | Cần đánh giá của con người bằng screen reader thật; quét tự động chỉ bắt được khoảng 30-40% lỗi a11y. | TC-007 + TC-008 phủ phần máy kiểm được; phần còn lại test thủ công mỗi quý |

## Coverage notes

- Positive: TC-001 (credential hợp lệ), TC-005 (session giữ qua reload).
- Negative: TC-002, TC-003 (credential sai), TC-004 (định dạng sai).
- Boundary: TC-012 (độ dài password), TC-009 (lần thử thứ 5/6), TC-010 (24h).
- Permission/state: TC-006 (chưa đăng nhập), TC-009 (trạng thái bị khoá).
- Accessibility: TC-007, TC-008 (tự động), TC-011 (thủ công).
- Uncovered risk:
  - Hết hạn session 24h chỉ kiểm được bằng tay (TC-010), rủi ro session sống quá hạn không bị phát hiện.
  - Chưa có test cho concurrency: cùng một tài khoản đăng nhập ở 2 thiết bị.
  - Chưa có test cho email dài 254/255 ký tự, dù bảng validation của REQ-001 đã nêu.
  - Chưa kiểm password không bị ghi vào log/response, cần kiểm ở tầng backend.
