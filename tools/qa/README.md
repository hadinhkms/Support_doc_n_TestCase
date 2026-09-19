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
npm run qa:check               # drift + gaps ở chế độ --strict (dùng cho CI)
```

Cờ: `--json` (cho CI/agent đọc), `--strict` (exit 1 khi có finding từ `major`),
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

File `*.setup.ts` được bỏ qua: đó là hạ tầng đăng nhập/seed, không phải test case.

## Giới hạn — đọc trước khi tin kết quả

1. **Tool chỉ kiểm tra được liên kết, không kiểm tra được chất lượng.** Nó biết AC-001 có script, nhưng không biết script đó assert đúng hay không. Assertion yếu vẫn qua cửa.
2. **Độ phủ từng phần không phát hiện được.** Nếu dòng rule `Email` có boundary `254, 255` và cột Test cases ghi `TC-004`, tool coi là đã phủ — kể cả khi TC-004 chỉ test định dạng sai chứ không test độ dài. Phần này vẫn phải người đọc.
3. **`gaps` không tự sinh test case.** Nó chỉ ra chỗ trống và đề xuất loại case cần có (hợp lệ / không hợp lệ / biên) từ bảng rule. Viết case vẫn là việc của QA.
4. **Phụ thuộc vào kỷ luật đặt tên.** Title sai định dạng thì test biến mất khỏi mọi báo cáo. ESLint chặn phần lớn, nhưng không chặn được mã TC gõ nhầm số.

## Port sang repo khác

Chỉ cần copy `tools/qa/` và đảm bảo repo đích có:

- `requirements/` với front-matter (`id`, `status`, `test_cases`)
- `test-cases/` với bảng `## Traceability`
- Thư mục Playwright khai trong `qa.config.json` (mặc định `playwright/`, project `chromium`)
- Test gắn tag `@REQ-xxx` và title `TC-xxx - AC-xxx`

Không cần cài gì thêm.
