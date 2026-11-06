# Phase 0 — Git hygiene & merge công việc treo

**Ưu tiên:** P0 · **Phụ thuộc:** không

## Hiện trạng

- `chore/gate-fix-node22` đi trước `origin/main` 4 commit (`04a4a44`, `b7a98e0`,
  `0b9ff95`, `ddf5ea9`) và đã push lên `origin/chore/gate-fix-node22`, chưa vào `main`.
- `claude/silly-knuth-1f43ce` (worktree `.claude/worktrees/silly-knuth-1f43ce`) có 2 commit
  chưa nằm trên nhánh nào khác:
  - `f462be4` fix(security): repair HM-11 TC-16-P6-1/2 deep-engine tests
  - `3de1567` feat(quality): bug-hunting phase 5 mutation pilot on evidence manifest validator
- `feat/plan-16-phase-1-evidence` không còn commit nào ngoài `main` → có thể xoá.
- Thư mục `scratch/` ở gốc chứa script thử nghiệm JS-8865 (đã gitignore, chỉ là rác cục bộ).

## Việc cần làm

- [ ] Mở PR `chore/gate-fix-node22` → `main`; chờ CI xanh rồi merge.
- [ ] Rebase `claude/silly-knuth-1f43ce` lên `main` mới; chạy
  `npm run test:deep-engine` + `npm test`; đối chiếu với
  [phase-5-mutation-pilot.md](../bug-hunting-gap-closure/phase-5-mutation-pilot.md).
  Quyết định merge (PR riêng) hoặc bỏ có ghi lý do.
- [ ] Kiểm tra file mới của pilot (`mutation-pilot.kill-suites.ts`, `mutation-pilot.spec.ts`)
  qua `npm run qa:limits -- --strict`.
- [ ] Sau khi merge/bỏ: `git worktree remove` worktree cũ, xoá nhánh local + remote đã merge
  (`feat/plan-16-phase-1-evidence`, `chore/gate-fix-node22`, `claude/silly-knuth-1f43ce`).
- [ ] Dọn `scratch/` ở gốc: chuyển phần còn giá trị sang `research/` hoặc xoá.

## Tiêu chí hoàn thành

- `git log origin/main..<mọi nhánh local>` rỗng hoặc mỗi nhánh còn lại có lý do ghi rõ.
- `git worktree list` chỉ còn checkout chính.
- Checkbox Phase 5 của bug-hunting roadmap phản ánh đúng kết quả.
