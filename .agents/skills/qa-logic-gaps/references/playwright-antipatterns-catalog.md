# Playwright Anti-Patterns & False-Positive Catalog (`PA-xx`)

> **Phân loại sở hữu**: `ship` (Hub sở hữu — Learner chỉ đọc; áp dụng bài học mới của dự án vào `<testCasesDir>/_learning/knowledge.json`).  
> **Giới hạn dung lượng**: Tối đa `25` mục active (`MAX_CATALOG_ENTRIES = 25`).  
> **Enum Category hợp lệ**: `Superficial Assertion`, `Async & Timing`, `Parallel Isolation`, `Selector Fragility`, `Negative Side Effects`.

---

### [PA-01] Chỉ Assert URL/Title mà không đối chiếu kết quả nghiệp vụ kỳ vọng trên trang đích
<!-- staticRule: spec-chi-assert-url | coverage: partial -->
- **Category**: Superficial Assertion
- **Trigger**: Block `test(...)` trong Playwright thực hiện hành động (Submit form, Login, Lưu dữ liệu, Điều hướng) và chỉ gọi `expect(page).toHaveURL(...)` hoặc `toHaveTitle(...)`.
- **Failure Mode**: Vượt qua được kiểm tra `spec-thieu-assertion`, nhưng nếu trang đích báo lỗi 500 bên trong layout hoặc dữ liệu nghiệp vụ chưa được cập nhật đúng như Test Case yêu cầu thì test vẫn PASS giả tạo.
- **Actionable Check**: Đối chiếu với cột `Expected` của Test Case để bổ sung assertion kiểm tra đúng trạng thái/dữ liệu nghiệp vụ mà TC yêu cầu (không thêm `toBeVisible()` tùy tiện chỉ để tắt cảnh báo).

### [PA-02] Assert hiển thị trên Container chung chung thay vì thông báo lỗi gắn đúng với trường dữ liệu
- **Category**: Superficial Assertion
- **Trigger**: Kiểm thử các ca Negative / Validation Error trên form có nhiều trường nhập liệu.
- **Failure Mode**: Test chỉ gọi `expect(page.locator('.error')).toBeVisible()` hoặc kiểm tra form còn hiển thị, dẫn đến việc hệ thống báo lỗi nhầm trường hoặc sai nội dung lỗi mà test vẫn PASS.
- **Actionable Check**: Kiểm tra assertion phải neo đúng vào thông báo lỗi của trường tương ứng (qua `getByRole('alert')`, `aria-describedby`, hoặc nội dung thông báo khớp với cột `Expected` trong Test Case).

### [PA-03] Dùng chung tài khoản hoặc dữ liệu có thay đổi trạng thái giữa các Test chạy song song
- **Category**: Parallel Isolation
- **Trigger**: Test kịch bản làm biến đổi trạng thái dữ liệu (Khóa tài khoản do nhập sai nhiều lần, Đổi mật khẩu, Xóa bản ghi, Thanh toán hết số dư) trong môi trường bật `fullyParallel: true`.
- **Failure Mode**: Chạy đơn lẻ từng test thì PASS, nhưng khi chạy song song trên CI (`shard` / `fullyParallel`), test làm đổi trạng thái tài khoản/bản ghi khiến các test khác dùng chung dữ liệu đó bị FAIL ngẫu nhiên.
- **Actionable Check**: Kiểm tra các test gây biến đổi trạng thái (state-mutating tests) đã dùng dữ liệu/tài khoản cô lập riêng biệt hoặc cơ chế seed/mock độc lập cho từng test hay chưa.

### [PA-04] Thiếu kiểm tra hiệu ứng phụ tiêu cực (Negative Side Effects) trong các ca kiểm thử từ chối
- **Category**: Negative Side Effects
- **Trigger**: Kiểm thử ca Negative/Security hoặc chống gửi trùng mà hành động phải bị chặn (ví dụ: bấm Submit khi dữ liệu sai hoặc bấm đúp liên tiếp).
- **Failure Mode**: Test chỉ kiểm tra thông báo lỗi xuất hiện trên UI, nhưng không phát hiện việc Frontend vẫn âm thầm gửi request `POST/PUT` xuống Backend hoặc làm thay đổi trạng thái ngoài ý muốn.
- **Actionable Check**: Trong các ca từ chối thao tác hoặc chống double-submit, kiểm tra thêm rằng không có request ghi dữ liệu trái phép hoặc chuyển hướng ngầm xảy ra ngoài dự kiến của Test Case.
