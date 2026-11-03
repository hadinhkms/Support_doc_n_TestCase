# Testing Professionalization — Plan Overview

> **Plan ID:** PLAN-QA-16-2026-11-02 · **Trạng thái:** `DRAFT` · **Cấp độ:** L4
> **Baseline QA:** 5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02 · **Ngày:** 2026-11-02
> **Research:** RES-16, R3 bắt buộc; desk research có nguồn, formal Research Gate chưa đóng.
> **Nguồn gốc:** đề xuất research trong chat và yêu cầu lập plan, ưu tiên evidence/reproduce.
> Tài liệu đề xuất để review; không phải lệnh triển khai hoặc tuyên bố gate đã đạt.

## 1. Bối cảnh & mục tiêu
Repo đã có năm skill QA, REQ→AC→TC, guards, runtime trap, axe, CI và flaky policy.
Mục tiêu: tăng độ tin cậy của kết luận test và khả năng người khác tái hiện bug.
Evidence/reproduce là nền tảng cho mọi capability; không xếp cuối như phần đính kèm.
Không viết lại nền tảng đang có; inventory phân biệt existing, partial và proposed.

## 2. WBS & dependency graph
| Phase | Tên | Phụ thuộc | Chủ dự kiến | Trạng thái |
|---|---|---|---|---|
| Phase 0 | [Baseline, Research Gate & hợp đồng](phase-0-governance-and-baseline.md) | — | @ba / @tl | VERIFIED |
| Phase 1 | [Nền tảng Evidence](phase-1-evidence-foundation.md) | 0 | BA/TL cần chỉ định | IMPLEMENTED BUT UNVERIFIED |
| Phase 2 | [Tái hiện bug & xác minh bản sửa](phase-2-bug-reproduction.md) | 1 | BA/TL cần chỉ định | IMPLEMENTED BUT UNVERIFIED |
| Phase 3 | [Visual Regression & Accessibility](phase-3-visual-accessibility.md) | 1, 2 | BA/TL cần chỉ định | IMPLEMENTED BUT UNVERIFIED |
| Phase 4 | [Performance & tải](phase-4-performance.md) | 1, 2 | BA/TL cần chỉ định | IMPLEMENTED BUT UNVERIFIED |
| Phase 5 | [Property-based & chất lượng bộ test](phase-5-test-quality.md) | 1, 2 | BA/TL cần chỉ định | DRAFT |
| Phase 6 | [Security toàn ứng dụng](phase-6-security.md) | 0, 1, 2 | BA/TL cần chỉ định | DRAFT |
| Phase 7 | [Contract, Async & toàn vẹn dữ liệu](phase-7-contracts-async.md) | 0, 1, 2 | BA/TL cần chỉ định | DRAFT |
| Phase 8 | [Exploratory, Flaky Metrics & rollout](phase-8-execution-rollout.md) | 1, 2, 3, 4, 5, 6, 7 | BA/TL cần chỉ định | DRAFT |

```text
0 → 1 → 2 → 3 / 4 / 5 / 6 / 7 → 8
```
- Wave A: Phase 0, Phase 1, Phase 2, không bỏ qua; thử pipeline evidence và reproduce trước.
- Wave B: Phase 3, Phase 4, Phase 5 ưu tiên mặc định; Phase 6 nâng ưu tiên nếu rủi ro bảo mật cao.
- Phase 7: schema validation áp dụng; Pact/broker chỉ khi có kiến trúc phù hợp.
- Phase 8 nghiệm thu rollout sau các nhánh áp dụng; N/A cần owner xác nhận.
- Đây là dependency kỹ thuật, không mặc định giao việc cho nhiều agent.
- Không cam kết lịch trước baseline workload/runtime và nguồn lực reviewer.

## Research Impact
> Research: RES-16 (R3, gate CONDITIONAL) · research/RES-16/report.md
Nguồn: [research-notes.md](research-notes.md); mọi phát biểu proposal cần kiểm chứng ở phase đích.
| IMP | Chủ | Xử lý | Lý do | Áp dụng ở | Kiểm chứng |
|---|---|---|---|---|---|
| IMP-1 | TL | ADAPT | Dùng evidence hiện có, bổ sung manifest và receipt thay vì viết lại | Phase 1 | TC-16-P1-1..3 |
| IMP-2 | BA+TL | ADOPT | Tái hiện độc lập và before/after là tiêu chí trọng tâm người dùng | Phase 2 | TC-16-P2-1..3 |
| IMP-3 | TL | ADOPT | Playwright hỗ trợ screenshot diff, cần baseline governance | Phase 3 | TC-16-P3-1..3 |
| IMP-4 | BA | ADAPT | A11y đã có; mở rộng workflow, không tạo scan trùng | Phase 3 | TC-16-P3-3 |
| IMP-5 | TL | ADAPT | k6 là candidate; SLO và runner adapter phải spike trước | Phase 4 | TC-16-P4-1..3 |
| IMP-6 | TL | ADAPT | Đã có HM fault probes; bổ sung property/mutation tổng quát | Phase 5 | TC-16-P5-1..3 |
| IMP-7 | BA+TL | ADAPT | Reuse API security, mở rộng kiểm soát ứng dụng theo ASVS | Phase 6 | TC-16-P6-1..3 |
| IMP-8 | TL | ADAPT | Schema validator trước, Pact theo topology thực tế | Phase 7 | TC-16-P7-1..3 |
| IMP-9 | TL | ADAPT | Async, exploratory và flaky đã có phần nền cần operationalize | Phase 7, Phase 8 | TC-16-P7-2, TC-16-P8-1..3 |
| IMP-10 | BA+TL | REJECT | Không cài nguyên bộ skill bên ngoài vì trùng rule và traceability | Phase 0 | Review inventory |

## Điều Kiện Mang Theo
Chưa tuyên bố Research Gate CONDITIONAL/PASS; R3 package là điều kiện tiền thực thi.
| ID | Mức / người chốt | Điều kiện | Phase chặn |
|---|---|---|---|
| U-1 | P1 / Owner + TL | Artifact backend, access, retention, quota và deletion (Q-16-01) | 0, 1 |
| U-2 | P1 / Owner + QA | Ứng dụng pilot, môi trường, synthetic dataset và expected (Q-16-02) | 0, 2, 8 |
| U-3 | P1 / Owner + SRE | SLO, workload và môi trường chạy tải được phép (Q-16-03) | 4 |
| U-4 | P1 / TL + service owner | Topology, contract và async convergence (Q-16-04) | 7 |
| U-5 | P1 / Reviewer | Signer/CI trust, compatibility Node runner và receipt (Q-16-05) | 0, 8 |
| U-6 | P2 / TL | Phiên bản, license, vulnerability, ngân sách dependency (Q-16-06) | 3–7 |
Các câu hỏi được giải quyết đúng phase; không phải lý do bỏ nội dung plan.
Không tự đặt retention/SLO hoặc coi quyền truy cập repo là quyền test production.

## 5. Coverage của đề xuất ban đầu
| Năng lực | Cách xử lý | Phase |
|---|---|---|
| Evidence + reproducibility | Hai phase và hai phụ lục chuyên biệt | 1–2 |
| Visual regression | Skill mới, baseline review + diff | 3 |
| Accessibility | Mở rộng qa-ui-review + test stateful/manual | 3 |
| Performance | Skill mới + workload/SLO + raw metrics | 4 |
| Test quality | Property-based + mutation + caller tests | 5 |
| Security | Skill mới + ASVS + evidence privacy | 6 |
| Contract | API schema đầy đủ; CDC theo applicability | 7 |
| Async/data consistency | Mở rộng qa-system-testing | 7 |
| Exploratory | Charter và session report trong execution | 8 |
| Flaky + metrics | Policy hiện có thành report/gate đo được | 8 |
| Data lifecycle | Seed/reset/capture-before-cleanup và TTL | 1–2, 8 |
| Skill routing + scaffold + CI | Tích hợp cuối, không thêm skill mồ côi | 8 |

## 6. Quy trình Master Process áp dụng
- Nguồn: D:/_Master_process/00_CORE_PROCESS_GUIDE.md và 03_ACCEPTANCE_GATES.md.
- Plan template §A–§I, ≤200 dòng/file; cụm đặt trong _Plan_implement hiện hữu đã classified own.
- Tác giả hiện tại là một phiên Codex; không tự nhận hai tác giả BA/TL hay reviewer độc lập.
- Research PRE_PLAN R3 → BA/TL hoàn thiện → plan review độc lập → Gate 2 contract lock.
- Trước code L2+: plan-check --require-approval; plan-review signatures hợp lệ.
- Khi triển khai: impact/gaps trước sửa REQ/TC/spec, canonical IDs và Rule 15.
- Sau code: tests thực tế, evidence block, Gate 3 rồi Gate 4 rồi UAT Gate 4.5.
- Node core test runner cần kiểm allowlist/adapter Master; không tạo JUnit giả để vượt gate.
- Gate closure chỉ dùng clean full SHA và receipt/signature đúng trust; local dirty là tiến độ.
- Dev không tự ký, tick hoàn thành hoặc biến test exit 0 thành approval.
- Thay đổi §A–§G sau lock đi qua PDR; rollback không xóa evidence.
- Reuse evidence phải khớp QA/app revisions, dirty identity, contract và source hashes.
- Không sửa Master Hub, authority store, plan cũ hay user changes trong lượt lập plan.

## 7. Hồ sơ đọc khi thực thi
1. Overview + đúng phase.
2. [Evidence contract](evidence-contract.md).
3. [Reproduction protocol](reproduction-protocol.md).
4. Rule workspace + Master prompt theo giai đoạn; chỉ load reference cần thiết.
5. [Planning validation](planning-validation.md) để biết phần đã/chưa kiểm chứng.

## 8. Checklist tổng thể
- [ ] R3 evidence package hợp lệ, mọi unknown chặn đã có quyết định.
- [ ] BA/TL hoàn thiện phần phụ trách; reviewer độc lập duyệt plan theo Master Authority.
- [ ] Contract/UAT khóa theo phase, receipt adapter kiểm chứng.
- [ ] Wave A đạt evidence/reproduce trước khi mở rộng capability.
- [ ] Wave B và mọi nhánh áp dụng có caller tests và negative controls.
- [ ] Pilot, rollback drill, Gate 3/4/4.5 có chữ ký hợp lệ.
- [ ] Archive bằng Master tooling khi đủ điều kiện; giữ liên kết evidence còn truy xuất được.

