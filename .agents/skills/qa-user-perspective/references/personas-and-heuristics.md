# Persona, Walkthrough & Usability Heuristics

Tài liệu tham chiếu cho [qa-user-perspective](../SKILL.md). Chọn phần cần dùng, không áp
máy móc toàn bộ.

## 1. Persona chuẩn (dùng khi dự án chưa có persona)

Ưu tiên persona của dự án (tài liệu sản phẩm, research, Figma). Persona dưới đây là **giả
định**, phải ghi rõ trong report.

| Mã | Persona | Đặc điểm cần mô phỏng | Hay lộ ra |
|---|---|---|---|
| `P-NEW` | Người dùng mới, lần đầu | Không biết thuật ngữ nội bộ, không biết tính năng nằm đâu, đọc kỹ từng chữ | Thuật ngữ khó hiểu, onboarding thiếu, trạng thái rỗng không hướng dẫn |
| `P-RUSH` | Người dùng quen tay, đang vội | Lướt, không đọc, bấm nút nổi bật nhất, dùng bàn phím/autofill | Hành động nguy hiểm dễ bấm nhầm, xác nhận thừa, thừa bước |
| `P-MOBILE` | Mobile, mạng yếu, một tay | Màn nhỏ, chạm thay vì hover, mạng 3G/chập chờn, bị gián đoạn (cuộc gọi, chuyển app) | Nút quá nhỏ, mất dữ liệu khi reload, không có trạng thái chờ |
| `P-LOWTECH` | Ít rành công nghệ / lớn tuổi | Chữ to, chậm, sợ bấm sai, không hiểu icon không có nhãn | Icon mơ hồ, timeout quá ngắn, thông báo lỗi kỹ thuật |
| `P-A11Y` | Dùng công nghệ hỗ trợ | Chỉ bàn phím, screen reader, phóng to 200%, tương phản cao | Không focus được, nhãn thiếu, thông tin chỉ truyền bằng màu |
| `P-RETURN` | Người dùng quay lại sau thời gian dài | Quên mật khẩu, quên đang làm dở gì, dữ liệu cũ | Không tiếp tục được việc dở, khôi phục tài khoản khó |
| `P-ADMIN` | Người vận hành/quản trị xử lý số lượng lớn | Thao tác hàng loạt, lọc/tìm nhiều, làm lặp lại cả ngày | Thiếu bulk action, phân trang/lọc bất tiện, mất bộ lọc khi quay lại |

Mỗi persona khi dùng cần ghi: vai trò/quyền, thiết bị, mức thành thạo, bối cảnh (đang vội? bị
gián đoạn?), và **điều persona không biết**.

## 2. Cognitive walkthrough — 4 câu hỏi ở mỗi bước

| # | Câu hỏi | Trả lời "Không" thường do |
|---|---|---|
| Q1 | Người dùng có **muốn** làm đúng hành động này không (họ có biết bước này cần thiết)? | Bước ẩn, yêu cầu ngầm, mô hình tư duy khác hệ thống |
| Q2 | Người dùng có **nhìn thấy** điều khiển cần dùng không? | Nằm trong menu ẩn, dưới màn gập, chỉ hiện khi hover |
| Q3 | Người dùng có **nhận ra** điều khiển đó dẫn tới mục tiêu của họ không? | Nhãn kỹ thuật, icon không nhãn, hai nút giống nhau |
| Q4 | Sau khi làm, người dùng có **biết mình đang tiến đúng** không? | Không phản hồi, thông báo mơ hồ, trạng thái không đổi |

## 3. Tín hiệu ma sát quan sát được

| Tín hiệu | Cách đo/ghi | Ngưỡng gợi ý cần xem xét |
|---|---|---|
| Số bước / click tới mục tiêu | Đếm từ điểm vào tới khi xong | Nhiều hơn rõ rệt so với luồng tương tự trong sản phẩm hoặc đối thủ |
| Quay lại / đi lạc | Số lần Back, mở sai màn | ≥ 1 lần lạc với `P-NEW` là đáng ghi |
| Chờ không phản hồi | Thời gian từ thao tác tới phản hồi nhìn thấy | > 1 s không có loading; > 10 s không có tiến độ |
| Phải đoán nghĩa | Ghi nguyên văn chữ/icon gây đoán | Bất kỳ thuật ngữ nội bộ, mã lỗi, viết tắt |
| Nhập lại thông tin | Trường hệ thống đã biết mà vẫn hỏi | Bất kỳ |
| Lỗi không chỉ cách sửa | Ghi nguyên văn thông báo | Không nói **cái gì** sai và **sửa thế nào** |
| Mất công sức | Dữ liệu đã nhập mất sau lỗi/Back/reload | Bất kỳ — thường mức 3–4 |
| Hành động nguy hiểm dễ nhầm | Xoá/huỷ/thanh toán cạnh nút thường, không xác nhận, không hoàn tác | Bất kỳ |
| Không nhất quán | Cùng hành động khác nhãn/vị trí giữa các màn | Bất kỳ |

## 4. 10 heuristic Nielsen — câu hỏi kiểm tra

| # | Heuristic | Câu hỏi kiểm tra |
|---|---|---|
| H1 | Hiển thị trạng thái hệ thống | Người dùng luôn biết đang xảy ra gì, đã lưu chưa, đang ở bước mấy? |
| H2 | Khớp với thế giới thật | Ngôn ngữ, thứ tự, đơn vị, định dạng ngày/tiền có theo thói quen người dùng? |
| H3 | Quyền kiểm soát và tự do | Có huỷ, quay lại, hoàn tác mà không mất dữ liệu? |
| H4 | Nhất quán và chuẩn | Cùng khái niệm cùng tên, cùng hành động cùng vị trí, theo quy ước nền tảng? |
| H5 | Phòng lỗi | Có chặn trước lỗi (giới hạn, gợi ý, xác nhận hành động không hoàn tác)? |
| H6 | Nhận ra thay vì nhớ | Người dùng phải nhớ thông tin từ màn trước không? |
| H7 | Linh hoạt và hiệu quả | Người quen tay có lối tắt (bàn phím, bulk, nhớ lựa chọn) không? |
| H8 | Tối giản | Có thông tin/thao tác thừa cạnh tranh sự chú ý với việc chính? |
| H9 | Giúp nhận biết, chẩn đoán, phục hồi lỗi | Thông báo lỗi bằng ngôn ngữ thường, chỉ đúng chỗ, gợi ý cách sửa? |
| H10 | Trợ giúp và tài liệu | Khi bí, có trợ giúp đúng ngữ cảnh không? |

## 5. Thang mức độ

| Mức | Tên | Khi nào |
|---|---|---|
| 0 | Không phải vấn đề | Ý kiến cá nhân, không có tín hiệu quan sát — không đưa vào report |
| 1 | Thẩm mỹ | Không cản trở, sửa khi có thời gian |
| 2 | Nhỏ | Gây chậm/khựng nhưng người dùng tự vượt qua |
| 3 | Lớn | Nhiều người dùng mắc, mất nhiều công, hoặc dễ hiểu nhầm dẫn tới sai kết quả |
| 4 | Thảm hoạ | Người dùng bỏ cuộc, mất dữ liệu/tiền, hoặc làm sai mà không biết |

Tăng một mức nếu nằm trên luồng tạo giá trị chính (đăng ký, thanh toán, nộp đơn) hoặc ảnh
hưởng tới `P-A11Y`/`P-LOWTECH` mà không có đường vòng (tối đa mức 4).

## 6. Checklist đánh giá design (Figma / prototype / màn hình thật)

| Nhóm | Câu hỏi kiểm tra |
|---|---|
| Phân cấp thị giác | Trong 3 giây, persona có thấy ngay đây là màn gì và việc chính cần làm là gì? Chỉ có **một** hành động chính nổi bật? |
| Câu chữ (microcopy) | Nhãn nút nói đúng kết quả (`Gửi đơn`, không phải `OK`)? Không thuật ngữ nội bộ, mã lỗi, viết tắt? Cùng khái niệm cùng một tên? |
| Form | Chỉ hỏi điều thật cần? Nhãn luôn hiện (không chỉ placeholder)? Định dạng, giới hạn nói trước? Lỗi hiện cạnh trường, giữ dữ liệu đã nhập? |
| Đủ trạng thái | Design có loading, rỗng (lần đầu / không có kết quả), lỗi, thành công, không có quyền, dữ liệu rất dài/rất nhiều? Thiếu state nào → ghi `EXP` |
| Phản hồi sau thao tác | Sau mỗi hành động, người dùng biết đã thành công/thất bại và bước tiếp theo? |
| Hành động nguy hiểm | Xoá/huỷ/thanh toán tách khỏi nút thường, có xác nhận nêu rõ hậu quả hoặc cho hoàn tác? |
| Điều hướng | Biết mình đang ở đâu, quay lại được, không mất việc đang làm dở? |
| Nhất quán | Vị trí, màu, icon, kiểu nút giống các màn khác và design system? |
| Mobile & chạm | Vùng chạm đủ lớn, hành động chính trong tầm ngón cái, không phụ thuộc hover, bàn phím đúng loại cho trường? |
| Tiếp cận | Tương phản đủ, thông tin không chỉ truyền bằng màu, icon có nhãn, chữ phóng to không vỡ? |

## 7. Mẫu viết Expected đề xuất

Viết sao cho BA chép thẳng được thành expected và QA kiểm chứng được:

> **Khi** `<tình huống người dùng gặp>` **thì** `<hệ thống làm gì>` **và người dùng thấy**
> `<nguyên văn thông điệp / trạng thái>` **để** `<người dùng làm được gì tiếp>`.

Ví dụ: Khi danh sách đơn hàng chưa có đơn nào thì hiện minh hoạ trạng thái rỗng và người
dùng thấy `Bạn chưa có đơn hàng nào` cùng nút `Mua sắm ngay` để bắt đầu mua.

Tránh: "hiển thị thông báo phù hợp", "xử lý lỗi hợp lý" — không kiểm chứng được.

## 8. Đề xuất thuận tiện nhưng không làm nặng hệ thống

| Đề xuất UX hay gặp | Rủi ro hiệu năng nếu làm thô | Cách làm cân bằng nên đề xuất kèm |
|---|---|---|
| Tìm kiếm/gợi ý ngay khi gõ | Mỗi phím một request | Debounce ~300 ms, chỉ gọi khi ≥ 2–3 ký tự, huỷ request cũ, cache kết quả gần nhất |
| Tự động lưu nháp | Ghi DB liên tục | Lưu cục bộ trước, đồng bộ theo khoảng hoặc khi rời trường/trang |
| Hiện toàn bộ dữ liệu cho tiện xem | Payload lớn, truy vấn chậm, trình duyệt giật | Phân trang hoặc tải dần, chỉ lấy cột cần, virtual list cho danh sách dài |
| Cập nhật realtime (số lượng, trạng thái) | Polling dày, giữ nhiều kết nối | Chỉ realtime ở màn cần; còn lại làm mới khi quay lại tab hoặc nút "Làm mới" |
| Kiểm tra trùng ngay khi nhập (email, mã) | Request mỗi lần gõ | Kiểm tra khi rời trường, debounce, giới hạn tần suất |
| Bộ lọc nhiều tiêu chí áp dụng tức thì | Mỗi lần tick một truy vấn nặng | Gom thay đổi rồi áp dụng sau ngắn trễ hoặc nút "Áp dụng" khi truy vấn nặng |
| Ảnh/preview lớn cho đẹp | Tốn băng thông, chậm trên mobile | Thumbnail đúng kích thước, lazy load, định dạng nén |
| Export/báo cáo ngay trên màn | Request dài, timeout | Xử lý nền, báo tiến độ, gửi thông báo/link tải khi xong |
| Tải trước màn tiếp theo cho nhanh | Tải thừa dữ liệu người dùng không dùng | Chỉ prefetch bước có xác suất cao (bước kế tiếp của flow chính) |

**Hiệu năng cảm nhận thường rẻ hơn hiệu năng thật**: skeleton, hiện ngay dữ liệu đã có, cập
nhật lạc quan (có hoàn tác khi lỗi), khoá nút khi đang gửi để tránh gửi trùng — cải thiện trải
nghiệm mà không thêm tải.

Đề xuất **giảm** tải ghi mức `Giảm tải` vì là điểm cộng kép: bỏ bước thừa, không bắt nhập lại dữ liệu
đã có, gộp nhiều màn xác nhận, tránh reload toàn trang sau mỗi thao tác.

## 9. Giọng văn khi viết comment

Theo mục "Giọng văn khi viết comment, bug, report" trong `.github/copilot-instructions.md` của
workspace: thẳng, không nước đôi, không cảm tính, không sến, không văn máy. Với review UX, lưu ý
thêm: viết hành vi UI thay cho cảm nhận của persona ("bấm `Tiếp tục` thì gửi đơn luôn", không
"người dùng sẽ tưởng..."), và mỗi `UXF`/`EXP` chỉ một đề xuất.
