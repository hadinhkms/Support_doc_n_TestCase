# AGENTS.md

Rule viết requirement / test case / Playwright script của workspace này nằm ở
**[.github/copilot-instructions.md](.github/copilot-instructions.md)** — đọc file đó trước khi
sửa bất cứ thứ gì trong `requirements/`, `test-cases/` hoặc `playwright/tests/`.
Đó là nguồn duy nhất; file này chỉ trỏ tới nó để khỏi có hai bản rule lệch nhau.

## Lệnh hay dùng

Chạy ở **thư mục gốc**:

| Lệnh | Dùng khi |
|---|---|
| `npm test` | Chạy 100% unit test của toàn bộ `tools/` (Node.js core) |
| `npm run qa:impact -- REQ-xxx` | Trước khi sửa: biết requirement đó ràng buộc file nào |
| `npm run qa:gaps` | Biết chỗ nào chưa có script hoặc thiếu test biên |
| `npm run qa:coverage` | Xem toàn cảnh REQ -> AC -> TC -> script |
| `npm run qa:matrix` | Tự động sinh/cập nhật ma trận truy vết (`traceability.md`) |
| `npm run qa:scaffold` | Tự động sinh bộ 3 file REQ/TC/Spec hoặc reverse từ spec (hỗ trợ `--wizard`) |
| `npm run qa:summary` | Tóm tắt chỉ số sức khỏe QA (hỗ trợ `--json` cho Dashboard) |
| `npm run qa:fix` | Tự động sửa và chuẩn hoá liên kết truy vết (hỗ trợ `--dry-run`) |
| `npm run qa:drift` | Phát hiện liên kết truy vết bị mục/lệch |
| `npm run qa:limits` | Kiểm tra trần số dòng, vùng vàng 80%, độ dài dòng & file nháp trước khi commit |
| `npm run qa:boundary` | Kiểm tra ranh giới đồng bộ Hub <-> Project |
| `npm run qa:check` | Gate cuối: boundary + drift + gaps + limits (giống CI) |
| `npm run decisions` | Quản lý và render nhật ký quyết định kỹ thuật |

Chạy trong **`playwright/`**:

| Lệnh | Dùng khi |
|---|---|
| `npm run verify` | Sau mỗi lần sửa spec — typecheck + lint + limits + `--list`, không cần app thật |
| `npm run test:smoke` / `test:p0` | Chạy đúng tập mà gate PR chạy |
| `npm run test:regression` | Full, đã loại `@wip` |

## Ràng buộc dễ quên

- **Giới hạn dòng code & vùng vàng 80% trước khi commit (Rule 15)**: `*.spec.ts`/`*.test.ts` trần 800 dòng (vùng vàng $\ge 640$ — tạo mới/thêm test phải giữ $< 640$); Page Object, Fixture, Support, Data, `ApiClient` trong `tests/`, `*.setup.ts`, `*.config.ts` thuộc role `module` trần **250 dòng** (vùng vàng $\ge 200$ — tạo mới/thêm hàm giữ $< 200$); Service/API ngoài `tests/` trần 200 (vàng 160); Helper/Utils ngoài `tests/` trần 150 (vàng 120); dòng đơn $\le 500$ ký tự, trung bình dòng $\le 100$ ký tự, cấm tên `.ai-test.`/`.scratch.`. Luôn chạy `npm run qa:limits -- --strict` (hoặc `npm run verify` / `npm run qa:check`) và tự tách file ngay nếu chạm ngưỡng.
- Spec phải có tag `@REQ-xxx` ở `test.describe` và title `TC-xxx - AC-yyy <mô tả>`,
  nếu không `tools/qa` không thấy test đó và traceability sẽ báo gap.
- Gate PR chỉ chạy `@smoke|@p0` (trừ `@wip`) — test không gắn tag priority sẽ không bao giờ
  chạy ở PR. Xem [.github/workflows/playwright.yml](.github/workflows/playwright.yml).
- Nightly chạy chromium + firefox + webkit, shard 2, `fullyParallel` — mọi test phải độc lập,
  rerunnable và không phụ thuộc thứ tự chạy.
- Không commit credential thật. Giá trị nhạy cảm đi qua `requireEnv()` và khai báo trong
  [playwright/.env.example](playwright/.env.example).
- Thêm thư mục/file mới ở gốc thì phải phân loại trong [sync-manifest.json](sync-manifest.json),
  nếu không `npm run qa:boundary` báo unclassified.
- Repo có layout Playwright khác (config ở gốc, project đặt tên khác) thì khai trong
  [qa.config.json](qa.config.json), đừng sửa `tools/qa`.

## Ranh giới Hub <-> Project

`ship` = Hub sở hữu, đừng sửa tại chỗ. `seed` = bản khởi tạo, sửa thoải mái.
`own` = business của project. Chi tiết: [docs/hub-and-project-boundary.md](docs/hub-and-project-boundary.md).
