# Phase 1 — Dependency & CI runtime

**Ưu tiên:** P1 · **Phụ thuộc:** Phase 0 (làm trên `main` mới)

## Hiện trạng (`npm outdated` trong `playwright/`, 2026-11-07)

| Package | Hiện tại | Mới nhất | Ghi chú |
|---|---|---|---|
| `@playwright/test` | 1.64.1 | 1.65.0 | minor — nâng thẳng |
| `@types/node` | 20.19.x | 26.x | Lệch với `engines: node >=22` và CI Node 22 |
| `eslint`, `@eslint/js` | 9.39.5 | 10.x | major — cần spike |
| `typescript` | 5.9.3 | 7.x | major (compiler native) — cần spike |

`.github/workflows/playwright.yml` dùng `actions/checkout@v4`, `setup-node@v4`,
`cache@v4`, `upload-artifact@v4`, `download-artifact@v4`.

## Việc cần làm

### 1a. Nâng an toàn (một PR)

- [ ] `@playwright/test` → 1.65.x; cập nhật browser cache key nếu có pin version.
- [ ] `@types/node` → `^22` (khớp Node runtime thấp nhất được hỗ trợ, không phải bản mới nhất).
- [ ] Đổi `"typescript": "^5.0.0"` thành range sát bản đang dùng (`^5.9.3`) để lockfile
  và khai báo thống nhất.
- [ ] Kiểm tra bản major hiện hành của từng GitHub Action tại thời điểm làm và nâng
  (đặc biệt các action còn chạy runtime Node 20). Cân nhắc pin theo commit SHA.
- [ ] Cân nhắc thêm Node 24 (LTS) vào job `traceability` dạng matrix để bắt lỗi sớm.

### 1b. Spike major (PR riêng, có thể bỏ)

- [ ] ESLint 10: kiểm tra `eslint-plugin-playwright` và `typescript-eslint` đã hỗ trợ chưa;
  chạy `npm run lint` không đổi rule.
- [ ] TypeScript 7: kiểm tra `typescript-eslint` + Playwright transpile tương thích;
  nếu chưa, ghi quyết định giữ 5.x kèm ngày rà lại vào `decisions.json`.

## Lưu ý Hub ↔ Project

`playwright/package.json` và `.github/workflows/playwright.yml` là `seed`: thay đổi ở Hub
không tự đến satellite. Ghi chú nâng cấp trong README/CHANGELOG để consumer tự áp dụng.

## Tiêu chí hoàn thành

- `npm outdated` chỉ còn các major đã có quyết định rõ.
- CI xanh trên cả `quality`, `evidence-drill`, `traceability`.
- Không còn cảnh báo deprecation runtime của Actions trong log CI.
