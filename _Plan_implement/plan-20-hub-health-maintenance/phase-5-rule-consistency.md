# Phase 5 — Nhất quán rule, skill, template và tool

**Ưu tiên:** P1 · **Phụ thuộc:** không · **Đụng file chung với:** Phase 2 (docs), Phase 3 (`tools/`)

## Hiện trạng (rà soát 2026-11-07)

3 lượt rà soát song song (rule ↔ rule, skill ↔ rule, docs ↔ code) tìm ~33 mâu thuẫn riêng
biệt; các phát hiện nặng đã kiểm lại bằng cả hai dòng nguồn. `npm test`, `drift`, `gaps`,
`boundary` đều pass — tool hiện tại **không** bắt được lớp lỗi này.

Nguyên nhân gốc:

1. **Rule chép ra 3–5 nơi với con số khác nhau** (`copilot-instructions.md` là "nguồn duy
   nhất" nhưng `CLAUDE.md`, `AGENTS.md`, skill, template tự viết lại): mục tiêu vùng vàng
   600 vs 640, trần ApiClient 200 vs 250, cột bảng truy vết.
2. **Hợp đồng do code đọc chỉ mô tả bằng lời**: thứ tự cột (`sources.js:235`), title
   `TC-xxx - AC-yyy` (`sources.js:36`), chữ ký helper (`deep-guards.ts`,
   `state-boundary-guards.ts`).
3. **Gate trên giấy**: pre-commit hook không tồn tại, CI không chạy `limits`,
   `npm run qa:boundary --strict` không bật strict, `Page exposure` không ép XSS.
4. **Xung đột chính sách chưa ai quyết**: quarantine vs gate, `test.skip`, thứ tự selector,
   số lần tái hiện bug (2 vs 3), giá trị XSS `Not applicable`, bộ trạng thái của
   `qa-ui-review`, mã `Q-01` vs `Q-001`.

## Đợt 1 — Sửa lỗi làm hỏng artifact (máy móc, 1 PR) — xong 2026-11-07

- [x] `templates/automation-plan-template.md`: title có `AC-yyy` + tag `@REQ`; checklist dùng
  `npm run qa:matrix` thay cho sửa tay `traceability.md`.
- [x] `copilot-instructions.md` Rule 7: bỏ "hoặc comment" (mâu thuẫn Rule 12); đường dẫn Master
  Process không cố định ổ đĩa.
- [x] `qa-test-execution`: dòng truy vết đúng thứ tự cột của template, Automation
  `Yes`/`Candidate`/`No`; evidence bug đính vào Playwright report thay cho `evidence/`.
- [x] `qa-logic-gaps`: chữ ký helper khớp code (SKILL + `bug-hunting-heuristics.md`); mã
  DH/PA trích dẫn theo catalog chuẩn; 2 file hướng dẫn ghi rõ mã của chúng không phải mã chuẩn.
  Sửa luôn mã trích sai ở `qa-api-testing` và `qa-system-testing/edge-case-catalog.md`.
- [x] `qa-api-testing`: ApiClient trong `tests/` = role `module` 250; ví dụ ghi rõ ID là
  placeholder.
- [x] Mục tiêu vùng vàng thống nhất theo code (`code-limits.js:46`): 640/200/160/120 ở
  copilot-instructions, 4 skill, `docs/automation-strategy.md`, capability inventory.
- [x] Docs lệnh: `qa:check` (CI chưa chạy limits), `verify` 4 bước, gate PR có test của REQ bị
  đụng, `qa:boundary -- --strict`. `test:smoke`/`test:p0` thêm `--grep-invert @wip`.
- [x] Lỗi nhỏ: path test case trong requirement template, `REQ-16-P6`, anchor Rule 14,
  chú thích mật khẩu seed, `networkidle`, câu `README.md:84`, "pre-commit hook chặn cứng".

Gate: `npm test` 281/281, `npm run qa:check` pass, `playwright: npm run verify` pass (61 test).

Còn lại sang Đợt 2: hai cặp file DH/PA vẫn dùng cùng mã với nghĩa khác (`scaffold.test.js:225`
parse 2 file hướng dẫn như catalog DH/PA). Cách dứt điểm: gộp vào catalog chuẩn hoặc đổi tiền tố
và sửa test, kèm test chặn trùng mã.

## Đợt 2 — Guardrail để tài liệu không lệch lại

- [ ] Unit test trong `npm test`: header test-case template = thứ tự cột parser; mọi dòng
  truy vết ví dụ trong skill/template parse được; mã DH/PA duy nhất trên mọi catalog;
  lời gọi `expectXxx(` trong `.md` khớp chữ ký export.
- [ ] Bỏ con số lặp ở `CLAUDE.md`, `AGENTS.md`, skill → link tới Rule 15.

## Đợt 3 — Gate thật hoặc bỏ lời hứa

- [ ] CI job `traceability` chạy thêm `node tools/qa/limits --strict`.
- [ ] `.githooks/pre-commit` + `core.hooksPath` chạy `qa:limits --staged` (đề xuất), hoặc
  xoá hẳn câu "pre-commit chặn cứng".
- [ ] `Page exposure: Public/Customer` bắt buộc XSS; `Exempt` phải có lý do.

## Đợt 4 — Quyết định chính sách (owner chốt qua `npm run decisions`)

- [ ] 7 câu hỏi ở nguyên nhân gốc 4; sửa docs sau khi chốt.
- [ ] Phạm vi Rule 15 cho `tools/` → Phase 3.

## Tiêu chí hoàn thành

- Mỗi giá trị (trần, cột, format, chữ ký) chỉ định nghĩa ở một nơi; nơi khác link tới.
- Test Đợt 2 fail khi tài liệu lệch code.
- Gate chung của Plan 20 pass.
