# QA Test Script Rules

Khi người dùng yêu cầu viết test script hoặc test cases trong workspace này:

0. Trước khi sửa bất cứ thứ gì: chạy `npm run qa:impact -- <REQ-id>` để biết requirement đó đang ràng buộc file nào, và `npm run qa:gaps` để biết chỗ nào đang trống. Không tự đoán bằng cách đọc lướt thư mục.
1. Đọc requirement gần nhất trong `requirements/` và xác định các page/module liên quan.
2. Nếu requirement chưa đủ, không tự bịa expected result. Ghi `Open questions` và nêu rõ assumption cần xác nhận.
3. Chuẩn hóa hoặc cập nhật requirement theo `templates/requirement-template.md` với mã REQ/AC ổn định, bổ sung **Canonical Metadata** (`- **Page exposure**: Public | Customer | Authenticated | Admin`, `- **UI coverage**: Required | Exempt`, `- **XSS applicability**: Applicable | Exempt`) và bảng `## Coverage notes` 4 chiều (`UI/UX Geometry`, `XSS Security`, `Idempotency`, `State Persistence`).
4. Thiết kế test case theo `templates/test-case-template.md`, gắn thẻ `- **Capabilities**: ...` (`persistence`, `boundary`, `idempotency`, `ui-geometry`, `a11y`, `responsive`, `xss`) cho từng TC và bắt buộc xem xét 5 chiều kiểm thử chuyên sâu:
   - **Quy tắc Bền vững trạng thái, Idempotency, Chịu lỗi mạng & Đa Tab (`persistence`, `idempotency`, `resilience`, `concurrency`)**: Dùng `expectStatePersistence(page, assertFn)` để chứng minh trạng thái không mất sau `page.reload()`, `expectIdempotentSubmit(page, trigger, urlPattern)` để chặn gửi trùng khi nhấn liên tiếp, `expectNetworkFaultRecovery(page, trigger, options)` để kiểm chứng form bảo toàn dữ liệu và nút Submit không treo khi lỗi 5xx/rớt mạng, và `expectMultiTabConcurrency(page, scenario)` khi cần kiểm chứng chống ghi đè giữa 2 tab trong `playwright/tests/support/deep-guards.ts` (hoặc `core/deep-testing` ở các dự án vệ tinh).
   - **Quy tắc kiểm thử ô nhập liệu (Field Validation — `boundary`)**:
     - **Textbox chữ**: Bắt buộc xét rỗng/chỉ khoảng trắng, biên độ dài `minlength`/`maxlength` (`max`, `max + 1` ký tự) và `UNICODE_OVERFLOW_PAYLOADS` qua `expectBoundaryRejected` (`playwright/tests/support/deep-guards.ts`).
     - **Textbox số (Numeric input)**: Bắt buộc xét nhập chữ (`abc`), ký tự đặc biệt (`!@#`), paste chuỗi lẫn chữ (`12abc34`), số âm/thập phân (nếu chỉ nhận số nguyên dương), và biên giá trị `min - 1`, `min`, `max`, `max + 1`.
   - **Quy tắc XSS theo loại trang (`xss` — Page Exposure)**: Với các trang/module dành cho `public` hoặc `customer` (hoặc `XSS applicability: Applicable`) có ô nhập liệu hoặc query param hiển thị lại lên UI, bắt buộc xét thêm test case XSS (`Type: Security`, tag `@security`, capability `xss`) dùng `expectSafeXssRender(page, { inputLocator, submitLocator, sinkLocator })` và `XSS_PAYLOADS` trong `playwright/tests/support/deep-guards.ts`. Với trang thuần `admin`/nội bộ (`Exempt`), ghi rõ lý do vào mục `Coverage notes`.
   - **Quy tắc kiểm thử UI/UX Geometry, Responsive & A11y (`ui-geometry`, `a11y`, `responsive`)**: Với `UI coverage: Required`, bắt buộc dùng bộ 5 hàm trong `playwright/tests/support/ui-checks.ts`: `expectNoHorizontalScroll(page)`, `expectNoTextOverflow(page, rootLocator)`, `expectNotOccluded(page, targetLocator)`, `expectInteractiveA11y(page, rootLocator)`, và `expectResponsiveIntegrity(page, { requiredLocators, optionalLocators })`. Không viết test chỉ có `toBeVisible()`/`toBeDefined()` (`weak-existence-assertion`).
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
14. **Cổng Xác Minh Bug Thực — Cấm Đoán Mò & Cấm Báo Bug Ảo do Lỗi Test (Zero False-Positive & Reproducibility Gate)**:
    - Tuyệt đối **không báo một hiện tượng là Bug của ứng dụng** chỉ sau 1 lần tình cờ thấy hoặc dựa trên suy đoán lý thuyết.
    - Khi một test fail hoặc phát hiện bất thường, bắt buộc thực hiện **3 bước lọc nhiễu** trước khi kết luận là Bug:
      1. **Loại trừ lỗi do chính Test Script / Môi trường (Rule Out Test Faults First)**: Kiểm tra xem lỗi có phải do viết sai selector/locator, thiếu `await`, bấm khi trang chưa hydrate/đang chạy animation, dùng dữ liệu bẩn/trùng từ lần chạy trước, hoặc cấu hình sai env/token hay không. Nếu do test script $\to$ phải sửa ngay test script rồi chạy lại, **cấm báo là bug của app**.
      2. **Xác minh khả năng tái hiện (Reproducibility Verification)**: Chạy lại đúng kịch bản đó trong trạng thái sạch (`npx playwright test <spec> --repeat-each=3` hoặc gọi lại API độc lập). Chỉ khi lỗi tái hiện nhất quán với cùng nguyên nhân và triệu chứng mới được công nhận là **Confirmed Bug (`BUG-xx`)**. Nếu chạy lại mà không còn thấy lỗi, phải điều tra lại timing của test hoặc dùng bộ kích hoạt đồng thời (`Promise.all` / `expectMultiTabConcurrency`) để xác minh rõ nguyên nhân trước khi báo.
      3. **Bằng chứng kép & Quy ước trình bày khi tạo Bug (Dual Proof & Bug Presentation)**: Mọi Bug báo cáo phải kèm đồng thời: (a) bằng chứng thực thi khi tái hiện lỗi (log lỗi `runtimeTrap`, HTTP status/payload, ảnh/DOM thực tế) và (b) chỉ rõ dòng code/logic gây lỗi (`file:line`) nếu có quyền đọc mã nguồn ứng dụng, hoặc chuỗi bước tái hiện tối giản (`Steps to Reproduce` / lệnh `curl`). Khi viết nội dung Bug, dùng từ ngữ tự nhiên, ngắn gọn, dễ đọc và dễ hình dung; mục mô tả tình huống đặt tên đúng là **`Bối cảnh nghiệp vụ`** (không đặt tiêu đề kiểu *"Giải thích dễ hiểu cho Dev"*). Ảnh bằng chứng (`Visual Evidence`) bắt buộc phải **khoanh vùng (khung đỏ) trực tiếp vào vị trí bị sai** (dùng `captureAnnotatedBugEvidence` trong `playwright/tests/support/evidence.ts`) để nhìn vào hình biết ngay chỗ cần tập trung.

## Review mã frontend và UI/UX

Khi người dùng yêu cầu review UI/UX hoặc mã frontend của ứng dụng được kiểm thử, dùng
[skill qa-ui-review](../.agents/skills/qa-ui-review/SKILL.md). Skill bổ sung checklist
đọc mã và kiểm tra giao diện; quy định viết test, traceability và cổng xác minh Bug
ở trên vẫn là nguồn duy nhất. Không tự áp dụng toàn bộ checklist vào mọi task viết test.

- Mặc định dùng **Quick** theo diff/phạm vi liên quan, chạy kiểm tra tự động phù hợp
  trước và chỉ nạp log/ảnh cần phân tích. Dùng **Full** khi review toàn diện, release/sign-off
  hoặc thay đổi ảnh hưởng rộng; xem quy tắc chọn mode và tái sử dụng checkpoint trong skill.
  Tiết kiệm context không được bỏ bằng chứng, rerun bắt buộc hoặc coi kết quả cũ là Pass hiện tại.
- Phân biệt rủi ro từ code (`UI-RISK`), Bug đã xác minh (`BUG`), đề xuất thiết kế
  (`UI-REC`) và câu hỏi còn mở (`Q`). Chỉ gắn `Confirmed Bug` khi đạt mục 14.
- Chưa chạy kiểm tra thì ghi `Not verified`; không kết luận Pass hoặc production-ready
  từ việc không thấy lỗi trong code. Phân biệt bằng chứng browser emulation và thiết bị thật.
- Review coverage/assertion của REQ/TC/Playwright dùng `qa-logic-gaps`; review frontend
  dùng `qa-ui-review`. Nếu cần cả hai, giữ liên kết finding tới REQ/AC/TC và tránh báo trùng.
- Chỉ sửa mã khi người dùng yêu cầu; dùng bản vá nhỏ phù hợp convention và kiểm chứng
  theo phạm vi thay đổi. Không tự tạo requirement hay gate CI từ sở thích thiết kế.

Khi người dùng cung cấp test automation hiện có:

1. Dùng script làm nguồn bằng chứng để lập inventory `spec -> test -> page/API/fixture/data`.
2. Suy ra precondition, action, expected result, role, state và business rule từ test title, setup, assertion và cleanup.
3. Ghi requirement theo template với nguồn `Inferred from automation`; không biến selector, URL hoặc chi tiết framework thành requirement nghiệp vụ.
4. Gắn trạng thái cho từng kết luận: `Confirmed` nếu có tài liệu/owner xác nhận, `Inferred` nếu suy ra từ script, `Needs confirmation` nếu script chưa đủ bằng chứng.
5. Tạo danh sách gap: requirement chưa được test, test không có assertion, assertion không đủ mạnh, dữ liệu hard-code, dependency ẩn và case chưa automation.
6. Giữ nguyên traceability tới đường dẫn file và test title để có thể audit ngược.

Tham chiếu mẫu đầy đủ: `requirements/REQ-001-sign-in.md` -> `test-cases/REQ-001-sign-in.md` -> `test-cases/REQ-001-sign-in.automation-plan.md` -> `playwright/tests/auth/login.spec.ts`. Theo đúng cấu trúc và mức chi tiết của bộ này.

Ngôn ngữ tài liệu có thể là tiếng Việt; mã, ID, tên file và test title dùng tiếng Anh ổn định. Không đưa credential thật vào file; mọi giá trị nhạy cảm đi qua `requireEnv()` và được khai báo trong `playwright/.env.example`.
