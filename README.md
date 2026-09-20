# QA Test Automation Workspace

Bộ khung này định nghĩa cách tiếp nhận requirement, thiết kế test case và chuyển các case phù hợp thành Playwright script.

Có sẵn một **ví dụ mẫu chạy được end-to-end** qua toàn bộ luồng: [REQ-001](requirements/REQ-001-sign-in.md) → [test case](test-cases/REQ-001-sign-in.md) → [automation plan](test-cases/REQ-001-sign-in.automation-plan.md) → [script](playwright/tests/auth/login.spec.ts). Đọc bộ này trước khi viết requirement đầu tiên cho dự án thật.

## Bắt đầu

```powershell
cd playwright
npm install
npx playwright install
Copy-Item .env.example .env   # rồi điền BASE_URL và tài khoản test
npm run verify                # typecheck + lint + liệt kê test
```

`npm run verify` chạy được **không cần ứng dụng thật**. Muốn chạy test thật thì cần `BASE_URL` trỏ tới môi trường đang chạy.

## Luồng làm việc chuẩn

1. Ghi requirement vào `requirements/<feature-id>-<slug>.md`.
2. Tách requirement thành acceptance criteria có mã `AC-xxx`.
3. Phân tích rủi ro và lập test case trong `test-cases/<feature-id>-<slug>.md`.
4. Gắn traceability `REQ -> AC -> TC -> AUTO`, và cập nhật [ma trận tổng](test-cases/traceability.md).
5. Chọn case automation theo tiêu chí trong [docs/automation-strategy.md](docs/automation-strategy.md).
6. Viết script vào `playwright/tests/<domain>/<feature>.spec.ts`.
7. Chạy test, lưu evidence khi fail và cập nhật trạng thái. Lỗi sản phẩm → mở issue theo [bug template](.github/ISSUE_TEMPLATE/bug_report.yml); test không ổn định → theo [flaky policy](docs/flaky-test-policy.md).

## Khi có sẵn test automation

Có thể bắt đầu từ script theo luồng ngược:

1. Inventory spec, page object, fixture, API helper, test data và tag.
2. Đọc test title, action, assertion, setup/cleanup để suy ra hành vi và điều kiện.
3. Ghi requirement vào `requirements/` và đánh dấu nguồn là `Inferred from automation`.
4. Tách các hành vi thành acceptance criteria, không coi locator hoặc implementation detail là business rule.
5. Tạo test case và traceability tới file/test title gốc.
6. Đánh dấu `Confirmed`, `Inferred` hoặc `Needs confirmation` cho từng rule.

Kết quả reverse engineering phải giữ lại các gap: hành vi chưa được test, assertion quá yếu, dữ liệu hard-code, dependency ẩn và case chưa có automation.

## Cấu trúc

```
requirements/   requirement đã chuẩn hoá và các câu hỏi còn mở
test-cases/     test design, test case thủ công, automation plan, ma trận traceability
templates/      mẫu dùng khi tạo requirement, test case hoặc automation plan
docs/           nguyên tắc QA, chiến lược automation, quy ước selector, dữ liệu test, flaky policy
playwright/     config, fixtures, page objects, API helper và test scripts
.github/        hướng dẫn cho AI assistant, CI workflow, issue/PR template
```

Chi tiết thư mục `playwright/`:

```
playwright/
  playwright.config.ts   projects, timeout, reporter, storageState
  eslint.config.mjs      enforce quy ước test (không chỉ ghi trong doc)
  tsconfig.json          bật typecheck cho spec
  .env.example           danh sách biến môi trường cần có
  tests/
    auth.setup.ts        đăng nhập một lần, lưu session dùng lại
    support/             helper đọc env (fail-fast), đường dẫn dùng chung
    data/                test data và hằng số nghiệp vụ
    pages/               page object
    api/                 API helper để seed/cleanup
    fixtures/            test object dùng chung
    <domain>/*.spec.ts   test scripts
```

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/qa-test-design-standard.md](docs/qa-test-design-standard.md) | Kỹ thuật thiết kế test, bộ bao phủ tối thiểu, quy tắc priority |
| [docs/automation-strategy.md](docs/automation-strategy.md) | Tiêu chí chọn case để automation, nguyên tắc Playwright |
| [docs/selector-convention.md](docs/selector-convention.md) | Thứ tự ưu tiên locator, cách đặt test id, những gì bị cấm |
| [docs/test-data-management.md](docs/test-data-management.md) | Seed, cleanup, cô lập khi chạy song song, dữ liệu nhạy cảm |
| [docs/flaky-test-policy.md](docs/flaky-test-policy.md) | Phân loại nguyên nhân, quy trình quarantine, ngưỡng cảnh báo |
| [docs/hub-and-project-boundary.md](docs/hub-and-project-boundary.md) | Cái gì thuộc Hub, cái gì thuộc project, và cách chặn ghi đè business |

## Lệnh Playwright

Chạy trong thư mục `playwright/`:

```powershell
npm test                 # chromium, toàn bộ test
npm run test:smoke       # chỉ @smoke
npm run test:p0          # chỉ @p0
npm run test:a11y        # chỉ @a11y
npm run test:cross       # firefox + webkit + mobile-chrome
npm run test:ui          # chế độ UI
npm run test:debug       # chế độ debug
npm run report           # mở HTML report
npm run verify           # typecheck + lint + test:list (dùng trước khi mở PR)
```

## Traceability analyzer & Tools

Chạy ở thư mục gốc:

```powershell
npm test                        # chạy 100% unit tests của tools/ (Node.js core)
npm run qa:coverage             # REQ -> AC -> TC -> script, AC nào chưa phủ
npm run qa:gaps                 # NÊN THÊM script nào hoặc thiếu test biên
npm run qa:impact -- REQ-001    # requirement đổi thì PHẢI SỬA file nào
npm run qa:drift                # traceability mục ở đâu
npm run qa:matrix               # tự động tạo/cập nhật ma trận truy vết (traceability.md)
npm run qa:scaffold             # tự động sinh bộ 3 file REQ/TC/Spec hoặc reverse từ spec
npm run qa:boundary             # ranh giới Hub <-> project còn khớp không
npm run qa:check                # boundary + drift + gaps --strict, dùng cho CI gate
npm run decisions               # quản lý và render nhật ký quyết định kỹ thuật
```

Tool đọc front-matter của requirement, bảng `## Traceability` của test case và
`playwright test --list --reporter=json`, rồi join lại. Không cần dependency ngoài.
Chi tiết và **giới hạn** ở [tools/qa/README.md](tools/qa/README.md).

## Tag

| Tag | Nghĩa |
|---|---|
| `@smoke` | Luồng sống còn, chạy trên mọi PR |
| `@p0` .. `@p3` | Priority, khớp với cột Priority trong file test case |
| `@security` | Authentication, authorization, data isolation |
| `@a11y` | Accessibility |
| `@wip` | Đang quarantine, loại khỏi gate của PR nhưng vẫn chạy nightly |

## CI

[`.github/workflows/playwright.yml`](.github/workflows/playwright.yml):

- **PR** → lint + typecheck, rồi chạy `@smoke|@p0` trên chromium, chia 2 shard.
- **Nightly (01:00 ICT)** → chạy đầy đủ trên chromium + firefox + webkit.
- **Thủ công** → `workflow_dispatch`, nhập tag muốn chạy.

Job `traceability` chạy `npm test` cho bộ `tools/`, kiểm tra tính cập nhật của ma trận `traceability.md`, và chạy `qa:check` để chặn merge nếu ranh giới bị phá hoặc traceability có gap nghiêm trọng. Job này hoàn toàn zero-dependency và không cần môi trường app.

Job `e2e` cần biến môi trường `BASE_URL` trỏ tới môi trường thật (staging/test) đang chạy, do `playwright.config.ts` không cấu hình `webServer` cục bộ. Job sẽ fail nếu `BASE_URL` chưa được cung cấp.

Report của các shard được gộp lại và upload dưới dạng artifact `playwright-html-report`.

Cấu hình cần đặt trong repository settings: biến `BASE_URL`, `API_BASE_URL`; secret `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_VIEWER_EMAIL`, `TEST_VIEWER_PASSWORD`, `API_TOKEN`.

## Bảo mật

Chỉ đặt credential và URL môi trường trong biến môi trường hoặc secret store; không commit secret vào repository. File `.env`, `.auth/` và mọi artifact của Playwright đã nằm trong [.gitignore](.gitignore).
