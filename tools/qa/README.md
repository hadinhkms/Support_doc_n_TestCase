# QA Traceability Analyzer

Join 3 nguồn dữ liệu để trả lời hai câu hỏi mà bảng markdown không trả lời được:

- **Requirement đổi thì phải sửa script nào?**
- **Nên thêm script nào để phủ thêm happy/edge case?**

```
requirements/*.md   --front-matter + heading AC--+
test-cases/*.md     --bảng Traceability---------+--> join --> coverage / gaps / impact / drift
playwright --list   --tag @REQ + title TC/AC----+
```

Không dùng dependency ngoài. Chạy được ở repo JavaScript lẫn TypeScript, chỉ cần Node >= 18.

## Lệnh

```bash
npm run qa:coverage            # bức tranh tổng REQ -> AC -> TC -> script
npm run qa:gaps                # NÊN THÊM script nào
npm run qa:drift               # traceability mục ở đâu
npm run qa:impact -- REQ-001   # requirement đổi thì PHẢI SỬA file nào
npm run qa:learn               # quét preview chọn lọc bài học QA (Read-Only)
npm run qa:check               # drift + gaps ở chế độ --strict (dùng cho CI)
```

Cờ dùng chung: `--json` (cho CI/agent đọc — khuyến nghị gọi trực tiếp `node tools/qa <cmd> --json` để tránh banner của `npm`), `--strict` (exit 1 khi có finding từ `major`),
`--project=<name>`, `--project-dir=<dir>`.

## Cấu hình cho repo khác

Mỗi repo để Playwright một kiểu, nên hai giá trị này đọc từ `qa.config.json` ở gốc repo:

```json
{
  "projectDir": "playwright",
  "project": "chromium"
}
```

| Khoá | Nghĩa | Mặc định |
|---|---|---|
| `projectDir` | Thư mục chứa `playwright.config.*`. Dùng `"."` nếu config nằm ngay gốc repo | `playwright` |
| `project` | Tên project trong `playwright.config` dùng để liệt kê test | `chromium` |
| `requirementsDir` | Thư mục chứa requirement | `requirements` |
| `testCasesDir` | Thư mục chứa test case | `test-cases` |
| `ignoreSpecs` | Mảng tiền tố đường dẫn spec nằm **ngoài** phạm vi gate | `[]` |

### `ignoreSpecs` — khoanh vùng thay vì tắt tiếng

Repo có sẵn spec cũ chưa gắn mã `TC-xxx` sẽ làm gate đỏ ngay ngày đầu, và một gate luôn đỏ
thì sau hai tuần cả đội quen bỏ qua nó. `ignoreSpecs` cho phép bật gate cho phần mới trước:

```json
{ "projectDir": ".", "project": "Desktop Chrome", "ignoreSpecs": ["tests/e2e"] }
```

Số test bị bỏ qua **luôn được in ra** ở mọi lệnh, kèm danh sách tiền tố đang áp dụng. Đây là
chủ ý: một cổng gác im lặng bỏ qua dữ liệu là một cổng gác nói dối.

Thứ tự ưu tiên: **cờ CLI > `qa.config.json` > mặc định**. Không có file config thì tool
chạy đúng như trước, không cần sửa gì.

Ví dụ một repo JavaScript để config ở gốc và đặt tên project khác:

```json
{ "projectDir": ".", "project": "Desktop Chrome" }
```

Gõ sai khoá hoặc sai JSON thì tool báo lỗi và dừng, không âm thầm chạy bằng giá trị mặc định.

## Join key

| Liên kết | Lấy từ đâu |
|---|---|
| Test -> REQ | Tag ở describe: `test.describe('...', { tag: '@REQ-001' }, ...)` |
| Test -> TC, AC | Title: `TC-001 - AC-001 <mô tả>` (ESLint ép đúng định dạng) |
| AC -> TC | Bảng `## Traceability` trong `test-cases/*.md` |
| Rule -> TC | Cột `Test cases` trong bảng `## Rules and validation` của requirement |

Đổi bất kỳ quy ước nào ở trên thì phải sửa `lib/sources.js` tương ứng.

## Các loại finding

### `gaps` — nên thêm gì

| Kind | Mức | Nghĩa |
|---|---|---|
| `requirement-khong-co-front-matter` | blocker | Tool không đọc được file requirement |
| `ac-khong-co-test-case` | blocker | AC chưa ai thiết kế case |
| `rule-tro-toi-tc-khong-ton-tai` | blocker | Cột Test cases trỏ tới mã TC không có thật |
| `khai-automation-nhung-khong-co-script` | blocker | Bảng khai `Yes` nhưng không có script — traceability nói dối |
| `ac-chua-co-script` | major | Có test case nhưng chưa automation cái nào |
| `rule-chua-map-toi-test-case` | major | Dòng rule để trống cột Test cases |
| `khong-automation-nhung-khong-co-ly-do` | major | `No` mà không ghi lý do ở mục "Case không automation" |
| `p0-p1-con-dang-candidate` | major | P0/P1 vẫn nằm chờ, không ai làm |
| `khong-doc-duoc-requirement` | blocker | Không đọc được requirement nào — gate đang chạy rỗng |
| `doc-duoc-0-spec` | blocker | Có test case nhưng đọc được 0 spec — sai projectDir/project |
| `gia-tri-automation-khong-hop-le` | major | Cột Automation có giá trị lạ, làm mọi rule về automation im lặng |
| `dinh-danh-sai-quy-uoc` | major | Heading kiểu `AC-8`, `AC_012` — trông giống mã nhưng vô hình với tool |
| `spec-thieu-assertion` | major | Test script thật không chứa lệnh `expect(...)` nào (`none`) |
| `assertion-thieu-await` | major | Gọi matcher bất đồng bộ của Playwright mà thiếu `await` / `return` |
| `spec-chi-assert-url` | minor | Test chỉ assert điều hướng trên `page` (`toHaveURL`/`toHaveTitle`) mà chưa kiểm chứng UI/dữ liệu (`PA-01` partial static guardrail) |

### `drift` — traceability mục

| Kind | Mức | Nghĩa |
|---|---|---|
| `test-tro-toi-req-khong-ton-tai` | blocker | Script gắn REQ đã bị xoá |
| `test-tro-toi-ac-khong-ton-tai` | blocker | AC bị xoá/đổi số nhưng script còn trỏ vào |
| `test-case-file-khong-ton-tai` | blocker | `test_cases:` trong front-matter trỏ sai |
| `test-khong-co-ma-tc` | major | Title không mở đầu bằng `TC-xxx` |
| `test-thieu-tag-req` | major | Thiếu tag `@REQ-xxx` ở describe |
| `script-khong-co-trong-test-case` | major | Có script nhưng bảng traceability không biết |
| `requirement-draft-nhung-da-co-script` | major | Script đang test hành vi chưa chốt |
| `test-case-tro-toi-req-khong-ton-tai` | blocker | Dòng traceability trỏ tới REQ đã bị xoá |
| `test-case-tro-toi-ac-khong-ton-tai` | blocker | Dòng traceability trỏ tới AC đã bị xoá/đổi số |

File `*.setup.ts` được bỏ qua: đó là hạ tầng đăng nhập/seed, không phải test case.

## Chế độ hỏng đã được chặn

Nguy hiểm nhất là **đọc được 0 spec**: khi đó mọi phép đối chiếu đều xanh vì không có gì để
so, và báo cáo trông y hệt một repo sạch. Thường do sai `projectDir` hoặc sai tên `project`.

Tool xử lý như sau:

- Repo **có** test case mà đọc được 0 spec -> finding `doc-duoc-0-spec` mức **blocker**
- Repo **chưa có** test case nào (đang dựng dở) -> im lặng, vì 0 spec là đúng sự thật
- `coverage` in cảnh báo đỏ kèm lý do có thể xảy ra

## Lệnh `learn` — Học chọn lọc & Kho tri thức (Selective Learning)

Trích xuất tín hiệu học từ thay đổi đa tầng (`requirements/`, `test-cases/`, `playwright/tests/`) và quyết định đã xác nhận (`decisions.json`), lọc qua 4 cổng (`Generality`, `Novelty`, `Impact`, `Distillability`) và chỉ ghi vào kho tri thức của dự án sau khi reviewer phê duyệt.

### Cú pháp sử dụng

```bash
npm run qa:learn                                                                 # Preview read-only
node tools/qa learn --json                                                       # Preview xuất JSON chuẩn
node tools/qa learn --since=HEAD~1 --json                                        # Quét từ ref Git cụ thể
node tools/qa learn --since HEAD~1 --output=test-cases/_learning/review.json     # Xuất review artifact (pending)
node tools/qa learn --apply --review=test-cases/_learning/review.json            # Áp dụng bài học đã duyệt
node tools/qa learn --apply --review=test-cases/_learning/review.json --json     # Áp dụng và xuất JSON
node tools/qa learn --apply --review=test-cases/_learning/review.json --dry-run --json # Kiểm tra thử apply (không ghi đĩa)
```

- **Mặc định là Preview (Read-Only):** Không tạo thư mục `_learning`, file hay lock. Các mục `proposed` và `needsReview` chỉ là ứng viên chờ duyệt, **chưa phải** bài học đã lưu.
- **Xuất Review Artifact (`--output`):** Chỉ được xuất vào bên trong `<testCasesDir>/_learning/`, không được trùng tên `knowledge.json` hoặc `knowledge.lock`, và **không ghi đè** file đã tồn tại (trả về exit `2`; muốn xuất mới phải chọn tên file khác để giữ công review cũ).
- **Quy tắc tổ hợp cờ:**
  - `--apply` bắt buộc đi kèm `--review=<path>`; dùng `--review` mà thiếu `--apply` là lỗi (exit `2`).
  - `--apply` lấy `scope` trực tiếp từ bên trong file review artifact nên không dùng chung với `--since` hoặc `--output`.
  - `--dry-run` không dùng chung với `--output` để tránh mơ hồ side effect.
  - Các cờ `--req`, `--domain`, `--tag`, `--strict`, `--boundary-rules` / `--no-boundary-rules` chưa hỗ trợ cho `learn` và sẽ báo lỗi tường minh (exit `2`).
  - Hỗ trợ cả hai cú pháp `--since=REF` / `--since REF` và `--review=PATH` / `--review PATH`.

### Kiến trúc lưu trữ & Ranh giới Ownership (`ship` vs `own`)

| Thành phần | Đường dẫn mặc định | Phân loại | Quyền của `learn` |
|---|---|---|---|
| Policy & Shared Catalog | `.agents/skills/qa-logic-gaps/references/*.md` | `ship` | **Chỉ đọc (Read-Only)** — Hub sở hữu (6 seed `DH-01`..`DH-06`, 4 seed `PA-01`..`PA-04`) |
| Project Knowledge Overlay | `<testCasesDir>/_learning/knowledge.json` | `own` | Ghi nguyên tử khi `--apply` thành công (mã `PDH-001`.., `PPA-001`..) |
| Review Artifact | `<testCasesDir>/_learning/review.json` | `own` | Ghi mới (`wx`) khi có `--output`; người/agent duyệt trước khi `--apply` |
| Lock File | `<testCasesDir>/_learning/knowledge.lock` | `own` (tạm) | Khoá độc quyền trong lúc `--apply`, tự xoá trong `finally`, không commit |

- Tôn trọng cấu hình layout trong `qa.config.json` (`requirementsDir`, `testCasesDir`, `projectDir`, `ignoreSpecs`) và cờ `--project-dir`.
- Trước khi ghi, engine kiểm tra `realpath` (chặn symlink/junction thoát khỏi repo root) và đối chiếu `sync-manifest.json` để đảm bảo đường dẫn đích thuộc vùng `own`.

### Phạm vi Git (`Scope`) & Nguồn tín hiệu

1. **Mặc định (không có `--since`):** Quét thay đổi working tree (staged + unstaged so với `HEAD`, hoặc `git diff --cached` khi repo ở trạng thái unborn `HEAD`) kèm các file untracked hợp lệ trong `requirements/`, `test-cases/`, `<projectDir>/tests/`.
2. **Có `--since=<ref>`:** Quét `git diff <ref>` đối với các file đã tracked; các file untracked được bỏ qua có chủ đích và thống kê rõ trong `scope.untrackedSkippedCount` / `scope.untrackedFiles`.
3. **Decisions (`decisions.json`):** Chỉ trích xuất các quyết định có `status === "confirmed"` và `answer.optionId` khớp một phương án hợp lệ trong `options[]`.
4. **Loại trừ tự động:** Bỏ qua `<testCasesDir>/traceability.md`, `<testCasesDir>/_learning/**`, và các đường dẫn thuộc `ignoreSpecs`.

### Schema (`1.0.0`), Trần dung lượng (`Cap`) & Replay

- **`schemaVersion`:** `"1.0.0"` (theo Policy `1.2.0` của Plan 13 v1.2).
- **Trần dung lượng (Ceiling Cap):** Tối đa **25 active entries** cho mỗi loại (`DH` / `PA`) trên mỗi lớp (`shared` hoặc `project`); tập hiệu lực (`effective`) tối đa 50 mục/loại trước khi khử trùng lặp. Không tự động xoá hay gộp khi đầy — phải thực hiện graduation/retire tường minh.
- **Giới hạn độ dài:** `title <= 120` ký tự Unicode; mỗi trường nghiệp vụ (`trigger`, `failureMode`, `actionableCheck`, `evidence`) `<= 500` ký tự; tối đa `5` bản ghi `provenance`/entry.
- **Định danh đơn điệu (Monotonic ID):** Cấp mã `PDH-001`.. / `PPA-001`.. tại thời điểm `--apply` từ `nextIds` trong `knowledge.json`. Mã đã `retired` tuyệt đối không bao giờ được tái sử dụng.
- **Kiểm tra Stale & Replay Idempotency:**
  - Mỗi review artifact lưu `snapshotHash` (hash của catalog chung + project overlay lúc xuất) và `sourceHash` (hash của tập tín hiệu trong scope).
  - Nếu chạy lại cùng lệnh `--apply` trên artifact đã được xử lý y hệt trước đó, tool trả về **Replay No-Op** (exit `0`, giữ nguyên byte-identical của `knowledge.json`).
  - Nếu dữ liệu nguồn hoặc kho tri thức đã đổi (`STALE_SNAPSHOT_HASH` / `STALE_SOURCE_HASH`) hoặc cùng candidate bị sửa thành kết quả duyệt khác (`REPLAY_CONFLICT`), tool từ chối thực thi với exit `2`.

### Mã thoát (Exit Codes) & Khôi phục sự cố (Lock / Temp Cleanup)

- **Exit `0`:** Quét preview, `--apply`, `--dry-run`, hoặc Replay No-Op thành công (kể cả khi có ứng viên ở trạng thái `rejected` hoặc `needsReview`).
- **Exit `2`:** Lỗi cú pháp cờ, tổ hợp cờ không hợp lệ, lỗi `qa.config.json`, ref Git không tồn tại, hỏng schema/JSON, vượt trần `25` mục, xung đột `snapshotHash`/`sourceHash`, hoặc đang bị khoá bởi tiến trình khác (`LOCK_CONTENTION`). Khi có `--json`, cả kết quả thành công lẫn lỗi đều xuất đúng một JSON object sạch trên `stdout` (không lẫn mã màu ANSI hay stack trace).
- **Khôi phục thủ công khi kẹt Lock / File tạm (`Manual Recovery`):**
  - Quá trình `--apply` ghi qua file tạm cùng thư mục (`knowledge.json.tmp.<pid>.<rand>`), `fsync` rồi mới `rename` nguyên tử sang `knowledge.json`, đồng thời luôn dọn file tạm và `knowledge.lock` trong khối `finally`.
  - Nếu tiến trình Node bị cưỡng bức dừng đột ngột (`SIGKILL` / mất điện) để lại file mồ côi trong `<testCasesDir>/_learning/`:
    1. Kiểm tra chắc chắn không còn tiến trình `node tools/qa learn --apply` nào đang chạy.
    2. Xoá file `<testCasesDir>/_learning/knowledge.lock` và các file tạm `<testCasesDir>/_learning/knowledge.json.tmp.*`.
    3. File `<testCasesDir>/_learning/knowledge.json` gốc vẫn nguyên vẹn và có thể chạy lại lệnh `--apply` an toàn.

## Giới hạn — đọc trước khi tin kết quả

1. **Tool chỉ kiểm tra được liên kết, không kiểm tra được chất lượng sâu của assert.** Nó kiểm tra xem script có assertion hay không (chặn assertionCount = 0), nhưng không thay thế được việc review ngữ nghĩa nghiệp vụ của assertion.
2. **Phân tích biên (BVA + EP) đã được hỗ trợ:** Khi dòng rule có nhiều giá trị biên hoặc nhiều lớp không hợp lệ (phân tách bởi dấu phẩy) mà chỉ gán 1 test case, `qa:gaps` sẽ cảnh báo mức `minor` (`rule-thieu-boundary-test`) kèm gợi ý tách test case độc lập.
3. **`gaps` không tự sinh test case.** Nó chỉ ra chỗ trống và đề xuất loại case cần có (hợp lệ / không hợp lệ / biên) từ bảng rule. Viết case vẫn là việc của QA.
4. **Phụ thuộc vào kỷ luật đặt tên.** Title sai định dạng thì test biến mất khỏi mọi báo cáo. ESLint chặn phần lớn, nhưng không chặn được mã TC gõ nhầm số.
5. **Heading AC nhận nhiều biến thể** (`##`..`#####`, dấu ngăn `:` `-` hoặc không có), nhưng mã vẫn phải đúng 3 chữ số. `AC-8` hay `AC_012` sẽ thành finding `dinh-danh-sai-quy-uoc` chứ không bị bỏ qua im lặng.
6. **`learn` dùng phân tích từ vựng (Lexical Jaccard >= 0.65) và biểu thức chính quy tĩnh, không có mô hình ngữ nghĩa (LLM/Embedding).** Engine chỉ làm nhiệm vụ sàng lọc ứng viên (`proposed` / `needsReview` / `rejected`), không hứa chặn 100% nhiễu thực tế hay hiểu ngữ nghĩa đa ngôn ngữ. Những thay đổi thiếu ngữ cảnh (`Trigger` / `Expected`) hoặc khác ngôn ngữ sẽ được đẩy vào `needsReview` để con người/AI Agent thẩm định trước khi `--apply`.
7. **Bộ quét `spec-chi-assert-url` (`analyzeTestAssertions`) là delimiter scanner đơn file, không phải trình biên dịch TypeScript AST liên module:**
   - Phân loại thân hàm test thành 4 trạng thái: `navigation-only`, `mixed`, `none`, hoặc `unknown`.
   - Khi gặp helper/POM tùy biến chưa có UI/data matcher trực tiếp trong thân test, custom `expect` (`expect.poll`, `expect.configure`), custom matcher, lời gọi động `obj[method]()`, template interpolation gọi hàm, hoặc `toHaveTitle`/`toHaveURL` trên locator/receiver không rõ có phải `page` fixture hay không, bộ quét trả về `unknown` kèm `reason` để tránh báo giả (`false-positive`) và không máy móc biến `unknown` thành `spec-thieu-assertion`.
   - Ngược lại, `mixed` (`onlyNavigationAssert: false`) chỉ chứng minh test có ít nhất một matcher ngoài URL/Title, **không** chứng minh assertion đó đã đủ mạnh về mặt nghiệp vụ (ví dụ chỉ `toBeVisible` một wrapper chung hoặc thiếu assert biến đổi dữ liệu). Vì vậy `PA-01` chỉ được graduate một phần (`staticRule: spec-chi-assert-url | coverage: partial`) và vẫn được giữ trong catalog để AI Agent thực hiện semantic audit.

## Kiểm thử

`npm test` ở thư mục gốc chạy toàn bộ unit test của `tools/` bằng `node --test`, không cần
cài gì thêm. Phần join được test qua khe cắm `options.loadAutomated`, nên không cần Playwright.

## Port sang repo khác

Chỉ cần copy `tools/qa/` và đảm bảo repo đích có:

- `requirements/` với front-matter (`id`, `status`, `test_cases`)
- `test-cases/` với bảng `## Traceability`
- Thư mục Playwright khai trong `qa.config.json` (mặc định `playwright/`, project `chromium`)
- Test gắn tag `@REQ-xxx` và title `TC-xxx - AC-xxx`

Không cần cài gì thêm.
