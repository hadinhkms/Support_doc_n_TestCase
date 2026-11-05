# Event Design Checklist (`TR-xx`)

Dùng cho từng event trong tracking req hoặc trong data bắt được. Mỗi mục có mã để trích dẫn
trong báo cáo.

## A. Business fit

| Mã | Kiểm tra | Dấu hiệu lỗi | Hậu quả với report |
|---|---|---|---|
| TR-01 | Mỗi câu hỏi report có event mốc bắt đầu và kết thúc | Funnel thiếu bước cuối (chỉ có `Checkout Started`) | Không tính được conversion |
| TR-02 | Property dùng để breakdown có mặt ở đúng event | `channel` chỉ có ở `Sign Up`, không có ở `Purchase` | Không breakdown purchase theo kênh |
| TR-03 | Phân biệt được user mới/cũ, plan, vai trò nếu business cần | Không có `is_first_time`, `plan` | Không phân khúc được |
| TR-04 | Có event cho nhánh lỗi/huỷ quan trọng | Chỉ track success | Không đo drop-off vì lỗi |

## B. Naming & granularity

| Mã | Kiểm tra | Dấu hiệu lỗi |
|---|---|---|
| TR-10 | Một convention duy nhất (ví dụ `Object Action` Title Case, thì quá khứ) | `SignUp`, `sign_up_clicked`, `Register Success` lẫn lộn |
| TR-11 | Không nhét giá trị động vào tên event | `View Product 123`, `Click Tab Settings` |
| TR-12 | Không quá vụn: hành động cùng loại gộp một event + property | `Click Button A`, `Click Button B` → `Button Clicked {button_name}` |
| TR-13 | Không quá gộp: một event không mang 2 nghĩa khác nhau | `Action` với `type` = mọi thứ |
| TR-14 | Tên property nhất quán giữa các event | `product_id` ở event này, `productId` ở event khác |

## C. Trigger timing

| Mã | Kiểm tra | Dấu hiệu lỗi |
|---|---|---|
| TR-20 | Event "thành công" bắn sau khi server xác nhận | `Payment Completed` bắn lúc click Pay |
| TR-21 | Không bắn lặp khi re-render, reload, back/forward | `Page Viewed` x2 mỗi lần vào trang |
| TR-22 | Double-click/submit không tạo 2 event | 2 `Order Placed` cùng `order_id` |
| TR-23 | Thời điểm bắn được viết rõ trong req | "Bắn khi user đặt hàng" (click hay success?) |
| TR-24 | Event mang nghĩa "hành động" không bắn khi chỉ load/reload trang; nếu có thì phải có property phân biệt (`trigger`) | `Job Search Performed` bắn mỗi lần load trang kết quả, reload gửi lại cùng `request_id` |
| TR-25 | Trạng thái người dùng chọn (filter, tab, phiên bản) được giữ sau reload, hoặc req ghi rõ hành vi | Reload làm filter "mới" thành "cũ", tracking ghi theo |

## D. Property schema

| Mã | Kiểm tra | Dấu hiệu lỗi |
|---|---|---|
| TR-30 | Kiểu dữ liệu cố định | `price` lúc string lúc number |
| TR-31 | Enum có danh sách giá trị và quy ước hoa thường | `Success` / `success` / `SUCCESS` |
| TR-32 | Tiền tệ có `currency`, rõ trước/sau giảm giá, có thuế không | `amount` không rõ đơn vị |
| TR-33 | Thời gian dùng chuẩn (ISO 8601 / epoch) và timezone rõ | Chuỗi ngày tự do |
| TR-34 | Property bắt buộc vs tuỳ chọn được đánh dấu | Thiếu ngẫu nhiên, filter ra số sai |
| TR-35 | List/object được dùng đúng (Mixpanel hỗ trợ list) | Nối chuỗi `"a,b,c"` |
| TR-36 | Một property chỉ mang một nghĩa; không mã hoá trạng thái đặc biệt vào giá trị số | `province_number` = tổng số tỉnh để biểu thị "Toàn quốc", nên không phân biệt được với chọn tay đủ mọi tỉnh |
| TR-37 | Giá trị gửi ở dạng breakdown được, không URL-encode | `url` = `%2Fviec-lam-ha-noi-p73.html` |

## E. Identity & user profile

| Mã | Kiểm tra | Dấu hiệu lỗi | Hậu quả |
|---|---|---|---|
| TR-40 | `identify` gọi lúc login và signup thành công | Không identify | User trước/sau login thành 2 người, funnel đứt |
| TR-41 | `reset` khi logout | Không reset | Máy dùng chung gộp nhiều người |
| TR-42 | ID dùng để identify ổn định, không phải email | `identify(email)` | Đổi email là mất lịch sử; lộ PII |
| TR-43 | Super property cho thuộc tính cần ở mọi event | `platform`, `app_version` chỉ có ở 1 event | Không breakdown chung |
| TR-44 | User profile (`people.set`) cho thuộc tính người dùng | Plan chỉ gửi theo event | Cohort theo plan khó |

## F. Join keys & đối soát

| Mã | Kiểm tra | Dấu hiệu lỗi |
|---|---|---|
| TR-50 | Các bước funnel có ID chung khi cần ghép theo đơn | Không có `order_id` |
| TR-51 | Có thể đối soát với DB/backend (số đơn Mixpanel ≈ số đơn DB) | Không có ID backend |
| TR-52 | Group analytics (company/workspace) nếu sản phẩm B2B | Không có `company_id` |

## G. Data hygiene

| Mã | Kiểm tra | Dấu hiệu lỗi |
|---|---|---|
| TR-60 | Không bắn trùng từ client và server | Hai nguồn cùng `Purchase` |
| TR-61 | Tách hoặc đánh dấu môi trường test/staging | Data QA lẫn production |
| TR-62 | Không có PII trong property/tên event | Email, SĐT, địa chỉ trong `properties` |
| TR-63 | Event cũ/đổi tên có kế hoạch migrate hoặc merge trong Lexicon | Hai tên cho cùng một hành vi |
| TR-64 | Bot/internal user được loại hoặc đánh dấu | Nhân viên test ảnh hưởng số liệu |

## H. Testability

| Mã | Kiểm tra |
|---|---|
| TR-70 | Mỗi event có: điều kiện trigger, nguồn (client/server), property bắt buộc + ví dụ giá trị |
| TR-71 | Có cách verify trên môi trường test (network hoặc Live Events) |
| TR-72 | Có expected số lần bắn trong một flow |
