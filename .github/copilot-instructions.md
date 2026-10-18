# QA Test Script Rules

Khi người dùng yêu cầu viết test script hoặc test cases trong workspace này:

0. Trước khi sửa bất cứ thứ gì: chạy `npm run qa:impact -- <REQ-id>` để biết requirement đó đang ràng buộc file nào, và `npm run qa:gaps` để biết chỗ nào đang trống. Không tự đoán bằng cách đọc lướt thư mục.
1. Đọc requirement gần nhất trong `requirements/` và xác định các page/module liên quan.
2. Nếu requirement chưa đủ, không tự bịa expected result. Ghi `Open questions` và nêu rõ assumption cần xác nhận.
3. Chuẩn hóa hoặc cập nhật requirement theo `templates/requirement-template.md` với mã REQ/AC ổn định.
4. Thiết kế test case theo `templates/test-case-template.md`, bắt buộc xem xét happy path, negative, boundary, state/permission, error/retry và regression.
   - **Quy tắc kiểm thử ô nhập liệu (Field Validation — Maxlength & Data Type)**:
     - **Textbox chữ**: Bắt buộc xét rỗng/chỉ khoảng trắng, biên độ dài `minlength`/`maxlength` (`max`, `max + 1` ký tự — kiểm tra thuộc tính `maxlength` tự cắt chuỗi hoặc báo lỗi validation).
     - **Textbox số (Numeric input)**: Bắt buộc xét nhập chữ (`abc`), ký tự đặc biệt (`!@#`), paste chuỗi lẫn chữ (`12abc34`), số âm/thập phân (nếu chỉ nhận số nguyên dương), và biên giá trị `min - 1`, `min`, `max`, `max + 1`.
   - **Quy tắc XSS theo loại trang (Page Exposure)**: Với các trang/module dành cho `public` hoặc `customer` (end-user) có ô nhập liệu hoặc query param hiển thị lại lên UI, bắt buộc xét thêm test case XSS (`Type: Security`, tag `@security`). Với trang thuần `admin`/nội bộ (không hiển thị dữ liệu thô do customer/public gửi lên), không cần viết test XSS và ghi rõ lý do vào mục `Coverage notes`.
   - **Quy tắc kiểm thử UI/UX & Layout**: Kiểm tra các lỗi hiển thị phổ biến (`Type: UI/UX`, tag `@ui` hoặc `@a11y`): các phần tử/thông báo lỗi bật lên không đè nhau (**Overlap**), không vỡ khung ngang (**Horizontal Overflow** trên Desktop & Mobile), chuỗi dài ở biên `max` không tràn khỏi khung chứa (**Text/Container Overflow**), ảnh hiển thị không bị vỡ (**Broken Images**), và nút Submit khoá/loading khi đang xử lý (**Double-submit protection**). Ưu tiên dùng sẵn các hàm helper trong `playwright/tests/support/ui-checks.ts`.
   - **Quy tắc chụp bằng chứng hành trình (Journey Evidence & Flow Timeline)**: Với các test case kiểm thử hành trình người dùng xuyên suốt (Happy path, E2E User Journey, gắn tag `@journey`), chụp ảnh theo các mốc chuyển trạng thái quan trọng (**Milestone States**: Khởi tạo $\to$ Nhập liệu $\to$ Submit $\to$ Hoàn tất) qua helper `captureJourneyStep()` trong `playwright/tests/support/evidence.ts`. Tuyệt đối không chụp đại trà ở test negative/boundary để bảo đảm hiệu năng CI/CD. Hỗ trợ bật/tắt linh hoạt qua biến môi trường `CAPTURE_JOURNEY`.
5. Tạo traceability `REQ -> AC -> TC -> script` và đánh priority P0-P3.
6. Đánh giá candidate automation theo `docs/automation-strategy.md`; giải thích case nào không automation và lý do.
7. Với case được chọn, viết Playwright theo từng step rõ ràng trong `playwright/tests/`, gắn REQ/AC/TC trong title hoặc comment.
8. Dùng locator theo `docs/selector-convention.md`: ưu tiên `getByRole`, `getByLabel`, `getByTestId`; không dùng `waitForTimeout`, selector theo CSS layout hoặc test phụ thuộc thứ tự. ESLint chặn các vi phạm này.
9. Mỗi test phải độc lập, rerunnable, có setup/cleanup theo `docs/test-data-management.md`, và assertion cho kết quả chính cùng side effect quan trọng.
10. Import `test`/`expect` từ `tests/fixtures/test-fixtures.ts`, không từ `@playwright/test` (trừ file setup). Đặt title `TC-xxx - AC-yyy <mô tả>` và gắn tag priority `@p0`..`@p3`.
11. Sau khi sửa, chạy validation hẹp nhất có thể: `npm run verify` trong thư mục `playwright/` (typecheck + lint + `--list`), rồi test phù hợp nếu môi trường có sẵn.
12. Chạy `npm run qa:matrix` để cập nhật ma trận truy vết (không sửa tay), rồi chạy `npm run qa:check` ở thư mục gốc. Còn finding mức `major` trở lên thì chưa xong việc.
    - Test mới phải có tag `@REQ-xxx` ở `test.describe` và title dạng `TC-xxx - AC-xxx <mô tả>`, nếu không tool sẽ không thấy nó.
    - Dòng mới trong bảng `Rules and validation` phải điền cột `Test cases`.
13. Test không ổn định xử lý theo `docs/flaky-test-policy.md`; không tăng timeout hoặc `test.skip` để chữa cháy.

Khi người dùng cung cấp test automation hiện có:

1. Dùng script làm nguồn bằng chứng để lập inventory `spec -> test -> page/API/fixture/data`.
2. Suy ra precondition, action, expected result, role, state và business rule từ test title, setup, assertion và cleanup.
3. Ghi requirement theo template với nguồn `Inferred from automation`; không biến selector, URL hoặc chi tiết framework thành requirement nghiệp vụ.
4. Gắn trạng thái cho từng kết luận: `Confirmed` nếu có tài liệu/owner xác nhận, `Inferred` nếu suy ra từ script, `Needs confirmation` nếu script chưa đủ bằng chứng.
5. Tạo danh sách gap: requirement chưa được test, test không có assertion, assertion không đủ mạnh, dữ liệu hard-code, dependency ẩn và case chưa automation.
6. Giữ nguyên traceability tới đường dẫn file và test title để có thể audit ngược.

Tham chiếu mẫu đầy đủ: `requirements/REQ-001-sign-in.md` -> `test-cases/REQ-001-sign-in.md` -> `test-cases/REQ-001-sign-in.automation-plan.md` -> `playwright/tests/auth/login.spec.ts`. Theo đúng cấu trúc và mức chi tiết của bộ này.

Ngôn ngữ tài liệu có thể là tiếng Việt; mã, ID, tên file và test title dùng tiếng Anh ổn định. Không đưa credential thật vào file; mọi giá trị nhạy cảm đi qua `requireEnv()` và được khai báo trong `playwright/.env.example`.
