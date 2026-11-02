# Research Report RES-16: Testing Professionalization & Evidence Governance

> **Research ID:** RES-16 · **Stage:** PRE_PLAN · **Level:** R3 · **Gate:** CONDITIONAL  
> **Date:** 2026-11-02 · **Authors:** @ba (Business Analyst), @tl (Tech Lead)

---

## 1. Executive Summary

Research này đánh giá năng lực kiểm thử hiện có của workspace `qa-workspace` (baseline `5f3124e`), khảo sát các giải pháp cho 5 chiều kiểm thử nâng cao (Evidence Contract, Bug Reproduction, Visual Regression, Performance, Contract/CDC) để phục vụ lập kế hoạch `PLAN-16`.

Kết luận chính:
1. **Tái sử dụng tối đa nền tảng hiện có**: Không cài đặt framework ngoài trùng lặp với `tools/qa`, `deep-guards.ts`, `ui-checks.ts`, và `runtime-trap.ts`.
2. **Khóa hợp đồng Evidence & Reproduction**: Chuyển đổi các ảnh chụp/log rời rạc thành Evidence Manifest có cấu trúc và quy trình tái hiện bug độc lập 3 bước (Rule 14).
3. **Quản trị điều kiện mang theo**: 6 câu hỏi mở (U-1 đến U-6) được định tuyến vào các phase tương ứng, không chặn triển khai Phase 0.

---

## 2. Findings & Evidence Basis

- **F-1 (Codebase Guards)**: `ui-checks.ts:25` và `deep-guards.ts:18` đã có bộ kiểm tra hình học và tính bền vững trạng thái hoạt động tốt.
- **F-2 (Runtime Trap)**: `runtime-trap.ts:1` tự động bắt `console.error`, `pageerror` và lọc nhạy cảm Bearer/Cookie.
- **F-3 (A11y)**: `@axe-core/playwright` đã tích hợp trong `login.a11y.spec.ts`.
- **F-4 (Visual Baseline)**: Playwright hỗ trợ `toHaveScreenshot()`, cần quy chuẩn baseline review.
- **F-5 (Performance)**: k6 thresholds cung cấp pass/fail SLO rõ ràng, cần spike tích hợp.

---

## 3. Implications for Plan (IMP-1 to IMP-10)

- **IMP-1 (Architecture)**: Bổ sung manifest schema và execution receipt vào pipeline test.
- **IMP-2 (Scope/Tests)**: Chuẩn hóa quy trình tái hiện bug và kiểm chứng trước/sau sửa lỗi.
- **IMP-3 (Architecture/Tests)**: Áp dụng native snapshot của Playwright, quản trị baseline trên CI.
- **IMP-4 (Scope)**: Mở rộng checklist a11y, không tạo scan trùng lặp.
- **IMP-5 (Tasks/Risk)**: Spike adapter cho k6 runner và chốt SLO với SRE ở Phase 4.
- **IMP-6 (Tests)**: Bổ sung mutation/property testing dựa trên nền tảng HM probes.
- **IMP-7 (Scope/Tests)**: Mở rộng kiểm soát API security theo tiêu chuẩn OWASP ASVS.
- **IMP-8 (Architecture)**: Kiểm chứng JSON schema trước, xem xét Pact khi có microservices.
- **IMP-9 (Tasks)**: Đưa kịch bản async, exploratory và flaky metrics vào vận hành.
- **IMP-10 (Scope/Reject)**: Từ chối nhập nguyên bộ skill ngoài để bảo vệ traceability và boundaries.

---

## 4. Open Unknowns & Conditions Carried Forward

- **U-1 (P1)**: Nơi lưu artifact và TTL $\to$ Khóa trong ADR-16 và Phase 1.
- **U-2 (P1)**: Ứng dụng pilot và synthetic dataset $\to$ Xác nhận trong Phase 2.
- **U-3 (P1)**: SLO và môi trường tải $\to$ Thống nhất trong Phase 4.
- **U-4 (P1)**: Topology và async convergence $\to$ Rà soát trong Phase 7.
- **U-5 (P1)**: Signer/CI trust và Multi-runner $\to$ Kiểm chứng trong Phase 0 và Phase 8.
- **U-6 (P2)**: Rà soát dependency license $\to$ Thực hiện trong các Phase 3-7.

