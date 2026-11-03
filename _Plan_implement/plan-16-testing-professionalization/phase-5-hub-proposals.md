# Phase 5 — Đề xuất thay đổi file `ship` cho Hub (T5.1) và quyết định công cụ (T5.2)

> **Trạng thái:** `PROPOSED` · **Ngày:** 2026-11-03 · **Người soạn:** Claude (dev phase 5), chưa duyệt.
> Cả 4 file trong §B2 của [phase-5](phase-5-test-quality.md) đều thuộc nhóm `ship`:
> - `tools/qa/lib/evidence-contract.{js,test.js}`
> - `.agents/skills/qa-test-quality/SKILL.md`
> - `docs/test-quality.md`
>
> Satellite này KHÔNG sửa tại chỗ. Bản triển khai tương đương nằm ở seed:
> - `playwright/tests/support/prop-{arbitrary,check}.ts`
> - `playwright/tests/support/mutation-{engine,score}.ts`
> - `playwright/deep-engine-tests/test-quality.*`

## 1. `tools/qa/lib/evidence-contract.{js,test.js}` (Hub)

Đề xuất: port validator manifest/receipt của Phase 1 (`evidence-manifest.ts`, `evidence-receipt.ts`) sang JS
zero-dependency trong `tools/qa`. Kèm theo test `node --test`:
- property cho validator: manifest hợp lệ ngẫu nhiên → không lỗi; bỏ hoặc đổi kiểu một field bất kỳ → fail-closed;
- mutation run với kill suite là chính các property đó.

Lý do không làm tại satellite:
- `tools/qa` là ship;
- `npm test` gốc (`node --test tools/`) đang lỗi `MODULE_NOT_FOUND` trên Node 22.3 (đã ghi ở Phase 1).

## 2. `.agents/skills/qa-test-quality/SKILL.md` (mới)

1. **Property:**
   - Invariant lấy từ định nghĩa hoặc contract, ghi `source`. Không có nguồn → `SPEC_GAP`, không chạy.
   - Chạy `checkProperty(name, arb, predicate, { seed, numRuns, source })`.
   - Khi fail: report lưu `seed / runIndex / path`. Tái hiện bằng `replayProperty`, không cần chạy lại N lần.
   - Counterexample là cực tiểu cục bộ theo shrinker, không phải cực tiểu toàn cục. Ví dụ percentile cần đổi cả n lẫn p.
2. **Mutation:**
   - Mutant chỉ sống trong sandbox; repo không bị sửa.
   - Kill suite phải xanh trên bản gốc (baseline); nếu không, kết quả vô nghĩa.
   - Survivor xử lý theo thứ tự:
     - thêm kiểm khi mutant có ý nghĩa;
     - `EQUIVALENT` có lý do khi không thể phân biệt được bằng hành vi;
     - `ACCEPTED_RISK` có lý do khi khác hành vi nhưng nằm ngoài contract. Loại này vẫn tính vào mẫu số.
   - Không exclude theo file hay pattern. `TIMEOUT` tính là đã phát hiện; `INVALID` (không nạp được) bị loại khỏi
     mẫu số, có ghi lý do.
3. **Không đặt mutation score toàn repo** khi chưa có ngưỡng có nguồn (Q-16-P5).
4. **Phân biệt với HM hiện có:** các spec HM-00..HM-13 đã có probe đột biến viết tay, đặt cạnh từng helper.
   Mutation engine là công cụ tổng quát, sinh mutant theo operator.

## 3. `docs/test-quality.md` (mới)

Dàn ý:
1. Chọn invariant từ contract: ví dụ percentile nearest-rank, redaction.
2. Thiết kế arbitrary để tránh false positive (bảng chữ cái tách rời).
3. Đọc report property: seed, path, shrink và counterexample bị redaction che.
4. Bộ operator mutation, và cách engine né comment, string, generic.
5. Quy trình triage, kèm ví dụ thật ở `test-quality.triage.ts`.
6. Ngân sách CI: số mutant và thời gian.

## 4. T5.2 — fast-check / Stryker (CHƯA QUYẾT, cần owner)

| Tiêu chí | fast-check / Stryker (candidate) | Bản tối giản hiện có |
|---|---|---|
| Version / license | Chưa chốt (B4) | Không dependency |
| Arbitrary / shrinker | Rất đầy đủ; shrink tích hợp, đa chiều | Integer / array / string / tuple / constantFrom; shrink tham lam theo từng chiều |
| Mutation operators | Đầy đủ, theo AST, có incremental và coverage | 8 nhóm theo regex trên vùng code; không có coverage |
| Runner | Stryker chạy được với `node --test` qua plugin/command runner, cần spike | Chạy qua Playwright run con (transpile TS) |
| Ngân sách CI | Cần benchmark | Khoảng 1.6 phút cho 3 test (≈ 85 mutant + 1 run property) |

Đề xuất:
- Spike fast-check cho validator `tools/qa` (JS, `node --test`).
- Spike Stryker command-runner cho một module seed.
- Giữ format report (`property-report/1`, `mutation-report/1`) để đổi engine không phải đổi gate.

## 5. Quyết định cần owner/Hub

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| HUB-16-P5-1 | Ship 4 file trên? | Có, sau spike T5.2 |
| Q-16-P5 | Mutation budget, scope pilot, ngưỡng score? | Chưa đặt; hiện chỉ báo score, không gate theo score |
