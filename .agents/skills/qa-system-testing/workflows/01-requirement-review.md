# Workflow 01: Review Requirement & Detect Mismatches

## Mục tiêu
Phát hiện các điểm mâu thuẫn giữa PRD/SRS/API Spec và thực tế hệ thống, các luồng cụt (*dead-end states*), lỗ hổng phân quyền đa cổng (*Multi-Portal RBAC / Tenant Isolation*) và rủi ro bất đồng bộ trước khi viết code hoặc kịch bản kiểm thử.

---

## Bước 0: Kiểm tra Ngữ cảnh & Phạm vi Ảnh hưởng trong Workspace
Nếu requirement đã tồn tại hoặc liên quan đến một `REQ-xxx` sẵn có trong workspace:
1. Chạy `npm run qa:impact -- <REQ-id>` và `npm run qa:gaps` để biết các file `requirements/`, `test-cases/`, `playwright/tests/` đang bị ràng buộc.
2. Đọc đối chiếu [../references/cross-portal-checklist.md](../references/cross-portal-checklist.md) và [../references/edge-case-catalog.md](../references/edge-case-catalog.md).

---

## 5 Bước Phân Tích Bắt Buộc

### 1. Rà soát Ma trận Phân quyền & Đa cổng (Multi-Portal & RBAC / BOLA / BFLA)
- Xác định tất cả các **Actor** và **Portal** tham gia vào luồng nghiệp vụ (VD: End-user / Seeker Portal, Partner / Employer / Instructor Portal, Company Portal, Admin / Backoffice Portal).
- Kiểm tra ma trận quyền `CRUD` + `Approve/Reject/Export` trên từng Portal.
- Kiểm tra **Data Isolation (Cô lập dữ liệu đa tổ chức/tenant)**:
  - Người dùng của Tenant/Company A có thể xem, sửa hoặc đoán ID tài nguyên của Tenant/Company B qua URL/API (`BOLA/IDOR`) không?
  - Khi Admin khóa/thu hồi quyền của một Actor ở Portal Admin, phiên đăng nhập (`session`/`JWT`) đang mở ở Portal User/Partner có bị vô hiệu hóa tức thời không?

### 2. Kiểm tra Vòng đời Trạng thái (State Machine Completeness)
- Vẽ nháp luồng chuyển đổi trạng thái của thực thể chính (VD: `Draft` $\to$ `Pending` $\to$ `Approved` / `Rejected` $\to$ `Expired` / `Cancelled`).
- Truy tìm các **chuyển đổi ngược, nhảy cóc hoặc bất hợp lệ**:
  - Điều gì xảy ra nếu Actor A bấm `Cancel` hoặc `Edit` đúng lúc Actor B (Admin) đang bấm `Approve`?
  - Trạng thái nào là trạng thái cuối (*Terminal State*)? Có luồng nào bị kẹt ở trạng thái trung gian (*Dead-end state*) mà không có nút hoặc job giải cứu không?
  - Ai có quyền `Rollback` / `Re-open` trạng thái và lịch sử (`audit_logs`) ghi nhận như thế nào?

### 3. Phân tích Tích hợp, Bất đồng bộ & Chịu lỗi (Async, Webhook & 3rd-Party)
- Nếu luồng có gọi cổng thanh toán, gửi thông báo (Webhook/Email/SMS/Zalo), đẩy hàng đợi (Queue/Job) hoặc đồng bộ Search Index (Elasticsearch):
  - **Timeout & 5xx**: Điều gì xảy ra khi dịch vụ thứ 3 timeout hoặc trả về lỗi `5xx`? Giao diện bảo toàn dữ liệu ra sao?
  - **Idempotency & Duplicate Callback**: Nếu cổng thanh toán hoặc webhook gửi callback trùng 2–3 lần liên tiếp (hoặc người dùng nhấn đúp Submit), hệ thống có chặn xử lý trùng bằng `Idempotency-Key` / khóa giao dịch không?
  - **Out-of-Order Events**: Nếu sự kiện `Completed` đến trước sự kiện `Processing` do độ trễ mạng, hệ thống xử lý thế nào?

### 4. Định nghĩa Dữ liệu, Biên & Bề mặt Bảo mật (Data Constraints & Exposure)
- Kiểm tra giới hạn ký tự (`minlength`, `maxlength`), định dạng số học, quy tắc làm tròn tiền tệ/phần trăm, định dạng file upload (MIME type thật vs đuôi file) và đồng bộ múi giờ (**UTC trong DB/API vs Local Timezone trên UI**).
- Xác định **Canonical Metadata** theo chuẩn workspace:
  - `Page exposure`: `Public` | `Customer` | `Authenticated` | `Admin`
  - `UI coverage`: `Required` | `Exempt`
  - `XSS applicability`: `Applicable` | `Exempt` (Nếu dữ liệu nhập ở Portal A hiển thị sang Portal B/Admin, phải cảnh báo nguy cơ **Stored Blind XSS**).

### 5. Đối chiếu Mâu thuẫn (Product Mismatch Detection)
- So sánh giữa mô tả nghiệp vụ (User Story), thiết kế giao diện (Figma/UI), đặc tả API (Swagger/OpenAPI) và mã nguồn hiện có:
  - Trường bắt buộc ở UI nhưng tùy chọn ở API (hoặc ngược lại).
  - Mã lỗi/thông báo lỗi khác nhau giữa tài liệu và thực tế.
  - Quy tắc ẩn/hiện trường điều kiện không khớp giữa các màn hình.

---

## Định dạng Đầu ra (Output Format)
Trình bày báo cáo theo mẫu chuẩn tại [../templates/ambiguity-report.md](../templates/ambiguity-report.md) gồm 4 phần:
1. **🚨 Critical Blockers (Chặn triển khai):** Các lỗ hổng logic, mất toàn vẹn dữ liệu hoặc lỗ hổng phân quyền/bảo mật nghiêm trọng.
2. **⚠️ Edge Cases & Ambiguities (`Q-xxx`):** Danh sách các câu hỏi làm rõ dành cho PO/BA/Dev kèm **đề xuất hướng xử lý chuẩn** (không tự ý bịa yêu cầu).
3. **🔄 Cross-System & Multi-Portal Impact:** Danh sách các Portal, màn hình, API, Background Job, Cache/Search Index bị ảnh hưởng ngầm.
4. **📋 Chuẩn hóa sang `requirements/REQ-xxx-*.md` (khi được yêu cầu):** Chuyển hóa các tiêu chí đã rõ thành `AC-xxx`, bảng `Rules and validation`, và mục `Open questions`.
