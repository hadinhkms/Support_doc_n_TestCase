# Danh mục Heuristics Săn lỗi Nghiệp vụ & UI/UX (Bug Hunting Heuristics)

Tài liệu tham chiếu cho skill `qa-logic-gaps` và hệ thống Học Chọn Lọc (`tools/qa/lib/learner.js`).
Mỗi mục gắn thẻ `<!-- staticRule: ... | coverage: ... -->` để đồng bộ với bộ kiểm tra tĩnh.

---

### [DH-01] Chống gửi trùng và thao tác lặp (Idempotency & Double-Submit)
<!-- staticRule: missing-idempotency-guard | coverage: partial -->
- **Category**: State & Concurrency
- **Trigger**: Màn hình có nút hành động tạo mới, thanh toán, gửi biểu mẫu hoặc cập nhật trạng thái (`POST`/`PUT`/`PATCH`/`DELETE`).
- **Failure Mode**: Nhấn đúp chuột liên tiếp (< 50ms) hoặc mạng chậm khiến client phát sinh nhiều request trùng lặp, tạo bản ghi nhân bản hoặc trừ tiền hai lần.
- **Actionable Check**: Khai báo `- **Capabilities**: idempotency` trong Test Case và dùng `await expectIdempotentSubmit(page, { submitLocator, urlPattern })` từ `support/deep-guards.ts`.

### [DH-02] Giá trị biên, chuỗi cực đại và định dạng dị biệt (BVA & Unicode Overflow)
<!-- staticRule: none | coverage: semantic -->
- **Category**: Data & BVA
- **Trigger**: Trường nhập số lượng, tiền tệ, ngày tháng hoặc chuỗi văn bản có giới hạn độ dài.
- **Failure Mode**: Bỏ sót biên `min - 1`, `max + 1`, chuỗi toàn khoảng trắng, số âm, hoặc chuỗi Unicode tổ hợp/Zero-Width/RTL (`UNICODE_OVERFLOW_PAYLOADS`) gây lỗi 500 hoặc tràn cột DB.
- **Actionable Check**: Khai báo `- **Capabilities**: boundary` và dùng `await expectBoundaryRejected(page, { inputLocator, submitLocator, errorLocator, invalidValues })` từ `support/deep-guards.ts`.

### [DH-03] Bền vững trạng thái sau khi tải lại trang (State Persistence After Reload)
<!-- staticRule: none | coverage: semantic -->
- **Category**: State & Concurrency
- **Trigger**: Thao tác cập nhật dữ liệu hiển thị ngay trên giao diện (Optimistic UI) hoặc lưu cấu hình người dùng.
- **Failure Mode**: Giao diện chỉ cập nhật tạm trong bộ nhớ Redux/React state mà chưa thực sự ghi xuống backend; sau khi `page.reload()` dữ liệu quay về giá trị cũ.
- **Actionable Check**: Khai báo `- **Capabilities**: persistence` và dùng `await expectStatePersistence(page, { act, verify })` từ `support/deep-guards.ts`.

### [DH-04] Đứt gãy bố cục hình học, che khuất tâm điểm và thiếu tên tiếp cận (UI Geometry & A11y)
<!-- staticRule: missing-ui-coverage | coverage: partial -->
- **Category**: Resilience & Recovery
- **Trigger**: Màn hình giao diện người dùng (`UI coverage: Required`) hiển thị bảng biểu, thẻ thông tin, thanh điều hướng cố định (`sticky`/`fixed`) hoặc modal.
- **Failure Mode**: Xuất hiện thanh cuộn ngang ngoài ý muốn, chữ bị cắt cụt không có tooltip, nút hành động bị header/toast che khuất tại tâm điểm (`elementFromPoint`), hoặc nút chỉ có icon mà thiếu `aria-label`.
- **Actionable Check**: Khai báo `- **Capabilities**: ui-geometry, a11y, responsive` và gọi bộ 5 hàm trong `support/ui-checks.ts`: `expectNoHorizontalScroll`, `expectNoTextOverflow`, `expectNotOccluded`, `expectInteractiveA11y`, `expectResponsiveIntegrity`.

### [DH-05] Tiêm nhiễm mã độc qua vùng hiển thị và đầu vào (XSS & Injection Sinks)
<!-- staticRule: missing-xss-coverage | coverage: partial -->
- **Category**: Security & Access
- **Trigger**: Tính năng nhận dữ liệu văn bản từ người dùng hoặc URL query và phản chiếu lại lên DOM (`XSS applicability: Applicable`).
- **Failure Mode**: Dữ liệu chứa `<script>`, `<img onerror=...>` hoặc `<svg onload=...>` được gán thẳng vào `innerHTML` mà không escape, dẫn tới thực thi mã độc hoặc phá vỡ cấu trúc DOM.
- **Actionable Check**: Khai báo `- **Capabilities**: xss` và dùng `await expectSafeXssRender(page, { inputLocator, submitLocator, sinkLocator })` với `XSS_PAYLOADS` từ `support/deep-guards.ts`.

### [DH-06] Rò rỉ lỗi ngầm trên Console, PageError và API 5xx (Silent Runtime Errors)
<!-- staticRule: none | coverage: semantic -->
- **Category**: Resilience & Recovery
- **Trigger**: Mọi kịch bản kiểm thử E2E tương tác với trang web và gọi API nền.
- **Failure Mode**: Giao diện bề ngoài vẫn chuyển trang hoặc hiển thị thông báo chung chung nhưng bên dưới phát sinh `Uncaught TypeError`, `console.error`, ảnh `<img>` gãy (`naturalWidth === 0`) hoặc API phụ trả về HTTP `>= 500`.
- **Actionable Check**: Luôn import `{ test, expect }` từ `fixtures/test-fixtures` để kích hoạt bẫy lỗi tự động `runtimeTrap` (Zero-Config Runtime Trap).
