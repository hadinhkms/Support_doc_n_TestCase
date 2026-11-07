# Phase 0 — Git hygiene & merge công việc treo

**Ưu tiên:** P0 · **Phụ thuộc:** không · **Trạng thái:** phần cục bộ xong (2026-11-07); chờ push/PR

## Hiện trạng ban đầu

- `chore/gate-fix-node22` đi trước `origin/main` 4 commit (`04a4a44`, `b7a98e0`,
  `0b9ff95`, `ddf5ea9`) và đã push lên `origin/chore/gate-fix-node22`, chưa vào `main`.
- `claude/silly-knuth-1f43ce` (worktree `.claude/worktrees/silly-knuth-1f43ce`) có 2 commit
  chưa nằm trên nhánh nào khác:
  - `f462be4` fix(security): repair HM-11 TC-16-P6-1/2 deep-engine tests
  - `3de1567` feat(quality): bug-hunting phase 5 mutation pilot on evidence manifest validator
- `feat/plan-16-phase-1-evidence` không còn commit nào ngoài `main` (chỉ có local).
- Thư mục `scratch/` ở gốc chứa script thử nghiệm JS-8865 (đã gitignore, chỉ là rác cục bộ).

## Việc cần làm

- [ ] Mở PR `chore/gate-fix-node22` → `main` (giờ thêm commit Plan 20); chờ CI xanh rồi merge.
- [x] Đưa 2 commit của worktree sang nhánh mới `feat/bug-hunting-phase5-mutation-pilot`
  (cherry-pick lên `ddf5ea9`). Xung đột ở
  [phase-5-mutation-pilot.md](../bug-hunting-gap-closure/phase-5-mutation-pilot.md): giữ trạng
  thái N/A cho product code của `main`, thêm mục "Framework-scope pilot" với kết quả pilot.
- [x] Kiểm chứng: full `deep-engine --workers=2` ban đầu **58 pass / 2 fail** (HM-14
  TC-16-P5-2 `BASELINE_NOT_GREEN`, HM-04 timeout 350ms). Nguyên nhân HM-14: mỗi mutation run
  mở Playwright lồng 4 worker, `mut-perf` mất ~70s khi máy rảnh so với trần spawn 90s, nên bị kill
  khi chạy chồng với HM-16. Sửa ở commit `16ad952`: khoá liên tiến trình cho mutation run,
  timeout nested 180s, HM-16 timeout 420s. Sau sửa: **60/60 pass** (7.5 phút).
  HM-04 pass ở mọi lần chạy lại — là flake do tải, chưa sửa.
- [x] `npm run verify` (typecheck, lint, limits 93 file, list) và `qa:check` pass.
- [ ] Push `feat/bug-hunting-phase5-mutation-pilot` và commit Plan 20 của
  `chore/gate-fix-node22` — phiên AI không có credential GitHub, người dùng cần tự push.
- [ ] Mở PR riêng cho `feat/bug-hunting-phase5-mutation-pilot` sau khi PR trên vào `main`;
  owner xác nhận pilot phạm vi framework đóng Phase 5 (exit gate cuối của phase-5 doc).
- [x] Gỡ worktree `silly-knuth-1f43ce`, xoá nhánh local `claude/silly-knuth-1f43ce` và
  `feat/plan-16-phase-1-evidence`.
- [ ] Sau khi merge: xoá nhánh `chore/gate-fix-node22` và `feat/bug-hunting-phase5-mutation-pilot`
  (local + remote).
- [x] Dọn `scratch/` ở gốc — owner duyệt xoá (exploration Vieclam24h, không thuộc Hub).

## Tiêu chí hoàn thành

- `git log origin/main..<mọi nhánh local>` rỗng hoặc mỗi nhánh còn lại có lý do ghi rõ.
- `git worktree list` chỉ còn checkout chính. ✅
- Checkbox Phase 5 của bug-hunting roadmap phản ánh đúng kết quả.

## Theo dõi

- HM-04 `expectPairwiseNoOverlap` dùng timeout 350ms, fail khi máy tải cao → đưa vào Plan 20
  Phase 4 hoặc flaky log.
