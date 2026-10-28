# Checklist Kiểm Thử Liên Hệ Thống & Đa Cổng (Cross-Portal & System Integration Checklist)

Sử dụng danh sách kiểm tra này trong **Pha 01 (Review Requirement)**, **Pha 02 (Thiết kế Test Case)** và **Pha 03 (Xác minh E2E)** khi tính năng liên quan đến nhiều vai trò (Roles), nhiều cổng giao diện (Multi-Portal) hoặc tích hợp dịch vụ bất đồng bộ.

---

## 1. Đồng bộ Dữ liệu & Trạng thái Liên Cổng (Cross-Portal Data Synchronization)

| Mã Heuristic | Câu hỏi kiểm chứng (Verification Question) | Bẫy lỗi thường gặp (Common Pitfall) |
|---|---|---|
| **CP-01** | Khi Actor ở **Portal A** (VD: Employer/Partner) tạo, sửa hoặc ẩn/xóa bản ghi, **Portal B** (VD: End-user/Seeker) và **Portal C** (Admin) có thấy dữ liệu cập nhật đúng theo thời gian thực (hoặc trong SLA của Cache/Search Index) không? | Dữ liệu trong DB đã đổi nhưng Redis Cache, CDN hoặc Elasticsearch chưa invalidate $\to$ User vẫn thấy dữ liệu cũ hoặc bấm vào bị lỗi `404`/`500`. |
| **CP-02** | Khi **Admin Portal** từ chối (`Reject`), khóa (`Suspend`) hoặc gỡ bỏ (`Unpublish`) một thực thể đang hoạt động, thực thể đó có lập tức biến mất khỏi danh sách công khai và chặn mọi giao dịch mới ở **User Portal** không? | Chỉ ẩn trên trang danh sách nhưng người dùng có link trực tiếp (Deep Link / Bookmark) hoặc gọi API vẫn truy cập và thao tác được. |
| **CP-03** | Các bộ đếm tổng hợp (Counters, Dashboard KPIs, Badge thông báo, Số lượng còn lại) giữa các Portal có khớp số học tuyệt đối với số bản ghi thực tế không? | Khi xóa mềm (`soft delete`) hoặc hủy đơn, quên giảm biến đếm (`counter_cache`) khiến số thống kê ở Admin lệch với danh sách chi tiết. |
| **CP-04** | Định dạng hiển thị (Tiền tệ, Múi giờ, Ngôn ngữ, Trạng thái enum) có nhất quán giữa các Portal và Email/Notification xuất ra không? | DB lưu UTC, Portal User hiển thị `UTC+7`, nhưng Portal Admin hoặc file Export Excel lại in thẳng giờ UTC dẫn đến lệch ngày đối soát. |

---

## 2. Phân Quyền Đa Tầng & Cô Lập Dữ Liệu (RBAC, BOLA/IDOR & Multi-Tenant Isolation)

| Mã Heuristic | Câu hỏi kiểm chứng (Verification Question) | Bẫy lỗi thường gặp (Common Pitfall) |
|---|---|---|
| **CP-05** | **Tenant / Organization Isolation (BOLA / IDOR):** Người dùng thuộc Công ty/Tổ chức A có thể xem, sửa, xóa hoặc tải file đính kèm của Công ty/Tổ chức B bằng cách thay đổi `id` / `uuid` trên URL hoặc payload API không? | API chỉ kiểm tra `isAuthenticated` (đã đăng nhập) và `role === 'employer'`, nhưng quên điều kiện `WHERE organization_id = currentUser.orgId`. |
| **CP-06** | **Function-Level Access Control (BFLA):** Tài khoản cấp thấp (`Viewer`, `Sub-account`, `Staff`) có thể gọi trực tiếp API của `Owner` / `Admin` (VD: duyệt, xuất dữ liệu nhạy cảm, đổi cấu hình thanh toán) không? | Ẩn nút bấm trên giao diện Frontend nhưng Backend endpoint không gắn middleware kiểm tra quyền chi tiết. |
| **CP-07** | **Session & Permission Revocation:** Khi Admin đổi quyền, khóa tài khoản hoặc xóa nhân sự khỏi tổ chức ở Portal Quản trị, các phiên (`JWT` / `Cookie Session`) đang mở sẵn ở trình duyệt khác của người đó có bị chặn ngay ở request kế tiếp không? | Dùng Stateless JWT thời hạn dài mà không kiểm tra trạng thái `is_active` / `token_version` khiến tài khoản bị khóa vẫn thao tác được cho đến khi hết hạn token. |
| **CP-08** | **Cross-Portal Stored XSS & File Upload:** Dữ liệu do người dùng ngoài (`Public` / `Customer`) nhập vào (tên, mô tả, lý do hủy, tên file CV/ảnh) khi hiển thị trên màn hình **Admin Portal** có được escape an toàn không? | Bảo vệ XSS ở trang User nhưng quên escape ở trang Admin Dashboard hoặc trình xem trước nội dung $\to$ **Blind Stored XSS** chiếm quyền Admin. |

---

## 3. Webhook, Hàng Đợi & Giao Dịch Bất Đồng Bộ (Webhooks, Queues & Idempotency)

| Mã Heuristic | Câu hỏi kiểm chứng (Verification Question) | Bẫy lỗi thường gặp (Common Pitfall) |
|---|---|---|
| **CP-09** | **Idempotent Webhook / Callback:** Nếu đối tác thứ 3 (Cổng thanh toán, vận chuyển, eKYC) bắn cùng một Webhook `SUCCESS` 2–5 lần đồng thời do cơ chế retry, hệ thống có đảm bảo chỉ cộng tiền / kích hoạt dịch vụ **đúng 1 lần** không? | Xử lý đọc trạng thái trước rồi mới cập nhật mà không có `SELECT ... FOR UPDATE`, Unique Constraint hoặc `Idempotency-Key` $\to$ cộng tiền nhân đôi. |
| **CP-10** | **Out-of-Order & Late Callbacks:** Điều gì xảy ra nếu người dùng đã bấm `Cancel` (hoặc job hết hạn đã đóng đơn), nhưng 5 giây sau Webhook `PAID` từ cổng thanh toán mới gửi tới? | Ghi đè trạng thái `Cancelled` thành `Paid` âm thầm hoặc nuốt luôn tiền của khách mà không đưa vào luồng hoàn tiền / cảnh báo đối soát (`Reconciliation Alert`). |
| **CP-11** | **Partial Failure & Rollback (Sagas / Transactions):** Khi một thao tác kích hoạt chuỗi 3 bước (1. Ghi DB $\to$ 2. Trừ hạn mức/tiền $\to$ 3. Gọi API bên thứ 3), nếu bước 3 lỗi `5xx` hoặc timeout thì bước 1 và 2 có được rollback hoặc đưa vào trạng thái chờ xử lý lại (`Retry / Compensating Transaction`) không? | Trừ tiền/hạn mức xong nhưng bước tạo dịch vụ lỗi $\to$ khách mất tiền mà không nhận được dịch vụ, trạng thái treo vĩnh viễn ở `Processing`. |
| **CP-12** | **Audit Trail & Traceability:** Mọi hành động nhạy cảm (duyệt, từ chối, sửa giá, hoàn tiền, đổi quyền) có ghi lại `actor_id`, `role`, `ip`, `old_value`, `new_value`, `timestamp` vào bảng `audit_logs` không? | Khi xảy ra tranh chấp dữ liệu giữa các Portal, không thể truy vết được thay đổi do User tự bấm, Admin sửa hay Cronjob tự động chạy. |
