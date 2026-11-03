# Phase 4 — Đề xuất thay đổi file `ship` cho Hub (T4.1) và quyết định runner (T4.2)

> **Trạng thái:** `PROPOSED` · **Ngày:** 2026-11-03 · **Người soạn:** Claude (dev phase 4), chưa duyệt.
> `.agents/skills/qa-performance-testing/SKILL.md` và `docs/performance-testing.md` thuộc nhóm `ship` trong
> `sync-manifest.json`. Satellite này KHÔNG sửa tại chỗ.
> Code seed tương ứng: `playwright/tests/support/perf-{profile,metrics,loadgen,compare}.ts`.

## 1. `.agents/skills/qa-performance-testing/SKILL.md` (mới)

1. **Phân loại phép đo trước khi chạy:**
   - **Browser timing** (Navigation/Resource Timing, Web Vitals): đo một người dùng, không phải tải.
   - **API latency**: p50 / p95 / p99 của một endpoint dưới arrival rate xác định.
   - **System load**: throughput, error rate, dropped work và tài nguyên dưới load, spike hoặc soak.
2. **Profile `perf-profile/1` là điều kiện bắt buộc:**
   - Gồm: mô hình mở (constant arrival rate), warm-up, dataset seed, stop conditions, và SLO có `source`.
   - Có `approval` của owner, và người duyệt khác tác giả.
   - Thiếu approval → kết quả chỉ là `THRESHOLD_CHECK_ONLY` hoặc `THRESHOLD_BREACHED`, không bao giờ "đạt SLA".
   - Thiếu `source` → `SPEC_GAP`, run không hợp lệ.
3. **Chạy:**
   - Chỉ bắn tải vào môi trường đã được cấp quyền (Q-16-P4).
   - Generator tham chiếu chỉ cho phép host local.
   - Raw samples (`perf-samples.ndjson`) luôn được giữ trong evidence, gồm cả error và dropped.
4. **Đọc kết quả:**
   - `perf-result.json` phải tính lại được từ raw.
   - Exit 0 = đạt, 1 = vượt ngưỡng, 2 = run không hợp lệ (thiếu sample, profile lỗi).
   - `ENVIRONMENT_BUSY` nghĩa là chính máy tạo tải bị nghẽn, nên latency đo được không quy cho app.
5. **So sánh baseline:**
   - `compareRuns` chỉ so khi cùng workload hash, seed và env, và mỗi bên có ít nhất 3 lần chạy.
   - Chỉ kết luận `REGRESSION_REPRODUCED` khi mọi lần candidate đều tệ hơn mọi lần baseline, vượt dung sai.
   - Một sample hoặc môi trường bận không bao giờ là regression.

## 2. `docs/performance-testing.md` (mới)

Dàn ý:
1. Thuật ngữ: open vs closed model, coordinated omission, warm-up.
2. Thiết kế load / spike / soak và stop conditions.
3. Capacity của môi trường test.
4. Ghi và giữ raw metrics; percentile tính theo nearest-rank.
5. Dung sai so sánh và lý do phải chạy lặp.
6. Telemetry tài nguyên của cả generator lẫn hệ thống đích. Telemetry hệ thống đích chưa được triển khai, cần
   quyền truy cập môi trường.
7. Giới hạn: kết quả synthetic không phải capacity production.

## 3. T4.2 — Chọn runner production (CHƯA QUYẾT, cần owner)

Harness hiện dùng generator tham chiếu viết bằng Node core để kiểm công cụ. Nó không thay runner production:
- không phân tán tải;
- không đo được tài nguyên của hệ thống đích;
- giới hạn khoảng 500 rps.

| Tiêu chí spike | k6 (candidate) | Generator Node core hiện có |
|---|---|---|
| Version / license | Chưa chốt (B4). Cần kiểm license và cách phân phối binary | Không có dependency |
| Mô hình mở / arrival rate | Có (`constant-arrival-rate`) | Có, đơn tiến trình |
| Raw metrics | `--out json` hoặc summary export, cần adapter về `PerfSample` | Có sẵn |
| JUnit / receipt | Cần adapter: chạy dưới Playwright run hoặc tự sinh receipt | Đi qua evidence Phase 1 |
| Phân tán / tải lớn | Có | Không |

Đề xuất: spike k6 với một workload tham chiếu.
- Adapter đọc output JSON của k6 → `PerfSample[]`, rồi dùng lại `evaluateRun` / `compareRuns`.
- Chỉ thêm dependency sau khi owner duyệt version và license (PDR-16-P4-02).

## 4. Quyết định cần owner/Hub

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| HUB-16-P4-1 | Ship 2 file trên? | Có, sau khi chốt T4.2 |
| Q-16-P4 | SLO, tải mục tiêu, quyền chạy load trên môi trường nào? | Chặn bật gate; harness chỉ dùng local |
