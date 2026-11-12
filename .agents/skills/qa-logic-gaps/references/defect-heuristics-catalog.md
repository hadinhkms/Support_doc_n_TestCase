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

### [DH-07] Chuyển trạng thái không hợp lệ qua API trực tiếp hoặc deep link dù UI đã ẩn nút
- **Category**: State & Concurrency
- **Trigger**: Thực thể có vòng đời nhiều trạng thái (Draft, Pending, Approved, Completed, Cancelled, Deleted) và UI ẩn/disable nút theo trạng thái.
- **Failure Mode**: Chỉ UI chặn thao tác; gọi API trực tiếp, mở bookmark/deep link hoặc dùng tab cũ vẫn hủy được đơn đã hoàn tất, duyệt lại bản ghi đã từ chối, hoặc sửa bản ghi đã xóa mềm.
- **Actionable Check**: Kiểm tra requirement có bảng chuyển trạng thái (state transition table) và test case cho từng cặp chuyển trạng thái bị cấm, thực hiện qua API hoặc URL trực tiếp, kỳ vọng `409`/`422`/`404` và trạng thái không đổi.

### [DH-08] Thu hồi quyền hoặc khóa tài khoản không có hiệu lực với phiên đang mở
- **Category**: Security & Access
- **Trigger**: Tính năng đổi vai trò, khóa tài khoản, xóa thành viên khỏi tổ chức, đổi mật khẩu hoặc thu hồi token.
- **Failure Mode**: Phiên/JWT đã cấp trước đó ở trình duyệt hoặc thiết bị khác vẫn thao tác được với quyền cũ cho tới khi token hết hạn.
- **Actionable Check**: Kiểm tra có test case mở sẵn phiên ở context thứ hai, thu hồi quyền ở context thứ nhất, rồi xác nhận request kế tiếp của phiên cũ bị `401`/`403` và không ghi được dữ liệu.

### [DH-09] Cache, search index hoặc bộ đếm không cập nhật sau khi dữ liệu nguồn thay đổi
- **Category**: Resilience & Recovery
- **Trigger**: Màn hình danh sách, tìm kiếm, dashboard, badge đếm hoặc trang công khai đọc dữ liệu qua cache/CDN/search index/counter.
- **Failure Mode**: Sau khi tạo, sửa, ẩn hoặc xóa bản ghi, danh sách/tìm kiếm/bộ đếm vẫn trả dữ liệu cũ; bấm vào bản ghi đã xóa bị `404`/`500`, hoặc tổng số lệch với danh sách chi tiết.
- **Actionable Check**: Kiểm tra test case có bước đọc lại qua mọi kênh hiển thị (danh sách, tìm kiếm, chi tiết, bộ đếm, portal khác) sau mỗi thao tác ghi, với SLA đồng bộ được requirement quy định rõ.

### [DH-10] Ranh giới ngày giờ, múi giờ và giờ mùa hè làm lệch bộ lọc, hạn chót hoặc lịch chạy
- **Category**: Data & BVA
- **Trigger**: Bộ lọc theo ngày, hạn chót, voucher/OTP hết hạn, báo cáo theo ngày/tháng, cron/batch job hoặc người dùng ở nhiều múi giờ.
- **Failure Mode**: Bản ghi tạo lúc 23:30 giờ địa phương rơi sang ngày khác theo UTC, ngày chuyển giờ mùa hè bị lặp/mất 1 giờ, cuối tháng/năm nhuận bị tính sai, hoặc job chạy hai lần/bỏ lần.
- **Actionable Check**: Kiểm tra requirement nói rõ múi giờ chuẩn và test case có mốc 23:59/00:00, cuối tháng, 29/02, ngày đổi giờ mùa hè; tua giờ bằng `page.clock` thay vì chờ thật.

### [DH-11] Giao diện báo thành công nhưng dữ liệu không thực sự được lưu (Optimistic UI)
- **Category**: State & Concurrency
- **Trigger**: Thao tác cập nhật hiển thị ngay trên giao diện (toggle, kéo thả, sửa inline, lưu cấu hình) trước khi backend xác nhận.
- **Failure Mode**: UI hiện "Đã lưu" từ state cục bộ; API thực chất lỗi hoặc lưu thiếu trường, sau khi tải lại trang dữ liệu quay về giá trị cũ mà không có thông báo lỗi.
- **Actionable Check**: Kiểm tra test case có bước tải lại trang hoặc đọc lại qua API sau khi lưu (`expectStatePersistence`) và có ca API lỗi để xác nhận UI hoàn tác và báo lỗi.
