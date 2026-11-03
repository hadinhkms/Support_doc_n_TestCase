# Phase 3 — Đề xuất thay đổi file `ship` cho Hub (T3.1)

> **Trạng thái:** `PROPOSED` · **Ngày:** 2026-11-03 · **Người soạn:** Claude (dev phase 3), chưa duyệt.
> Hai file trong §B2 của [phase-3](phase-3-visual-accessibility.md) nằm dưới `.agents`, thuộc nhóm `ship`
> trong `sync-manifest.json`. Satellite này KHÔNG sửa tại chỗ; Hub owner duyệt rồi ship.
> Code seed tương ứng: `playwright/tests/support/{visual-env,visual-baseline,visual-assert,a11y-flows,a11y-scan}.ts`.

## 1. `.agents/skills/qa-visual-regression/SKILL.md` (mới)

Entry gọn. Chi tiết trỏ sang `docs/` (cũng là ship) hoặc file references riêng.
1. **Khi nào dùng:** thay đổi UI có baseline đã duyệt; không dùng visual thay cho assertion nghiệp vụ.
2. **Chụp:** chỉ qua `expectApprovedScreenshot(target, name, { masks, evidence })` trong `*.visual.spec.ts`,
   chạy bằng `playwright test -c visual.config.ts`. Env cố định ở `visual-env.ts` (viewport, DPR, locale, TZ,
   color scheme, reduced motion); chụp theo component và theo trạng thái rủi ro, không chụp cả trang khi không cần.
3. **Baseline:** không bao giờ dùng `--update-snapshots` để làm xanh.
   - Baseline thiếu → chạy → lấy ảnh ứng viên `*-actual.png` trong evidence → người duyệt (khác tác giả) xem →
     `approveBaseline` với lý do. Approval ghi hash, env quan sát được và mask.
   - Baseline bị đổi sau khi duyệt, env lệch, mask chưa duyệt / không có lý do / không khớp phần tử nào → fail.
4. **Review diff:** đọc `visual-review.json` cùng ba ảnh expected / actual / diff trong evidence manifest.
   Đổi UI có chủ đích → duyệt baseline mới kèm PDR nếu expected đổi (BR-16-P3).
5. **Mask:** chỉ cho dữ liệu biến động không thuộc phạm vi test (giờ hệ thống, id), luôn có lý do. Không mask
   vùng đang kiểm.
6. **Giới hạn:** baseline phụ thuộc OS/browser. Baseline local (Windows) không dùng cho CI (Linux); cần owner
   chốt browser/device (Q-16-P3).

## 2. `.agents/skills/qa-ui-review/references/accessibility-workflow.md` (mới)

1. **Tự động:** `runAutomatedScan` (axe, tag wcag2a/aa, 21a/aa). Report luôn có `conformanceClaim: NONE`
   và câu "Automated scan only… NOT a WCAG conformance claim". `conformanceClaimProblems` chặn các cụm như
   "WCAG AA compliant".
2. **Bàn phím & focus:**
   - `checkDialogFocus`: mở modal bằng bàn phím; kiểm role, name, aria-modal; focus vào trong; Tab/Shift+Tab không thoát;
     Escape đóng; focus trở về trigger.
   - `checkFormErrors`: kiểm aria-invalid và aria-describedby; focus về field lỗi đầu; lỗi đi qua live region có sẵn
     từ trước (live region chèn cùng lúc với thông điệp có thể không được đọc).
3. **Reflow:** `checkReflow` ở 320 CSS px. Zoom văn bản 200% và contrast của trạng thái hover/focus vẫn là
   kiểm thủ công.
4. **Screen reader:** chạy `SCREEN_READER_SCRIPT` với NVDA hoặc VoiceOver. Ghi tester, công cụ và kết quả từng
   bước; chưa chạy thì để `NOT_RUN`, không suy ra PASS từ axe.
5. **Báo lỗi:** finding a11y đi qua rule 14 / reproduction-protocol như mọi bug.

## 3. Quyết định cần Hub owner

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| HUB-16-P3-1 | Ship 2 file trên? | Có, cùng release với HUB-16-P2-1 |
| HUB-16-P3-2 | Lưu baseline ở repo hay artifact store? | Repo (`__baselines__`), approval JSON đi cùng; ảnh thật cần review quyền riêng tư |
