# Phase 3 — Tooling của Hub tuân thủ Rule 15

**Ưu tiên:** P2 · **Phụ thuộc:** Phase 0 · **Đụng file chung với:** Phase 4

## Hiện trạng

Rule 15 (CLAUDE.md) đặt trần: Service/API ngoài `tests/` 200 dòng, Helper/Utils ngoài
`tests/` 150 dòng, `*.test.ts`/`*.spec.ts` 800 dòng. Nhưng `qa:limits` chỉ quét
`projectDir` (`playwright/`), nên `tools/` không bao giờ bị kiểm tra.

| File | Dòng | Vượt |
|---|---|---|
| `tools/qa/lib/learner.js` | 2744 | ~13× |
| `tools/qa/lib/sources.js` | 1678 | ~8× |
| `tools/qa/lib/commands.js` | 1074 | ~5× |
| `tools/scaffold/index.js` | 683 | |
| `tools/qa/index.js` | 609 | |
| `tools/boundary/index.js` | 368 | |
| `tools/scaffold/template.js` | 340 | |
| `tools/decisions/index.js` | 229 | |
| `tools/qa/lib/commands.test.js` | 1422 | test > 800 |
| `tools/qa/lib/sources.test.js` | 1324 | test > 800 |
| `tools/qa/lib/learner.test.js` | 1256 | test > 800 |
| `tools/qa/index.test.js` | 895 | test > 800 |

Đây là chuẩn kép: Hub bắt consumer theo rule mà tool của Hub không theo.

## Việc cần làm

- [ ] **Quyết định trước** (ghi vào `decisions.json`): Rule 15 có áp cho `tools/` của Hub
  không? Nếu có, trần nào (đề xuất: module 300, test 800); nếu không, ghi rõ ngoại lệ trong
  `.github/copilot-instructions.md`.
- [ ] Mở rộng `qa:limits` có tham số quét thêm thư mục (ví dụ `--include=tools`), ban đầu
  chạy chế độ báo cáo, chưa `--strict`.
- [ ] Đưa các file hiện vượt vào `.size-exemptions.json` (cơ chế đã có trong
  `code-limits-policy.js`) với `reason` và ngày hết hạn — tránh gate đỏ ngay.
- [ ] Tách theo thứ tự rủi ro/lợi ích, mỗi file một PR, giữ nguyên public API (`require` path cũ
  re-export):
  1. `learner.js` → các module theo giai đoạn (collect / analyze / persist / cli).
  2. `sources.js` → loader requirement / test case / spec / git.
  3. `commands.js` → một file mỗi lệnh (coverage, gaps, drift, impact, matrix, summary, fix).
  4. Test file tách theo module tương ứng.
- [ ] Sau mỗi PR: gỡ exemption tương ứng; khi hết exemption, bật `--strict` cho `tools/`
  trong `qa:check` và CI.

## Tiêu chí hoàn thành

- `npm run qa:limits -- --strict` bao gồm `tools/` và pass, không còn exemption.
- `npm test` vẫn 100% pass; không đổi hành vi CLI (so sánh output `--json` trước/sau).
