# Automation Strategy

## Chọn case để automation

Ưu tiên automation khi case:

- Chạy lặp lại trong mỗi PR/release.
- Có expected result ổn định và quan sát được.
- Có rủi ro hoặc chi phí hồi quy cao.
- Là smoke, critical path, permission hoặc data integrity.
- Có dữ liệu tạo/xóa được và môi trường kiểm soát được.

Không ưu tiên automation khi case:

- Chỉ đánh giá cảm quan hoặc nội dung thay đổi thường xuyên.
- Phụ thuộc CAPTCHA, OTP thật, thanh toán thật hoặc bên thứ ba không ổn định.
- Cần exploratory testing, usability hoặc đánh giá con người.
- Chi phí bảo trì selector/dữ liệu cao hơn giá trị phát hiện lỗi.

## Tiêu chí quyết định

Chấm mỗi case từ 1 đến 5:

- `Frequency`: tần suất chạy.
- `Risk`: tác động nếu lỗi lọt.
- `Stability`: độ ổn định của môi trường và expected result.
- `Feasibility`: khả năng tạo dữ liệu và kiểm chứng tự động.
- `Maintenance`: chi phí bảo trì, chấm ngược.

Automation đề xuất khi tổng điểm từ 17/25 hoặc là P0/P1 critical path. Case dưới ngưỡng vẫn có thể automation nếu là regression bắt buộc.

## Nguyên tắc Playwright

- Dùng `getByRole`, `getByLabel`, `getByTestId`; tránh CSS/XPath phụ thuộc layout.
- Mỗi test độc lập, không phụ thuộc thứ tự chạy.
- Tạo dữ liệu bằng API/fixture khi có thể; UI chỉ kiểm chứng UI.
- Không dùng `waitForTimeout`; chờ theo assertion hoặc trạng thái mạng.
- Assert cả kết quả chính và side effect quan trọng.
- Dùng trace/video/screenshot khi retry hoặc failure.
- Page Object chỉ gom locator và hành vi dùng lại; không che khuất assertion nghiệp vụ.
- Với lỗi backend, kiểm chứng thông báo người dùng và không làm mất dữ liệu.
