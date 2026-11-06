# Plan 20 — Hub Health & Maintenance

## Mục tiêu

Dọn các vấn đề bảo trì phát hiện khi rà repo Hub ngày 2026-11-07, trước khi làm tiếp
roadmap tính năng ở [Plan 19](19_QA_HUB_RESEARCH_IMPROVEMENT_ROADMAP.md). Plan này
không thêm capability mới; chỉ đưa repo về trạng thái sạch, nhất quán với rule của chính nó.

## Bằng chứng rà soát (2026-11-07, nhánh `chore/gate-fix-node22` @ `ddf5ea9`)

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 281/281 pass, nhưng mất **~204 giây** |
| `npm run qa:check` | Pass (boundary, drift, gaps, limits) |
| `playwright: npm run verify` | Pass (typecheck, lint, limits, 61 test listed) |
| Link tương đối trong 59 file `.md` (trừ `_Plan_implement`) | 0 link hỏng |
| `npm run ...` được nhắc trong skills/docs | Tất cả đều tồn tại |
| `npm run qa:summary` | WARNING — 10 quyết định chờ duyệt, 7 đang chặn |

Vấn đề phát hiện:

1. **Công việc chưa merge.** Nhánh hiện tại đi trước `origin/main` 4 commit. Worktree
   `.claude/worktrees/silly-knuth-1f43ce` (nhánh `claude/silly-knuth-1f43ce`) có 2 commit
   chưa có ở đâu khác: mutation pilot (bug-hunting Phase 5) và sửa test HM-11.
2. **Dependency/CI lệch.** `@types/node ^20` trong khi `engines` và CI dùng Node 22;
   Playwright 1.65 đã có; GitHub Actions vẫn dùng `@v4`; ESLint 10 và TypeScript 7
   là bản major mới chưa đánh giá.
3. **Tooling của Hub vi phạm Rule 15 của chính Hub.** `qa:limits` chỉ quét `playwright/`,
   nên `tools/` không bị kiểm tra: `learner.js` 2744 dòng, `sources.js` 1678,
   `commands.js` 1074 (trần Service 200 / Helper 150); test file tới 1422 dòng (trần 800).
4. **Unit test chậm.** Các test CLI của `qa:learn` mất 15–29 giây mỗi test, chiếm phần
   lớn 204 giây — làm chậm vòng phản hồi và job CI `traceability`.
5. **Decision log tồn đọng.** D-01..D-11 phần lớn tạo từ tháng 10, 7 cái đang "CHẶN";
   một số nói về REQ-001 (Plan 19 đã xác định là fixture demo, ngoài phạm vi) hoặc về
   satellite cụ thể.
6. **Tài liệu/nhãn lệch hành vi.** Tool boundary in nhãn `SEED (chỉ copy khi thiếu)`
   trong khi [docs/hub-and-project-boundary.md](../docs/hub-and-project-boundary.md)
   ghi rõ seed **chưa** được thi hành (sync đang ghi đè). Bảng lệnh trong `CLAUDE.md`
   thiếu `qa:learn`.

## Các phase

| Phase | File | Ưu tiên | Ước lượng |
|---|---|---|---|
| 0 | [Git hygiene & merge công việc treo](plan-20-hub-health-maintenance/phase-0-git-hygiene.md) | P0 | 0.5 ngày |
| 1 | [Dependency & CI runtime](plan-20-hub-health-maintenance/phase-1-deps-and-ci.md) | P1 | 1 ngày |
| 2 | [Decision log & tài liệu lệch](plan-20-hub-health-maintenance/phase-2-decisions-and-docs.md) | P1 | 0.5 ngày |
| 3 | [Tooling tuân thủ Rule 15](plan-20-hub-health-maintenance/phase-3-tools-size-limits.md) | P2 | 3–5 ngày |
| 4 | [Tăng tốc unit test](plan-20-hub-health-maintenance/phase-4-unit-test-speed.md) | P2 | 1–2 ngày |

Thứ tự: 0 → 1 → 2 → 3 → 4. Phase 3 và 4 cùng đụng `tools/qa/lib/learner*`, nên làm
tuần tự (hoặc làm Phase 4 ngay sau khi tách `learner.js` ở Phase 3). Sau Plan 20 mới
quay lại Plan 19 (onboarding, seed runtime, skills gate, capability).

## Ngoài phạm vi

- Không sửa repo satellite/consumer.
- Không mở rộng REQ-001 như yêu cầu sản phẩm.
- Không tự trả lời các quyết định trong `decisions.json` thay owner.

## Gate chung mỗi phase

```bash
npm test
npm run qa:check
cd playwright && npm run verify
```
