# Defect Heuristics Catalog (`DH-xx`)

> **Phân loại sở hữu**: `ship` (Hub sở hữu — Learner chỉ đọc; áp dụng bài học mới của dự án vào `<testCasesDir>/_learning/knowledge.json`).  
> **Giới hạn dung lượng**: Tối đa `25` mục active (`MAX_CATALOG_ENTRIES = 25`).  
> **Enum Category hợp lệ**: `State & Concurrency`, `Data & BVA`, `Security & Access`, `Resilience & Recovery`.

---

### [DH-01] Idempotency và chống gửi trùng khi bấm đúp liên tiếp (Rapid Double-Submit)
- **Category**: State & Concurrency
- **Trigger**: Form hoặc nút thực hiện hành động ghi dữ liệu, tạo bản ghi, thanh toán, gửi OTP/Email, hoặc kích hoạt tiến trình bất đồng bộ.
- **Failure Mode**: Requirement và Test Case chỉ kiểm tra bấm 1 lần khi mạng nhanh; bỏ sót trường hợp bấm đúp liên tiếp khi mạng trễ làm gọi API nhiều lần hoặc tạo bản ghi trùng lặp.
- **Actionable Check**: Đối chiếu AC/Rules và Test Case xem đã quy định khóa nút (`disabled` / `aria-busy`) trong lúc chờ phản hồi và kiểm tra số lần ghi dữ liệu khi gửi lặp hay chưa.

### [DH-02] Tính toàn vẹn trạng thái khi dùng nút Back/Forward sau khi đổi phiên hoặc hoàn tất giao dịch
- **Category**: State & Concurrency
- **Trigger**: Luồng đăng xuất (Logout), đổi mật khẩu, hoặc hoàn tất bước cuối của quy trình một chiều (Checkout, Nộp hồ sơ, Xác nhận OTP).
- **Failure Mode**: Sau khi đăng xuất hoặc hoàn tất giao dịch, người dùng bấm nút Back của trình duyệt vẫn nhìn thấy dữ liệu nhạy cảm từ bộ nhớ đệm hoặc gửi lại được form cũ.
- **Actionable Check**: Kiểm tra xem có Test Case xác nhận bấm Back/Forward sau khi Logout hoặc hoàn tất giao dịch phải chuyển về trạng thái an toàn và không lộ hay gửi lại dữ liệu phiên cũ hay không.

### [DH-03] Chuỗi chỉ chứa khoảng trắng (Whitespace-Only) hoặc khoảng trắng đầu/cuối vượt qua kiểm tra bắt buộc
- **Category**: Data & BVA
- **Trigger**: Trường nhập văn bản bắt buộc (`required`) hoặc có giới hạn độ dài tối thiểu (`minlength`) như Tên, Tiêu đề, Địa chỉ, Tài khoản.
- **Failure Mode**: Hệ thống chỉ kiểm tra `value.length > 0` mà không `trim()` trước khi validate, khiến chuỗi toàn dấu cách (`"   "`) vượt qua kiểm tra và lưu bản ghi rỗng.
- **Actionable Check**: Kiểm tra bảng `Rules and validation` và danh sách Test Case xem đã có ca nhập chuỗi toàn khoảng trắng (`"   "`) và kiểm tra cắt khoảng trắng đầu/cuối tách biệt với ca để trống (`""`) chưa.

### [DH-04] Dán (Paste) chuỗi hỗn hợp hoặc biên số học vào trường số lượng và tiền tệ
- **Category**: Data & BVA
- **Trigger**: Ô nhập số lượng, giá tiền, điểm số, số điện thoại hoặc mã định danh có giới hạn `min` / `max`.
- **Failure Mode**: Giao diện chỉ chặn sự kiện gõ phím chữ (`keydown`), nhưng khi người dùng dán (paste) chuỗi hỗn hợp (`"12abc34"`, `"-500"`, `"1e5"`, `"!@#"`) thì giá trị sai vẫn lọt vào state hoặc gây lỗi `NaN`.
- **Actionable Check**: Kiểm tra Test Case của trường số đã bao phủ thao tác paste chuỗi hỗn hợp, số âm, số thập phân (khi chỉ nhận số nguyên) và các mốc biên (`min - 1`, `min`, `max`, `max + 1`) chưa.

### [DH-05] Phản xạ mã độc (Reflected XSS) trên các trang Public hoặc Customer-Facing
- **Category**: Security & Access
- **Trigger**: Requirement có `Page exposure` là `public` hoặc `customer` và có ô nhập liệu, ô tìm kiếm, hoặc tham số URL (`query params`) được hiển thị lại lên giao diện.
- **Failure Mode**: Dữ liệu đầu vào của người dùng được render trực tiếp vào DOM mà không escape, hoặc bỏ qua kiểm thử XSS trên trang public/customer mà không có giải trình hợp lệ.
- **Actionable Check**: Kiểm tra sự tồn tại của Test Case thuộc `Type: Security` (tag `@security`) xác minh payload XSS không thực thi script, hoặc kiểm tra lý do miễn trừ trong `Coverage notes` nếu là trang nội bộ.

### [DH-06] Bảo toàn dữ liệu đã nhập trên Form khi Server trả về lỗi Validation hoặc 5xx
- **Category**: Resilience & Recovery
- **Trigger**: Form đăng nhập, đăng ký, hoặc form nhập liệu nhiều trường có gửi request xác thực/lưu trữ lên Backend.
- **Failure Mode**: Khi gửi form thất bại do lỗi validation hoặc lỗi server (`4xx`/`5xx`), toàn bộ các trường hợp lệ mà người dùng đã nhập bị xóa trắng (reset) gây mất dữ liệu.
- **Actionable Check**: Kiểm tra cột `Expected` của các Test Case Negative/Error có xác nhận giữ nguyên dữ liệu đã nhập ở các trường không nhạy cảm sau khi báo lỗi hay không (trừ trường mật khẩu nếu requirement quy định xóa).
