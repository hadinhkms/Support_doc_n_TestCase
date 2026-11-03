# Phase 2 — Đề xuất thay đổi file `ship` cho Hub (T2.1)

> **Trạng thái:** `PROPOSED` · **Ngày:** 2026-11-03 · **Người soạn:** Claude (dev phase 2), chưa duyệt.
> Ba file trong §B2 của [phase-2](phase-2-bug-reproduction.md) thuộc nhóm `ship` trong
> `sync-manifest.json` (`.agents`, `.github/ISSUE_TEMPLATE`, `docs`). Rule ranh giới: ship chỉ sửa
> tại Hub có thẩm quyền. Vì vậy satellite này KHÔNG sửa tại chỗ; nội dung dưới đây là đề xuất
> để Hub owner duyệt và ship. Code seed tương ứng đã có ở `playwright/tests/support/repro-*.ts`.

## 1. `.github/ISSUE_TEMPLATE/bug_report.yml`

Giữ nguyên các field hiện có (Bối cảnh nghiệp vụ, Traceability, Severity, Preconditions, Steps,
Expected/Actual, Môi trường, Evidence khoanh đỏ). Đề xuất:

| Thay đổi | Lý do (protocol) |
|---|---|
| Thêm dropdown `classification` trước Severity: Observation / TEST_DEFECT / ENVIRONMENT_ISSUE / SPEC_GAP / INTERMITTENT_OBSERVATION / Confirmed Bug / FIX_IMPLEMENTED_UNVERIFIED / VERIFIED_FIXED | §1: phân loại trước khi kết luận; issue status ≠ test PASS |
| Thay input `reproducibility` (`5/5 lần`) bằng textarea `attempts`: n/N lần chạy sạch, bảng attempt → signature → state/seed → run ID | §3 bước 4–6, mục 14 bước 2 |
| Thêm textarea `control`: control khỏe cùng run có pass không | §3 bước 3 |
| Thêm textarea `recipe`: đường dẫn `repro-recipe/1` JSON, lệnh chính xác, **tên** env (không giá trị) | §2; NFR không secret/storageState |
| Thêm textarea `root_cause`: `file:line` đã xác nhận hoặc giả thuyết có nhãn `HYPOTHESIS` | §3 bước 7–8, dual proof |
| Thêm textarea `fix_verification`: before/after/regression/independent rerun receipts, hoặc `NOT_FEASIBLE` + lý do | §6 |
| Thêm input `retention`: ngày hết hạn evidence | §5 |
| Đổi `environment.Build / commit` thành hai dòng: app build + QA revision (dirty?) | §2 |

## 2. `.agents/skills/qa-test-execution/SKILL.md`

- Bước 2: thay quy tắc "Lỗi chưa tái hiện ổn định → `BLOCKED` kèm ghi chú nghi lỗi" bằng
  "→ `BLOCKED` + classification `INTERMITTENT_OBSERVATION`/`Observation` theo
  `reproduction-protocol.md` §1", để trạng thái test và trạng thái issue không lẫn nhau.
- Thêm một mục ngắn "Tái hiện & xác minh bản sửa", trỏ tới `docs/bug-reproduction.md` (mục 3).
  Không chép rule vào skill.
- `FAIL` vẫn chỉ dùng khi đạt mục 14. Bổ sung: có `classifyReproduction()` = `CONFIRMED_BUG`
  trên evidence bundle đã verify, cùng dual proof.

## 3. `docs/bug-reproduction.md` (mới)

Dàn ý đề xuất, mỗi mục ≤ 1 màn hình:
1. Phân loại (bảng §1 của protocol) và ví dụ ranh giới TEST_DEFECT với Confirmed Bug.
2. Recipe `repro-recipe/1`: field, ví dụ, những gì bị từ chối (shell, path, env value, session,
   secret, stale, spec đổi).
3. Ba lần chạy sạch: `--repeat-each=3 --retries=0 --workers=1` với spec/grep chính xác, state riêng
   từng attempt, control trong cùng run.
4. Race: barrier rendezvous, timeline tương quan theo request ID, nhãn `ARTIFICIAL_TRIGGER`.
5. Xác minh bản sửa: before/after cùng test revision + expected hash + seed profile, khác build,
   regression lân cận, rerun độc lập; `NOT_FEASIBLE`.
6. Giới hạn: kết quả là trạng thái bug, không phải chữ ký gate; actor tự khai chưa identity-bound.

## 4. Quyết định cần Hub owner

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| HUB-16-P2-1 | Ship 3 thay đổi trên vào Hub? | Có, cùng một release |
| HUB-16-P2-2 | `repro-*.ts` nên lên `ship` (dùng chung) hay giữ `seed`? | Giữ `seed` tới khi có pilot app |
