import type { Locator, Page, TestInfo } from '@playwright/test';

export type JourneyCaptureOptions = {
  /**
   * Chụp toàn bộ chiều dài trang thay vì chỉ khung nhìn viewport hiện tại.
   * Mặc định là false để giảm dung lượng file và tăng tốc độ xử lý I/O.
   */
  fullPage?: boolean;
  /**
   * Ép buộc chụp ảnh bất kể tag hoặc biến môi trường.
   */
  force?: boolean;
};

export type BugAnnotationOptions = {
  /**
   * Nhãn ngắn hiển thị ngay góc trên khung khoanh đỏ (ví dụ: "Chữ tràn khung", "Nút bị đè").
   */
  label?: string;
  /**
   * Đường dẫn lưu file ảnh trên đĩa (nếu cần lưu ra `.delivery/issues/` hoặc thư mục report).
   */
  path?: string;
  /**
   * Đối tượng TestInfo của Playwright để tự động đính kèm vào HTML Report.
   */
  testInfo?: TestInfo;
  /**
   * Chụp toàn trang hay chỉ viewport hiện tại (mặc định: false).
   */
  fullPage?: boolean;
};

/**
 * Kiểm tra xem chế độ ghi nhận visual timeline cho user journey có đang được bật hay không.
 */
export function isJourneyCaptureEnabled(testInfo?: TestInfo): boolean {
  const isEnvActive =
    process.env.CAPTURE_JOURNEY === 'true' || process.env.CAPTURE_JOURNEY === '1';
  if (isEnvActive) return true;

  if (testInfo?.tags) {
    return testInfo.tags.some((tag) => tag.toLowerCase() === '@journey');
  }

  return false;
}

/**
 * Chụp ảnh bằng chứng theo từng mốc hành trình người dùng (User Journey Milestone).
 *
 * Tiêu chuẩn & Quy tắc:
 * 1. Không chụp sau từng click/phím gõ cơ học — chỉ chụp tại các mốc chuyển trạng thái quan trọng (Milestone States):
 *    - Start State: Màn hình bắt đầu luồng
 *    - Filled State: Form đã nhập đủ dữ liệu hợp lệ
 *    - Processing / Feedback State: Modal xác nhận / Loading
 *    - Final / Success State: Màn hình kết quả thành công
 * 2. Chỉ chụp khi test mang tag `@journey` HOẶC biến môi trường `CAPTURE_JOURNEY=true` (hoặc `options.force=true`).
 * 3. Tự động đính kèm ảnh vào Playwright HTML Report / Artifacts phục vụ xem timeline trên Dashboard.
 * 4. Không áp dụng cho các test negative/validation thông thường để bảo đảm hiệu năng CI/CD.
 */
export async function captureJourneyStep(
  page: Page,
  testInfo: TestInfo,
  stepNumber: number,
  stepDescription: string,
  options?: JourneyCaptureOptions,
): Promise<void> {
  const shouldCapture = options?.force || isJourneyCaptureEnabled(testInfo);
  if (!shouldCapture) {
    return;
  }

  const paddedStep = String(stepNumber).padStart(2, '0');
  const attachmentTitle = `Journey Step ${paddedStep}: ${stepDescription}`;

  const imageBuffer = await page.screenshot({
    fullPage: options?.fullPage ?? false,
  });

  await testInfo.attach(attachmentTitle, {
    body: imageBuffer,
    contentType: 'image/png',
  });
}

/**
 * Khoanh khung đỏ trực tiếp lên phần tử bị lỗi trên giao diện rồi chụp ảnh bằng chứng,
 * giúp người đọc nhìn vào hình biết ngay vị trí cần tập trung. Sau khi chụp xong sẽ tự gỡ khung.
 */
export async function captureAnnotatedBugEvidence(
  page: Page,
  target: Locator,
  options: BugAnnotationOptions = {},
): Promise<Buffer> {
  const overlayId = `__qa_bug_focus_${Date.now()}`;
  const labelText = options.label ?? 'Vị trí lỗi';

  await target.first().scrollIntoViewIfNeeded().catch(() => {});
  await target
    .first()
    .evaluate(
      (el, { id, text }) => {
        const rect = el.getBoundingClientRect();
        const box = document.createElement('div');
        box.id = id;
        box.style.cssText = [
          'position:fixed',
          `left:${Math.max(0, rect.left - 4)}px`,
          `top:${Math.max(0, rect.top - 4)}px`,
          `width:${rect.width + 8}px`,
          `height:${rect.height + 8}px`,
          'border:3px solid #ef4444',
          'border-radius:4px',
          'background:rgba(239,68,68,0.08)',
          'box-shadow:0 0 0 2px rgba(255,255,255,0.9), 0 0 12px rgba(239,68,68,0.65)',
          'pointer-events:none',
          'z-index:2147483647',
        ].join(';');

        const badge = document.createElement('span');
        badge.textContent = text;
        badge.style.cssText = [
          'position:absolute',
          'top:-24px',
          'left:-3px',
          'background:#ef4444',
          'color:#ffffff',
          'font:600 12px/16px sans-serif',
          'padding:2px 6px',
          'border-radius:3px',
          'white-space:nowrap',
        ].join(';');
        box.appendChild(badge);
        document.body.appendChild(box);
      },
      { id: overlayId, text: labelText },
    )
    .catch(() => {});

  try {
    const imageBuffer = await page.screenshot({
      path: options.path,
      fullPage: options.fullPage ?? false,
    });
    if (options.testInfo) {
      await options.testInfo.attach(`Bug Evidence: ${labelText}`, {
        body: imageBuffer,
        contentType: 'image/png',
      });
    }
    return imageBuffer;
  } finally {
    await page
      .evaluate((id) => {
        document.getElementById(id)?.remove();
      }, overlayId)
      .catch(() => {});
  }
}
