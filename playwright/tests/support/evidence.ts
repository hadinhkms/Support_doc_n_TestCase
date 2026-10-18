import type { Page, TestInfo } from '@playwright/test';

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
