# Test Cases: REQ-001 Sign in with email and password

Requirement: `requirements/REQ-001-sign-in.md` (v1.1)
Automation plan: `test-cases/REQ-001-sign-in.automation-plan.md`

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | `playwright/tests/auth/login.spec.ts` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-002 | TC-003 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-003 | TC-004 | Yes | `playwright/tests/auth/login.spec.ts` | P2 |
| REQ-001 | AC-004 | TC-005 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-005 | TC-006 | Yes | `playwright/tests/auth/login.spec.ts` | P0 |
| REQ-001 | AC-006 | TC-007 | Yes | `playwright/tests/a11y/login.a11y.spec.ts` | P2 |
| REQ-001 | AC-006 | TC-008 | Yes | `playwright/tests/a11y/login.a11y.spec.ts` | P2 |
| REQ-001 | AC-007 | TC-009 | No | - | P1 |
| REQ-001 | AC-004 | TC-010 | No | - | P2 |
| REQ-001 | AC-006 | TC-011 | No | - | P2 |
| REQ-001 | AC-002 | TC-012 | Candidate | - | P2 |
| REQ-001 | AC-001 | TC-013 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-003 | TC-014 | Candidate | - | P2 |
| REQ-001 | AC-002 | TC-015 | Candidate | - | P2 |
| REQ-001 | AC-006 | TC-016 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-008 | TC-017 | Yes | `playwright/tests/auth/login.spec.ts` | P2 |
| REQ-001 | AC-009 | TC-018 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |
| REQ-001 | AC-010 | TC-019 | Yes | `playwright/tests/auth/login.spec.ts` | P1 |

## Test data and environment

- Environment: staging, `BASE_URL` (xem `playwright/.env.example`)
- User/role: `TEST_USER_EMAIL` (admin), `TEST_VIEWER_EMAIL` (viewer)

## Test cases

### TC-001: Đăng nhập thành công đưa người dùng vào dashboard

- Type: Functional | Priority: P0 | Technique: EP (lớp hợp lệ)
- Automation: Yes | Tags: `@smoke @p0 @journey`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, nhập email và password hợp lệ, bấm `Sign in` | Chuyển sang `/dashboard`, heading `Dashboard` và cookie session hiển thị |

### TC-002: Sai password bị từ chối, không lộ trường nào sai

- Type: Security | Priority: P1 | Technique: EP (lớp không hợp lệ)
- Automation: Yes | Tags: `@p1 @security`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, nhập email đúng + password sai, submit | Hiển thị `Invalid email or password`, vẫn ở `/login` |

### TC-003: Email không tồn tại trả về đúng thông báo như sai password

- Type: Security | Priority: P1 | Technique: Decision table
- Automation: Yes | Tags: `@p1 @security`

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, nhập email chưa đăng ký + password bất kỳ, submit | Giống hệt TC-002: `Invalid email or password` |

### TC-004: Email sai định dạng bị chặn ở client

- Type: Validation | Priority: P2 | Technique: EP + BVA
- Automation: Yes | Tags: `@p2`
- **Capabilities**: boundary

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, kiểm chứng `expectBoundaryRejected` với email sai định dạng | Lỗi validation hiển thị tại trường, không gửi request lên server |

### TC-005: Session tồn tại qua reload

- Type: Functional | Priority: P1 | Technique: State transition
- Automation: Yes | Tags: `@p1`
- **Capabilities**: persistence

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập thành công và gọi `expectStatePersistence` tải lại trang | Vẫn ở `/dashboard`, heading `Dashboard` hiển thị bền vững |

### TC-006: Chưa đăng nhập không vào được dashboard

- Type: Security | Priority: P0 | Technique: Error guessing
- Automation: Yes | Tags: `@p0 @security`

| Step | Action | Expected result |
|---|---|---|
| 1 | Truy cập thẳng `/dashboard` khi chưa đăng nhập | Bị chuyển về `/login`, không thấy dữ liệu dashboard |

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
| 1 | Mở `/login`, bấm Tab lần lượt qua Email -> Password -> Sign in | Focus di chuyển đúng thứ tự |

### TC-009: Khoá tài khoản sau 5 lần thử sai

- Type: Security | Priority: P1 | Technique: BVA (lần thứ 5 và 6)
- **Automation: No** - xem mục "Case không automation"

| Step | Action | Expected result |
|---|---|---|
| 1 | Thử sai password 5 lần liên tiếp rồi thử lần thứ 6 | Bị từ chối, thông báo khoá 15 phút |

### TC-010: Session hết hạn sau 24 giờ không hoạt động

- Type: Functional | Priority: P2 | Technique: BVA (24h, 24h+1m)
- **Automation: No** - cần tua thời gian server

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập, để yên hơn 24h rồi thao tác bất kỳ | Bị đẩy về `/login` |

### TC-011: Screen reader đọc đúng nhãn và thông báo lỗi

- Type: Accessibility | Priority: P2 | Technique: Manual exploratory
- **Automation: No** - cần đánh giá bằng NVDA/VoiceOver

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login` bằng NVDA và submit sai credential | Đọc đúng nhãn và thông báo lỗi live region |

### TC-012: Biên độ dài password (8 / 64 / 65 ký tự)

- Type: Boundary | Priority: P2 | Technique: BVA
- **Automation: Candidate** - chờ expose test id cho lỗi Password

| Step | Action | Expected result |
|---|---|---|
| 1 | Nhập password 7, 8, 64, 65 ký tự | 7 và 65 báo lỗi; 8 và 64 hợp lệ |

### TC-013: Thuộc tính bảo mật của cookie session

- Type: Security | Priority: P1 | Technique: Error guessing
- Automation: Yes | Tags: `@p1 @security`

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng nhập thành công, đọc cookie session | Có `HttpOnly`, `Secure`, `SameSite=Lax` |

### TC-014: Kiểm thử độ dài email tại các điểm biên (254 và 255 ký tự)

- Type: Functional | Priority: P2 | Technique: BVA
- Automation: Candidate | Tags: `@wip @p2`

| Step | Action | Expected result |
|---|---|---|
| 1 | Nhập email dài 254 và 255 ký tự | 254 hợp lệ; 255 báo lỗi validation |

### TC-015: Kiểm thử độ dài mật khẩu tại các điểm biên mở rộng (7, 8, 64, 65 ký tự)

- Type: Functional | Priority: P2 | Technique: BVA
- Automation: Candidate | Tags: `@wip @p2`

| Step | Action | Expected result |
|---|---|---|
| 1 | Nhập password 7, 8, 64, 65 ký tự | 7 và 65 báo lỗi; 8 và 64 chấp nhận |

### TC-016: Kiểm chứng bố cục hình học form đăng nhập và tên tiếp cận tương tác

- Type: UI/UX & Accessibility | Priority: P1 | Technique: DOM Geometry & A11y Audit
- Automation: Yes | Tags: `@p1 @ui @a11y`
- **Capabilities**: ui-geometry, a11y

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, chạy `expectNoHorizontalScroll`, `expectNoTextOverflow`, `expectNotOccluded`, `expectInteractiveA11y` | Không tràn ngang, không cắt chữ, nút `Sign in` không bị che khuất và đủ accessible name |

### TC-017: Kiểm chứng giao diện đăng nhập nguyên vẹn trên Desktop, Tablet và Mobile

- Type: Responsive UI | Priority: P2 | Technique: Multi-Viewport Matrix
- Automation: Yes | Tags: `@p2 @ui`
- **Capabilities**: responsive

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở `/login`, chạy `expectResponsiveIntegrity` với `requiredLocators` và `optionalLocators` | Các trường bắt buộc hiển thị nguyên vẹn qua mọi viewport |

### TC-018: Kiểm chứng chống gửi trùng khi nhấn đúp liên tiếp vào nút đăng nhập

- Type: Concurrency & Idempotency | Priority: P1 | Technique: Race Condition Probe
- Automation: Yes | Tags: `@p1 @security`
- **Capabilities**: idempotency

| Step | Action | Expected result |
|---|---|---|
| 1 | Điền credential hợp lệ và gọi `expectIdempotentSubmit` trên nút `Sign in` | Phát sinh tối đa 1 request `POST /api/auth/login` |

### TC-019: Kiểm chứng escape an toàn chuỗi XSS trong thông báo lỗi đăng nhập

- Type: Security | Priority: P1 | Technique: Fault Injection (XSS)
- Automation: Yes | Tags: `@p1 @security`
- **Capabilities**: xss

| Step | Action | Expected result |
|---|---|---|
| 1 | Chạy `expectSafeXssRender` với `XSS_PAYLOADS` trên trường `Email` và vùng `errorMessage` | Không thực thi script và không xuất hiện phần tử HTML độc hại trong `errorMessage` |

## Case không automation

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-009 | Làm khoá tài khoản 15 phút gây nhiễu khi chạy song song; chờ Q-003. | Test thủ công mỗi release + monitoring |
| TC-010 | Cần chờ 24h hoặc tua thời gian server; staging chưa hỗ trợ. | Test ở tầng API/unit của module session |
| TC-011 | Cần đánh giá bằng screen reader thật (NVDA/VoiceOver). | TC-007 + TC-008 + TC-016 phủ phần tự động |
