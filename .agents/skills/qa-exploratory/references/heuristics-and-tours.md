# Heuristics, Oracles & Tours cho Exploratory Testing

> **Ownership**: `ship` (Hub sở hữu). Chọn 2–4 mục phù hợp charter; không chạy hết một lượt.
> Nguồn gốc khái niệm: SFDPOT (James Bach, Heuristic Test Strategy Model), FEW HICCUPPS
> (Michael Bolton), "How to Break Software" (James Whittaker). Nội dung dưới đây là diễn giải
> áp dụng cho workspace, không phải bản trích nguyên văn.

---

## 1. SFDPOT — thay đổi cái gì

| Chiều | Câu hỏi để biến đổi | Ví dụ lỗi tiềm ẩn |
|---|---|---|
| **S**tructure — cấu trúc | Thành phần nào tạo nên tính năng (trang, component, API, job, bảng DB, file cấu hình, feature flag)? Bỏ/thay một phần thì sao? | Flag tắt nhưng API vẫn mở; component dùng chung bị sửa làm vỡ trang khác |
| **F**unction — chức năng | Mọi việc tính năng làm, kể cả việc phụ (gửi email, ghi audit, cập nhật bộ đếm, xóa cache)? | Việc chính chạy nhưng việc phụ không chạy: không có audit log, badge đếm không giảm |
| **D**ata — dữ liệu | Dữ liệu vào/ra/lưu trữ: rỗng, biên, cực lớn, Unicode, trùng, dữ liệu cũ từ trước migration, dữ liệu của tenant khác? | Bản ghi tạo trước khi thêm cột mới hiển thị `undefined`; danh sách 10.000 dòng làm treo trang |
| **P**latform / Interfaces — giao diện tích hợp | Phụ thuộc gì: browser, thiết bị, API bên thứ ba, cổng thanh toán, webhook, CDN, timezone server? | Webhook đến trễ hoặc trùng; API bên thứ ba timeout làm treo luồng |
| **O**perations — thao tác | Người dùng thật dùng thế nào: nhiều tab, Back/Forward, reload giữa chừng, copy-paste, bàn phím, mạng chập chờn, để màn hình qua đêm? | Mở form từ hôm qua, bấm lưu sau khi phiên hết hạn → mất dữ liệu không báo |
| **T**ime — thời gian | Thứ tự, tốc độ, thời lượng, ngày giờ: bấm nhanh/chậm, hết hạn giữa chừng, 23:59 → 00:00, cuối tháng, năm nhuận, đổi giờ mùa hè, cron chạy trùng? | Voucher hết hạn đúng lúc submit vẫn được áp; báo cáo "hôm nay" lệch ngày theo UTC |

Dùng `page.clock` của Playwright để tua thời gian thay vì chờ thật.

---

## 2. FEW HICCUPPS — làm sao biết là sai (oracle)

Khi không có Expected result, một hành vi là đáng ngờ nếu nó **mâu thuẫn** với một trong các
nguồn sau. Ghi rõ oracle bị vi phạm vào từng phát hiện.

| Oracle | Mâu thuẫn với… | Độ mạnh |
|---|---|---|
| **F**amiliar problems | Một mẫu lỗi đã biết (catalog `DH-xx`/`PA-xx`, OWASP, bug cũ) | Trung bình |
| **E**xplainability | Hành vi không giải thích được cho người dùng hay dev | Yếu – trung bình |
| **W**orld | Hiểu biết về thế giới thật (tiền không âm, ngày 30/02 không tồn tại, người không 200 tuổi) | Mạnh |
| **H**istory | Hành vi của chính sản phẩm ở phiên bản trước | Mạnh (nếu thay đổi không được thông báo) |
| **I**mage | Hình ảnh thương hiệu, sự chuyên nghiệp mà sản phẩm muốn có | Yếu |
| **C**omparable products | Sản phẩm tương tự hoặc tính năng tương tự trong cùng hệ thống | Trung bình |
| **C**laims | Điều được khẳng định: requirement, AC, tài liệu, UI text, thông báo, marketing | Mạnh |
| **U**sers' desires | Điều người dùng hợp lý mong muốn | Trung bình |
| **P**roduct | Tính nhất quán bên trong sản phẩm (cùng khái niệm, nhiều nơi hiển thị khác nhau) | Mạnh |
| **P**urpose | Mục đích rõ ràng hoặc ngầm hiểu của tính năng | Trung bình |
| **S**tandards & Statutes | Chuẩn kỹ thuật, pháp lý (HTTP, WCAG, quy định bảo vệ dữ liệu cá nhân) | Mạnh |

Oracle có thể mâu thuẫn nhau (vd Claims nói A, Users' desires mong B) → ghi `Q-xxx`, không tự
chọn.

---

## 3. Tấn công nhanh (quick attacks) — 10 phút đầu session

- Bỏ trống mọi trường; nhập toàn khoảng trắng; dán chuỗi rất dài; dán Unicode/emoji/RTL.
- Nhập giá trị ngoài miền: âm, 0, số thập phân, ngày quá khứ/tương lai xa, `start > end`.
- Bấm đúp, nhấn Enter liên tục, bấm khi đang loading.
- Reload, Back, Forward ở giữa luồng nhiều bước; mở cùng màn hình ở hai tab.
- Đổi vai trò/tenant và mở lại URL vừa dùng; sửa ID trên URL.
- Chặn mạng hoặc trả `500` cho một request phụ (`page.route`) và xem UI có hồi phục không.
- Thu nhỏ viewport, phóng to chữ 200%, chỉ dùng bàn phím.

---

## 4. Tấn công theo kiểu "How to Break Software"

| Nhóm | Tấn công | Mục tiêu |
|---|---|---|
| Đầu vào | Ép mọi thông báo lỗi xuất hiện; ép giá trị mặc định; tràn bộ đệm/độ dài | Tìm lỗi validation và thông báo sai trường |
| Đầu ra | Ép đầu ra không hợp lệ; ép kết quả thay đổi khi đầu vào giữ nguyên; ép màn hình làm mới | Tìm lỗi hiển thị và trạng thái cũ |
| Dữ liệu lưu trữ | Ép một cấu trúc dữ liệu chứa quá nhiều/quá ít phần tử; sửa dữ liệu ngầm qua đường khác | Tìm lỗi khi dữ liệu không như giả định |
| Tính toán | Kết hợp giá trị hợp lệ thành phép tính không hợp lệ (làm tròn, chia, cộng dồn) | Tìm lỗi số học, làm tròn tiền |
| Tương tác tính năng | Chạy hai tính năng tác động cùng dữ liệu theo nhiều thứ tự | Tìm lỗi tương tác ngầm |
| Môi trường | Làm hỏng phụ thuộc: mạng, file, dịch vụ bên thứ ba, quyền | Tìm lỗi xử lý ngoại lệ |

---

## 5. Tours — cách đi qua sản phẩm

| Tour | Cách đi | Hợp với |
|---|---|---|
| **Money tour** | Đi đúng các luồng tạo ra giá trị kinh doanh (thanh toán, đăng ký, duyệt) | Session đầu cho tính năng mới |
| **Landmark tour** | Nhảy giữa các điểm mốc theo thứ tự khác thường | Tìm phụ thuộc thứ tự ẩn |
| **Back-alley tour** | Đi vào tính năng ít người dùng, ít test (`qa:gaps`) | Vùng ít độ phủ |
| **Saboteur tour** | Cố ý làm hỏng tài nguyên: mạng, phiên, dữ liệu, quyền | Resilience |
| **Antisocial tour** | Luôn làm ngược điều UI gợi ý: nhập sai, hủy giữa chừng, bỏ qua bước | Luồng lỗi |
| **Collector tour** | Thu thập mọi thông báo, mọi trạng thái, mọi đầu ra | So sánh tính nhất quán (oracle Product) |
| **Supermodel tour** | Chỉ nhìn giao diện, không đọc logic | Lỗi hiển thị, responsive |
| **Intellectual tour** | Đặt câu hỏi khó nhất có thể cho sản phẩm (dữ liệu lớn nhất, quyền phức tạp nhất) | Biên và hiệu năng |
| **Cross-portal tour** | Thao tác ở portal A, quan sát ở B, Admin, email, export | Đồng bộ, cache (`DH-09`) |

---

## 6. Liên kết sang catalog có sẵn

- Bẫy dữ liệu, thời gian, tương tranh: [edge-case-catalog](../../qa-system-testing/references/edge-case-catalog.md)
- Đồng bộ đa cổng, RBAC, webhook: [cross-portal-checklist](../../qa-system-testing/references/cross-portal-checklist.md)
- Mẫu lỗi chuẩn: [defect-heuristics-catalog](../../qa-logic-gaps/references/defect-heuristics-catalog.md)
- Tấn công API: [api-deep-testing-checklist](../../qa-api-testing/references/api-deep-testing-checklist.md)
