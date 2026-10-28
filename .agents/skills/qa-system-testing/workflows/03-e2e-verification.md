# Workflow 03: Kiểm thử E2E Liên Hệ Thống & Đối soát Dữ liệu (Diff-Aware & Multi-Point Verification)

## Mục tiêu
Xác minh tính toàn vẹn của luồng nghiệp vụ xuyên suốt từ giao diện người dùng (Multi-portal UI), đi qua các lớp mạng/API và lưu trữ chính xác xuống cơ sở dữ liệu (Database / Persistent State), đồng thời tuân thủ nghiêm ngặt **Cổng Xác Minh Bug Thực (Rule 14)**.

---

## Quy trình Thực thi 5 Bước (Execution & Verification Loop)

### Bước 1: Xác định Phạm vi Ảnh hưởng theo Diff & Traceability (Diff-Aware Scoping)
1. **Phân tích thay đổi mã nguồn (`git diff`):**
   - Xác định các Controller, Service, API Route, Database Migration, Shared Component và UI Route bị tác động trực tiếp hoặc gián tiếp.
   - Đánh giá phạm vi ảnh hưởng liên cổng (*Cross-Portal Impact*): Thay đổi ở API/Model này có làm gãy trang danh sách, báo cáo hoặc webhook ở Portal khác không?
2. **Truy vết ngược trong QA Workspace:**
   - Chạy lệnh phân tích phạm vi ảnh hưởng và lỗ hổng hiện tại:
     ```bash
     npm run qa:impact -- <REQ-id>
     npm run qa:gaps
     ```
   - Chọn chế độ chạy phù hợp:
     - **Quick (PR / Diff-focused):** Chạy các spec trực tiếp gắn với `@REQ-xxx` bị ảnh hưởng và bộ `@smoke|@p0`.
     - **Standard (Feature / Cross-portal):** Chạy toàn bộ spec của domain liên quan (cả API + UI + A11y).
     - **Exhaustive (Release / Nightly):** Chạy full regression đa trình duyệt (`chromium`, `firefox`, `webkit`, `mobile-chrome`).

---

### Bước 2: Thiết lập Dữ liệu Kiểm thử Cô lập (Test Data Seeding & Isolation)
- Tạo dữ liệu test độc lập cho từng Worker/Test bằng `APIRequestContext` (`ApiClient` trong `playwright/tests/api/api-client.ts`) với định danh duy nhất (`crypto.randomUUID()`, `Date.now()`) và tiền tố rõ ràng (VD: `[QA_AUTO]`).
- Với kịch bản **Multi-Portal** (VD: Employer đăng tin ở Portal A $\to$ Admin duyệt ở Portal B $\to$ Seeker ứng tuyển ở Portal C):
  - Sử dụng API hoặc Multi-Context (`browser.newContext({ storageState })`) để thiết lập trạng thái nhanh ở các bước tiền đề, chỉ dùng UI ở đúng điểm cần kiểm chứng hành vi giao diện.
- Đảm bảo dọn dẹp dữ liệu (`cleanup` idempotent trong `try / finally` hoặc `afterEach`) để mọi test chạy song song (`fullyParallel: true`) không làm bẩn môi trường.

---

### Bước 3: Thực thi & Kiểm chứng Đa điểm (Multi-Point Assertion)
Mỗi kịch bản E2E hoặc Integration quan trọng phải kiểm chứng đồng thời **3 lớp bằng chứng** (tuyệt đối không viết test chỉ có `toHaveURL` hoặc `toBeVisible` đơn lẻ):

1. **Lớp Giao diện & Hình học (UI & Geometry Layer):**
   - Kiểm tra dữ liệu nghiệp vụ hiển thị chính xác trên UI, trạng thái `disabled`/`loading` của nút bấm khi đang gửi request.
   - Áp dụng bộ kiểm chứng hình học trong `playwright/tests/support/ui-checks.ts`:
     - `expectNoHorizontalScroll(page)`
     - `expectNoTextOverflow(rootLocator)`
     - `expectNotOccluded(targetLocator)`
     - `expectInteractiveA11y(rootLocator)`
     - `expectResponsiveIntegrity(page, { requiredLocators, optionalLocators })`
   - Với luồng hành trình chính (`@journey`), ghi lại ảnh chụp tại các mốc chuyển trạng thái (**Milestone States**: Khởi tạo $\to$ Nhập liệu $\to$ Submit $\to$ Hoàn tất) qua `captureJourneyStep()`.

2. **Lớp Mạng, Runtime & Chịu lỗi (Network, API & Resilience Layer):**
   - Fixture `runtimeTrap` tự động giám sát và chặn mọi lỗi ngầm: `console.error`, `pageerror` (Uncaught Exception), và HTTP `5xx` trên các request cùng origin.
   - Áp dụng các hàm bảo vệ chuyên sâu trong `playwright/tests/support/deep-guards.ts`:
     - Chống gửi trùng khi nhấn đúp: `expectIdempotentSubmit(page, trigger, urlPattern)`
     - Bảo toàn dữ liệu form khi lỗi mạng/5xx: `expectNetworkFaultRecovery(page, trigger, options)`
     - Chống XSS tại điểm render: `expectSafeXssRender(page, inputAction, { sinkLocator })`
     - Chống ghi đè dữ liệu giữa 2 tab: `expectMultiTabConcurrency(page, scenario)`

3. **Lớp Bền vững Trạng thái & Cơ sở dữ liệu (Database & State Persistence Layer):**
   - **Trên UI:** Dùng `expectStatePersistence(page, assertFn)` để chứng minh dữ liệu sau khi lưu không phải chỉ là Optimistic UI tạm bợ mà bền vững sau khi `page.reload()`.
   - **Qua API (Read-After-Write / Read-After-Reject):** Gọi `GET` trực tiếp (hoặc kiểm tra ở Portal đối ứng) để xác nhận bản ghi đã cập nhật đúng trạng thái, hoặc không có thay đổi ngầm nào xảy ra sau một request bị từ chối (`400`/`403`/`409`/`422`).
   - **Dưới Database (Khi có kết nối SQL / DB Tool):** Truy vấn đối soát trực tiếp:
     - Bản ghi được ghi đúng bảng, đúng `status`, đúng khóa ngoại (`tenant_id`, `user_id`), và mốc thời gian (`created_at`, `updated_at` chuẩn UTC).
     - Không sinh bản ghi trùng lặp (duplicate rows) hoặc bản ghi mồ côi (orphan records) khi giao dịch lỗi giữa chừng (kiểm chứng tính nguyên tử `ACID Transaction`).
     - Bản ghi lịch sử/kiểm toán (`audit_logs` / `outbox_events`) được ghi nhận đầy đủ.

---

### Bước 4: Cổng Xác Minh Bug Thực & Báo Cáo Lỗi Chuẩn Hóa (Rule 14 Gate)
Khi phát hiện một test fail hoặc hành vi bất thường, **bắt buộc thực hiện 3 bước lọc nhiễu của Rule 14** trước khi kết luận là Bug:

1. **Bước 4.1 — Loại trừ lỗi do Test Script / Môi trường:**
   - Kiểm tra xem lỗi có phải do sai locator, thiếu `await`, bấm khi trang chưa hydrate, dữ liệu test bị trùng từ lần chạy trước, hay cấu hình thiếu biến môi trường không. Nếu do test $\to$ sửa test ngay, **cấm báo là bug của ứng dụng**.
2. **Bước 4.2 — Xác minh khả năng tái hiện (Reproducibility Verification):**
   - Chạy lại kịch bản trong trạng thái sạch (`npx playwright test <spec> --repeat-each=3` hoặc gọi lại API độc lập). Chỉ khi lỗi tái hiện nhất quán mới được công nhận là **Confirmed Bug (`BUG-xx`)**.
3. **Bước 4.3 — Bằng chứng kép & Trình bày Báo cáo Bug (Dual Proof):**
   - **Mục mô tả tình huống:** Đặt tên đúng là **`Bối cảnh nghiệp vụ`** (ngắn gọn, tự nhiên, dễ hình dung tác động tới người dùng/hệ thống).
   - **Bằng chứng thực thi:** Log từ `runtimeTrap`, cURL/HTTP status & payload thực tế, kết quả truy vấn DB thực tế so với mong đợi.
   - **Bằng chứng mã nguồn:** Chỉ rõ `file:line` gây lỗi (nếu có quyền đọc source app) hoặc chuỗi `Steps to Reproduce` tối giản.
   - **Bằng chứng hình ảnh (`Visual Evidence`):** Bắt buộc khoanh vùng **khung đỏ** trực tiếp vào vị trí bị sai bằng `captureAnnotatedBugEvidence` trong `playwright/tests/support/evidence.ts`.

---

### Bước 5: Chạy Cổng Kiểm Chứng Cuối (Final Quality Gates)
Sau khi cập nhật spec, test case hoặc requirement, chạy tuần tự:
1. Trong `playwright/`: `npm run verify` (đảm bảo pass TypeScript, ESLint và `playwright test --list`).
2. Ở thư mục gốc:
   ```bash
   npm run qa:matrix
   npm run qa:check
   npm test
   ```
3. Nếu vừa sửa lỗi hoặc bổ sung kiến thức kiểm thử mới, cân nhắc chạy `npm run qa:learn` theo quy trình của [qa-logic-gaps](../../qa-logic-gaps/SKILL.md) để lưu lại bài học vào Knowledge Base của dự án.
