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

## Tổ chức module và giới hạn kích thước file (Pre-commit Code Budget)

Để đồng bộ hoàn toàn với cổng `quality-policy.json` và `split_check` lúc `git commit` (tránh phải sửa/tách tay trước khi commit), mọi file automation khi viết mới hoặc thêm test/logic phải nằm **dưới mốc vùng vàng 80%**:

| Thành phần Automation | Role khi Audit | Trần cứng | Vùng vàng (80%) | Mục tiêu khi viết | Cách phân rã chuẩn |
|---|---|---|---|---|---|
| Kịch bản kiểm thử (`*.spec.ts`, `*.test.ts`) | `test` | $\le 800$ dòng | $\ge 640$ dòng | **$< 600$ dòng** | Tách theo nhóm luồng/chiều kiểm thử (`*.happy.spec.ts`, `*.validation.spec.ts`, `*.security.spec.ts`, `*.resilience.spec.ts`), giữ `{ tag: '@REQ-xxx' }` ở `test.describe` |
| Page Object, Fixture, Support, Data, `ApiClient` trong `tests/`, `*.setup.ts`, `*.config.ts` | `module` | $\le 250$ dòng | $\ge 200$ dòng | **$< 190$ dòng** | Tách POM theo khối UI con (Modal, Form, FilterBar); tách `ApiClient` theo domain; đưa mock data lớn sang `.json` |
| Service / API / Client đặt **ngoài** `tests/` | `service` | $\le 200$ dòng | $\ge 160$ dòng | **$< 150$ dòng** | Tách mỗi resource nghiệp vụ một file (`auth.api.ts`, `orders.api.ts`) |
| Helper / Utils đặt **ngoài** `tests/` | `utils` | $\le 150$ dòng | $\ge 120$ dòng | **$< 115$ dòng** | Phân rã theo miền chức năng, không gom chung kiểu kitchen-sink |

- Không có dòng đơn nào $> 500$ ký tự (`maxLineLength: 500`), độ dài trung bình dòng không rỗng $\le 100$ ký tự cho file $\ge 50$ dòng (`maxAvgLineLength: 100`), và không commit file mang tên `.ai-test.` / `.scratch.`.
- Chạy `npm run qa:limits -- --strict` (đã tích hợp sẵn trong `npm run qa:check` và `playwright` `npm run verify`) sau mỗi đợt viết/sửa code.
