# Danh mục Phản mẫu Kiểm thử Playwright (Playwright Anti-Pattern Catalog)

Tài liệu tham chiếu cho skill `qa-logic-gaps` và hệ thống Học Chọn Lọc (`tools/qa/lib/learner.js`).
Mỗi mục gắn thẻ `<!-- staticRule: ... | coverage: ... -->` để đối chiếu với rule phân tích tĩnh.

---

### [PA-01] Chỉ kiểm tra URL hoặc tiêu đề trang (URL/Title-Only Assertion)
<!-- staticRule: spec-chi-assert-url | coverage: partial -->
- **Category**: Superficial Assertion
- **Trigger**: Test kết thúc ngay sau lệnh `await expect(page).toHaveURL(...)` hoặc `await expect(page).toHaveTitle(...)`.
- **Failure Mode**: Trang đã chuyển hướng đúng URL nhưng phần thân trang trắng xóa, báo lỗi 500 nội bộ hoặc dữ liệu nghiệp vụ không được hiển thị.
- **Actionable Check**: Bắt buộc kết hợp kiểm tra trạng thái nghiệp vụ cụ thể trên DOM và dùng `expectStatePersistence` hoặc kiểm tra dữ liệu thực tế sau điều hướng.

### [PA-02] Ngủ cứng hoặc bỏ sót await trên hàm kiểm chứng bất đồng bộ (Hard Sleep & Missing Await)
<!-- staticRule: assertion-thieu-await | coverage: full -->
- **Category**: Async & Timing
- **Trigger**: Sử dụng `page.waitForTimeout(ms)` hoặc gọi các hàm `expect(...)` / helper bất đồng bộ (`expectNoHorizontalScroll`, `expectIdempotentSubmit`, `expectSafeXssRender`) mà thiếu `await`.
- **Failure Mode**: Test chạy đua với tốc độ render (flaky test) hoặc kết thúc trước khi Promise kiểm chứng kịp báo lỗi, dẫn tới False Positive.
- **Actionable Check**: Tuyệt đối không dùng `waitForTimeout`; luôn đặt `await` trước mọi lời gọi `expect(...)` và mọi helper từ `support/ui-checks` / `support/deep-guards`.

### [PA-03] Phụ thuộc thứ tự chạy và dùng chung trạng thái giữa các test (Shared Mutable State)
<!-- staticRule: none | coverage: semantic -->
- **Category**: Parallel Isolation
- **Trigger**: Biến toàn cục lưu giữ token/ID giữa các `test(...)` hoặc test sau giả định dữ liệu do test trước tạo ra.
- **Failure Mode**: Khi chạy CI `fullyParallel: true` hoặc `--repeat-each`, thứ tự chạy thay đổi làm test thất bại ngẫu nhiên hoặc ghi đè dữ liệu của nhau.
- **Actionable Check**: Mỗi `test(...)` phải tự thiết lập dữ liệu độc lập và dùng `runtimeTrap` riêng biệt theo từng `page` fixture.

### [PA-04] Chỉ kiểm tra sự tồn tại bề mặt của phần tử (Weak Existence-Only Assertion)
<!-- staticRule: weak-existence-assertion | coverage: partial -->
- **Category**: Negative Side Effects
- **Trigger**: Test chỉ chứa các khẳng định bề mặt như `toBeVisible()`, `toBeAttached()`, `toBeDefined()`, `toBeTruthy()`, `not.toBeNull()`, `toHaveCount()`.
- **Failure Mode**: Phần tử vẫn tồn tại trong DOM (`toBeVisible() === true`) nhưng nội dung văn bản bị rỗng, hiển thị sai giá trị nghiệp vụ, bị cắt chữ (`scrollWidth > clientWidth`) hoặc bị phần tử khác che khuất không thể nhấn được.
- **Actionable Check**: Bổ sung khẳng định giá trị nghiệp vụ (`toHaveText`, `toHaveValue`, `toHaveAttribute`) hoặc gọi các hàm kiểm chứng sâu từ `support/ui-checks.ts` và `support/deep-guards.ts`.
