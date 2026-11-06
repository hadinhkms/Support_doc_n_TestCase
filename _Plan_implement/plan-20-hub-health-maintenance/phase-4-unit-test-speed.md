# Phase 4 — Tăng tốc unit test của `tools/`

**Ưu tiên:** P2 · **Phụ thuộc:** nên làm sau bước tách `learner.js` ở Phase 3

## Hiện trạng

`npm test` = 281 test, ~204 giây trên máy dev (Node 22.3, Windows). Các test chậm nhất:

| Test | Thời gian |
|---|---|
| C02 `--since=REF` flags | 28.7 s |
| C04 `--apply` / `--json` knowledge.json | 23.3 s |
| L13 Git thật: unborn HEAD, staged… | 20.1 s |
| C07 Replay no-op / lock contention | 18.7 s |
| C05 Preview / `--dry-run` read-only | 17.4 s |
| C06 Metadata duyệt | 16.6 s |
| C03 `--json` một object | 14.4 s |

Gần như toàn bộ đến từ `learner.test.js` (`qa:learn`): mỗi case spawn tiến trình Node + tạo
repo git tạm nhiều lần.

## Việc cần làm

- [ ] Đo baseline: `node --test --test-reporter=spec "tools/**/*.test.js"` lưu thời gian từng test.
- [ ] Gọi `runCli()` in-process cho các case chỉ kiểm tra parse cờ / exit code / JSON;
  chỉ giữ một vài smoke test spawn tiến trình thật.
- [ ] Tạo fixture repo git một lần mỗi file test (`before`) và copy thư mục thay vì
  `git init` + commit lại cho từng case.
- [ ] Giữ nguyên test hành vi Git thật (L13, L14) nhưng tách vào file riêng, có thể chạy
  `npm run test:slow` riêng nếu cần.
- [ ] Đặt ngân sách: `npm test` < 60 s trên CI; thêm cảnh báo nếu một test > 5 s.

## Tiêu chí hoàn thành

- Số test và độ phủ hành vi không giảm (so sánh danh sách tên test trước/sau).
- `npm test` < 60 s trên runner `ubuntu-latest`.
