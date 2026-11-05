# Report Catalog — loại report và dữ liệu cần có

Dùng ở Step 4: với từng report business cần, kiểm tra điều kiện tối thiểu và đánh dấu
**Làm được / Một phần / Chưa làm được**.

| Report (Mixpanel) | Trả lời câu hỏi | Điều kiện tối thiểu | Lỗi tracking hay làm hỏng |
|---|---|---|---|
| **Insights** (trend, count, unique) | Bao nhiêu lần/người làm X theo thời gian | Event X bắn đúng một lần mỗi hành động | Bắn lặp (TR-21), lẫn data test (TR-61) |
| **Funnel** | Tỉ lệ đi từ bước A → B → C, rớt ở đâu | Event cho từng bước, cùng `distinct_id` | Không identify (TR-40), bắn success lúc click (TR-20), thiếu bước cuối (TR-01) |
| **Funnel theo đơn** | Conversion theo từng đơn/giỏ | Join key chung (`order_id`) | TR-50 |
| **Retention** | User có quay lại làm Y sau khi làm X không | Event "bắt đầu" + "quay lại" rõ ràng, identity ổn định | TR-40, TR-41, TR-42 |
| **Flows** | User đi đường nào trước/sau một bước | Event đủ dày ở các điểm rẽ, tên nhất quán | Quá gộp (TR-13), tên lẫn lộn (TR-10) |
| **Breakdown / Segmentation** | Khác nhau theo kênh, platform, version, plan | Property breakdown ở đúng event hoặc super property | TR-02, TR-43, enum lộn xộn (TR-31) |
| **Cohort** | Nhóm user theo hành vi/thuộc tính | User profile hoặc event định nghĩa nhóm | TR-44 |
| **Error / failure rate** | Tỉ lệ lỗi validate, API, thanh toán | Event lỗi có `error_code`, `step` | Chỉ track success (TR-04) |
| **Feature adoption** | Bao nhiêu % user dùng feature | Event dùng feature + tổng active user | Tên event theo nút (TR-12) |
| **Revenue** | Doanh thu, AOV, LTV | `amount` dạng số, `currency`, event refund | TR-30, TR-32 |
| **Experiment** | Biến thể nào tốt hơn | Exposure event + metric event, cùng identity | Exposure bắn sai thời điểm |

## Cách trình bày trong báo cáo

| Câu hỏi business | Loại report | Trạng thái | Event/property đang có | Còn thiếu |
|---|---|---|---|---|
| Conversion Sign up → First purchase theo kênh | Funnel + Breakdown | Một phần | `Sign Up Completed`, `Order Placed` | `channel` ở `Order Placed` (TR-02) |

## Kiểm chứng bằng Mixpanel MCP (khi đã có data)

1. `Get-Query-Schema` để lấy cấu trúc query hợp lệ.
2. `Run-Query` cho từng report "Làm được": ghi kỳ thời gian, project, kết quả tóm tắt.
3. Số liệu bất thường (conversion > 100%, user đếm gấp đôi) là bằng chứng cho `TR-RISK`/`TR-BUG`.
4. Đối soát với DB/backend nếu có quyền đọc (TR-51), không chỉ tin Mixpanel.
