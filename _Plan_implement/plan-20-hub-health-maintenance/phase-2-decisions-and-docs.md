# Phase 2 — Decision log & tài liệu lệch

**Ưu tiên:** P1 · **Phụ thuộc:** không (làm song song Phase 1 được)

## Hiện trạng

`npm run decisions`: 10 quyết định chờ, 7 đang "CHẶN" — phần lớn tạo từ tháng 10/2026.
Một số không còn hợp lệ với định hướng ở Plan 19:

- D-06, D-07: owner/nhãn UI của REQ-001 — Plan 19 đã xác định REQ-001 là fixture demo.
- D-08: 10 spec company/admin để bật gate ở CarThings — thuộc satellite.
- D-09, D-11: identity git / phạm vi Vieclam24h — thuộc satellite.
- D-10: có sync `.github/workflows` xuống satellite không — **thuộc Hub**, ảnh hưởng
  trực tiếp Plan 19 Phase 2 (seed runtime).

Tài liệu/nhãn lệch hành vi:

- `tools/boundary` in nhãn `SEED (chỉ copy khi thiếu)`, nhưng
  [hub-and-project-boundary.md](../../docs/hub-and-project-boundary.md) (mục hạn chế) ghi
  seed **chưa được thi hành** — sync hiện ghi đè. Người đọc output tool sẽ hiểu sai.
- Bảng lệnh trong `CLAUDE.md`/`AGENTS.md` thiếu `npm run qa:learn` (có trong `package.json`).

## Việc cần làm

- [ ] Owner duyệt từng quyết định (dashboard hoặc `answer.optionId` + `confirmedBy`):
  - đóng các quyết định ngoài phạm vi Hub với lý do "chuyển sang repo satellite";
  - ưu tiên chốt D-10 vì Plan 19 Phase 2 phụ thuộc.
- [ ] `npm run decisions:render` để cập nhật `DECISIONS.md`.
- [ ] Đổi nhãn seed trong `tools/boundary/index.js` thành nội dung trung thực, ví dụ
  `SEED (dự định copy-if-missing — sync hiện vẫn ghi đè)`, cập nhật test boundary tương ứng.
  Gỡ phần chú thích khi Plan 19 Phase 2 hoàn tất.
- [ ] Thêm dòng `npm run qa:learn` vào bảng lệnh trong `CLAUDE.md` và `AGENTS.md`
  (hai file ship, phải giống nhau).

## Tiêu chí hoàn thành

- `npm run qa:summary` không còn quyết định "CHẶN" quá hạn; mỗi quyết định còn mở có hạn rà lại.
- Output `npm run qa:boundary` khớp với tài liệu boundary.
- `npm test` pass sau khi đổi nhãn.
