# Danh Mục Bẫy Dữ Liệu & Trường Hợp Biên Hệ Thống (System Edge Case Catalog)

Tài liệu này tổng hợp các bẫy dữ liệu thực chiến để đối chiếu nhanh khi review Requirement (**Pha 01**) và thiết kế Test Case (**Pha 02**), bổ trợ trực tiếp cho `DH-01`..`DH-06` trong skill `qa-logic-gaps` và các payload trong `playwright/tests/support/deep-guards.ts`.

---

## 1. Biên Chuỗi Ký Tự & Bộ Mã (Strings, Encoding & Normalization)

- **Chuỗi rỗng & Khoảng trắng (`DH-03`):**
  - Chuỗi rỗng `""`, chuỗi chỉ gồm dấu cách `"     "`, ký tự tab/xuống dòng `"\t\n"`, khoảng trắng không ngắt (`\u00A0`), khoảng trắng độ rộng bằng 0 (`\u200B`, `\uFEFF`).
  - Khoảng trắng đầu/cuối ở các trường định danh (`email`, `username`, `code`, `phone`): hệ thống có `trim()` và chuẩn hóa chữ hoa/thường (`case-insensitive` cho email) trước khi lưu và so sánh trùng lặp không?
- **Biên độ dài (`BVA`):**
  - `minlength - 1`, `minlength`, `maxlength`, `maxlength + 1`, và chuỗi cực dài (`1024+` ký tự) để kiểm tra lỗi tràn khung UI (`expectNoTextOverflow`) hoặc lỗi cắt cụt âm thầm dưới DB (`VARCHAR` truncation).
- **Unicode, Emoji & Ký tự Đặc biệt (`UNICODE_OVERFLOW_PAYLOADS`):**
  - Tiếng Việt có dấu tổ hợp vs dựng sẵn (`NFC` vs `NFD` — rất dễ gây lỗi tìm kiếm không ra kết quả hoặc tạo trùng tên).
  - Cụm Emoji phức hợp (`👨‍👩‍👧‍👦` — 1 ký tự hiển thị nhưng chiếm nhiều code units trong `.length` của JavaScript vs `CHAR_LENGTH` của SQL).
  - Ký tự điều khiển (`\u0000` Null byte), dấu nháy đơn/kép (`'`, `"`), dấu gạch chéo (`\`, `/`), ký tự phân tách CSV/Excel (`=`, `+`, `-`, `@` ở đầu chuỗi gây lỗi **CSV Formula Injection** khi Admin xuất báo cáo).

---

## 2. Biên Số Học, Tiền Tệ & Định Lượng (Numbers, Currency & Quantities)

- **Kiểu dữ liệu & Ép kiểu:**
  - Nhập chữ (`abc`), ký tự đặc biệt (`!@#`), dán chuỗi lẫn chữ (`12abc34`), biểu thức khoa học (`1e5`), `NaN`, `Infinity`, `null`.
- **Biên Giá Trị (`BVA`):**
  - `0`, `-0`, `-1` (số âm cho số lượng/giá tiền), `min - 1`, `min`, `max`, `max + 1`, `MAX_SAFE_INTEGER` (`9007199254740991`), tràn kiểu `INT32` (`2147483647 + 1`).
- **Làm Tròn & Sai Số Dấu Phẩy Động (Floating-Point & Financial Precision):**
  - Phép tính `0.1 + 0.2 !== 0.3` hoặc tính chiết khấu `%` lẻ (VD: chia tiền cho 3 hạng mục, tổng sau làm tròn lệch `1đ` so với tổng hóa đơn gốc).
  - Nhất quán quy tắc làm tròn (`Half-Up` vs `Floor` vs `Ceil`) giữa Frontend Preview và Backend Invoice.

---

## 3. Thời Gian, Múi Giờ & Chu Kỳ (Date, Time, Timezone & Scheduling)

- **Lệch Múi Giờ (Timezone Drift):**
  - Giao dịch tạo lúc `23:30` giờ Việt Nam (`UTC+7`) tức là `16:30` ngày hôm đó theo `UTC`: bộ lọc "Hôm nay" trên UI gửi tham số ngày theo giờ trình duyệt hay giờ server?
- **Biên Lịch & Thời Hạn:**
  - Ngày `29/02` năm nhuận vs năm không nhuận; ngày `31` của tháng chỉ có `30` ngày; chuyển giao năm mới (`31/12 23:59:59` $\to$ `01/01 00:00:00`).
  - `start_date > end_date`, `start_date === end_date`, hoặc đặt lịch vào thời điểm vừa trôi qua trong quá khứ 1 phút.
- **Hết Hạn Giữa Chừng (Mid-Flow Expiration):**
  - Token/OTP/Voucher/Phiên thanh toán còn hiệu lực lúc mở form nhưng hết hạn đúng giây người dùng bấm `Submit`.

---

## 4. Tương Tranh, Đụng Độ & Trạng Thái Cũ (Concurrency, Race Conditions & Stale State)

- **Double Submit / Rapid Click (`DH-02` / `idempotency`):**
  - Nhấn đúp hoặc nhấn Enter liên tiếp vào nút `Submit` / `Thanh toán` / `Duyệt` khi mạng chậm $\to$ phải khóa nút ngay lập tức và chỉ phát sinh **1 request mutating** (`expectIdempotentSubmit`).
- **Multi-Tab & Multi-Actor Collision (`concurrency`):**
  - User mở 2 tab cùng sửa 1 hồ sơ (Tab 1 lưu trước, Tab 2 lưu đè dữ liệu cũ lên — thiếu `Optimistic Locking` / `version` / `updated_at` check).
  - Hai người dùng cùng抢 (claim) 1 mã giảm giá cuối cùng hoặc 1 suất đặt chỗ cuối cùng tại cùng thời điểm (`Promise.all` race probe).
- **Stale UI & Back/Forward Cache (`DH-01`, `DH-05`):**
  - Sau khi đăng xuất (`Logout`) hoặc sau khi hoàn tất thanh toán/nộp đơn, bấm nút `Back` của trình duyệt: có bị gửi lại giao dịch cũ hoặc lộ dữ liệu nhạy cảm từ bộ nhớ đệm không?

---

## 5. Lỗi Mạng, Tải Lại Trang & Phục Hồi (Network Faults, Persistence & Resilience)

- **Optimistic UI vs Thực tế Lưu trữ (`persistence`):**
  - Giao diện báo "Lưu thành công" nhưng sau khi nhấn `F5` (`page.reload()`), dữ liệu quay về như cũ do API thực chất chưa lưu hoặc lưu thiếu trường (`expectStatePersistence`).
- **Mạng Chập Chờn & 5xx (`resilience` / `DH-06`):**
  - Khi API trả về `500`/`502`/`503`/`504` hoặc đứt mạng giữa lúc submit form dài:
    1. Không được xóa trắng toàn bộ dữ liệu người dùng vừa gõ (trừ trường nhạy cảm như `password`/`OTP`).
    2. Nút `Submit` phải mở khóa lại để người dùng bấm thử lại (`expectNetworkFaultRecovery`).
    3. Không được để ứng dụng rơi vào màn hình trắng (`Uncaught Error` / `pageerror`).
