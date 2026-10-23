'use strict';

/**
 * Deep Bug Hunting Template Engine (Plan 14 - Phase 4).
 * Sinh bộ 3 tài liệu (Requirement, Test Cases, Playwright Spec) tích hợp sẵn:
 *   - Canonical Metadata (Page exposure, UI coverage, XSS applicability)
 *   - Coverage notes 4 chiều & 6 nhóm Acceptance Criteria chuẩn
 *   - Capabilities metadata (persistence, boundary, idempotency, ui-geometry, a11y, responsive, xss)
 *   - Import & lời gọi mẫu tới ui-checks.ts và deep-guards.ts (v1.2 signatures)
 */

function renderRequirementTemplate({
  reqId,
  slug,
  title,
  pageExposure = 'Authenticated',
  uiCoverage = 'Required',
  xssApplicability = 'Applicable',
}) {
  const cleanTitle = title || `Feature ${reqId}`;
  const cleanSlug = slug || 'feature';
  const today = new Date().toISOString().slice(0, 10);

  return `---
id: ${reqId}
title: ${cleanTitle}
status: Draft
version: 1.0
risk: High
owner: QA Team
slug: ${cleanSlug}
test_cases: test-cases/${reqId}-${cleanSlug}.md
---

# ${reqId}: ${cleanTitle}

- **Status**: Draft
- **Owner**: QA Team
- **Version**: 1.0
- **Risk**: High
- **Related pages/modules**: \`/${cleanSlug}\`
- **Source**: Product requirement
- **Page exposure**: ${pageExposure}
- **UI coverage**: ${uiCoverage}
- **XSS applicability**: ${xssApplicability}

## Business goal

Đảm bảo tính năng ${cleanTitle} hoạt động chính xác về mặt nghiệp vụ, bền vững trạng thái sau khi tải lại trang, an toàn trước thao tác lặp/race condition, hiển thị nguyên vẹn trên đa kích thước màn hình và miễn nhiễm với các payload XSS/Injection.

## Coverage notes

| Aspect | Status | Notes |
|---|---|---|
| UI/UX Geometry | ${uiCoverage} | \`expectNoHorizontalScroll\`, \`expectNoTextOverflow\`, \`expectNotOccluded\`, \`expectInteractiveA11y\`, \`expectResponsiveIntegrity\` |
| XSS Security | ${xssApplicability} | \`expectSafeXssRender\` với \`XSS_PAYLOADS\` trên sink hiển thị |
| Idempotency | Required | \`expectIdempotentSubmit\` khóa nút hoặc chặn nhân bản mutation khi double-click |
| State Persistence | Required | \`expectStatePersistence\` kiểm chứng dữ liệu bền vững sau \`page.reload()\` |

## Acceptance criteria

### AC-001: Luồng thành công và bền vững trạng thái (Happy Path & State Persistence)

**Given** người dùng hợp lệ đang ở màn hình \`/${cleanSlug}\`
**When** thực hiện thao tác nghiệp vụ chính với dữ liệu chuẩn và tải lại trang (\`reload\`)
**Then** hệ thống cập nhật trạng thái thành công và giữ nguyên dữ liệu sau khi reload

### AC-002: Từ chối dữ liệu biên và định dạng không hợp lệ (Negative & Boundary Validation)

**Given** người dùng đang nhập liệu tại màn hình \`/${cleanSlug}\`
**When** gửi các giá trị biên hoặc sai định dạng (rỗng, quá dài, khoảng trắng, Unicode tràn)
**Then** hệ thống hiển thị thông báo lỗi rõ ràng và không phát sinh mutation request thành công

### AC-003: Chống gửi trùng khi thao tác liên tiếp (Idempotency & Race Condition Guard)

**Given** người dùng đã điền dữ liệu hợp lệ tại màn hình \`/${cleanSlug}\`
**When** nhấn liên tiếp vào nút hành động chính (double-submit / rapid click)
**Then** hệ thống chỉ phát sinh tối đa 1 mutation request và không tạo bản ghi trùng lặp

### AC-004: Toàn vẹn bố cục hình học và khả năng tiếp cận (UI Geometry & Interactive A11y)

**Given** màn hình \`/${cleanSlug}\` đã hiển thị đầy đủ
**When** kiểm tra hình học phần tử chính và cây Accessibility của các điều khiển tương tác
**Then** không có thanh cuộn ngang, không tràn/cắt chữ, không bị che khuất tâm điểm và có đủ accessible name

### AC-005: Tương thích đa kích thước màn hình (Responsive Integrity Across Viewports)

**Given** người dùng truy cập màn hình \`/${cleanSlug}\` trên Desktop, Tablet và Mobile
**When** thay đổi kích thước viewport qua các mốc chuẩn
**Then** các phần tử bắt buộc vẫn hiển thị, không tràn ngang hoặc chồng lấp

### AC-006: Hiển thị an toàn trước mã độc tiêm nhiễm (XSS Safe Sink Rendering)

**Given** người dùng nhập chuỗi chứa thẻ HTML/script vào trường văn bản tại \`/${cleanSlug}\`
**When** hệ thống xử lý và hiển thị lại dữ liệu trên giao diện
**Then** dữ liệu được escape dạng văn bản thuần, không kích hoạt dialog hay tạo phần tử thực thi

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| Rule 1 (Persistence) | Dữ liệu chuẩn | Mất state sau reload | Reload ngay sau lưu | Giữ nguyên state | TC-001 |
| Rule 2 (Boundary) | Trong ngưỡng cho phép | Rỗng / quá dài / ký tự lạ | Min-1, Max+1 | Báo lỗi & chặn gửi | TC-002 |
| Rule 3 (Idempotency) | 1 lần nhấn | Nhấn đúp < 50ms | 2-3 lần nhấn liên tiếp | Tối đa 1 mutation | TC-003 |
| Rule 4 (UI & A11y) | Hiển thị rõ, đủ label | Tràn chữ, thiếu label | Nội dung dài | Không lỗi geometry/a11y | TC-004 |
| Rule 5 (Responsive) | Desktop/Tablet/Mobile | Vỡ khung mobile | 375px - 1440px | Hiển thị nguyên vẹn | TC-005 |
| Rule 6 (XSS Safety) | Văn bản thuần | Payload \`<script>\` / \`onerror\` | Chuỗi chứa thẻ HTML | Escape an toàn | TC-006 |

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| Bộ 6 AC chuẩn Deep Bug Hunting cho ${cleanTitle} | Khởi tạo từ Deep Template Engine | High | Confirmed |

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | ${today} | Khởi tạo tài liệu chuẩn Deep Bug Hunting | AC-001..AC-006 | Full |
`;
}

function renderTestCaseTemplate({ reqId, slug, title, specRelPath }) {
  const cleanTitle = title || `Feature ${reqId}`;
  const cleanSlug = slug || 'feature';
  const cleanSpec = specRelPath || `playwright/tests/auth/${cleanSlug}.spec.ts`;

  return `# Test Cases: ${reqId} ${cleanTitle}

Requirement: \`requirements/${reqId}-${cleanSlug}.md\` (v1.0)

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| ${reqId} | AC-001 | TC-001 | Candidate | \`${cleanSpec}\` | P0 |
| ${reqId} | AC-002 | TC-002 | Candidate | \`${cleanSpec}\` | P1 |
| ${reqId} | AC-003 | TC-003 | Candidate | \`${cleanSpec}\` | P1 |
| ${reqId} | AC-004 | TC-004 | Candidate | \`${cleanSpec}\` | P1 |
| ${reqId} | AC-005 | TC-005 | Candidate | \`${cleanSpec}\` | P2 |
| ${reqId} | AC-006 | TC-006 | Candidate | \`${cleanSpec}\` | P1 |

> Lưu ý: Cập nhật Priority thật (P0/P1) và chuyển Automation thành Yes khi hoàn thiện test.

## Case không automation

| Test case | Lý do | Cách bù đắp |
|---|---|---|

## Test cases

### TC-001: Kiểm chứng luồng chính và bền vững trạng thái sau reload cho ${cleanTitle}

- **Type**: Functional | **Priority**: P0 | **Technique**: State Transition
- **Automation**: Candidate | **Tags**: \`@wip @p0 @smoke\`
- **Capabilities**: persistence
- **Preconditions**: Người dùng hợp lệ và môi trường sẵn sàng

| Step | Action | Expected result |
|---|---|---|
| 1 | Điền dữ liệu hợp lệ và thực hiện thao tác chính | Hệ thống cập nhật thành công |
| 2 | Gọi \`expectStatePersistence\` tải lại trang | Trạng thái vẫn được bảo toàn sau reload |

### TC-002: Kiểm chứng từ chối giá trị biên và dữ liệu không hợp lệ cho ${cleanTitle}

- **Type**: Negative & Boundary | **Priority**: P1 | **Technique**: Boundary Value Analysis
- **Automation**: Candidate | **Tags**: \`@wip @p1\`
- **Capabilities**: boundary
- **Preconditions**: Màn hình nhập liệu sẵn sàng

| Step | Action | Expected result |
|---|---|---|
| 1 | Thử từng giá trị biên qua \`expectBoundaryRejected\` | Hiển thị lỗi và không gửi request thành công |

### TC-003: Kiểm chứng chống gửi trùng khi nhấn liên tiếp cho ${cleanTitle}

- **Type**: Concurrency & Idempotency | **Priority**: P1 | **Technique**: Race Condition Probe
- **Automation**: Candidate | **Tags**: \`@wip @p1\`
- **Capabilities**: idempotency
- **Preconditions**: Biểu mẫu đã điền dữ liệu hợp lệ

| Step | Action | Expected result |
|---|---|---|
| 1 | Kích hoạt \`expectIdempotentSubmit\` trên nút gửi | Tối đa 1 mutation request được gửi đi |

### TC-004: Kiểm chứng hình học giao diện và khả năng tiếp cận cho ${cleanTitle}

- **Type**: UI/UX & Accessibility | **Priority**: P1 | **Technique**: DOM Geometry & A11y Audit
- **Automation**: Candidate | **Tags**: \`@wip @p1\`
- **Capabilities**: ui-geometry, a11y
- **Preconditions**: Màn hình đã render ổn định

| Step | Action | Expected result |
|---|---|---|
| 1 | Chạy \`expectNoHorizontalScroll\`, \`expectNoTextOverflow\`, \`expectNotOccluded\`, \`expectInteractiveA11y\` | Không lỗi tràn ngang, cắt chữ, che khuất hoặc thiếu tên tiếp cận |

### TC-005: Kiểm chứng hiển thị đa kích thước màn hình cho ${cleanTitle}

- **Type**: Responsive UI | **Priority**: P2 | **Technique**: Multi-Viewport Matrix
- **Automation**: Candidate | **Tags**: \`@wip @p2\`
- **Capabilities**: responsive
- **Preconditions**: Màn hình đã render ổn định

| Step | Action | Expected result |
|---|---|---|
| 1 | Chạy \`expectResponsiveIntegrity\` qua Desktop/Tablet/Mobile | Các phần tử bắt buộc hiển thị nguyên vẹn |

### TC-006: Kiểm chứng chống thực thi XSS trên vùng hiển thị cho ${cleanTitle}

- **Type**: Security | **Priority**: P1 | **Technique**: Fault Injection (XSS)
- **Automation**: Candidate | **Tags**: \`@wip @p1\`
- **Capabilities**: xss
- **Preconditions**: Có trường nhập liệu phản chiếu lên giao diện

| Step | Action | Expected result |
|---|---|---|
| 1 | Chạy \`expectSafeXssRender\` với \`XSS_PAYLOADS\` | Không phát sinh dialog hay phần tử HTML độc hại |
`;
}

function renderSpecTemplate({ reqId, slug, title }) {
  const cleanTitle = title || `Feature ${reqId}`;
  const cleanSlug = slug || 'feature';

  return `import { test, expect } from '../fixtures/test-fixtures';
import {
  expectNoHorizontalScroll,
  expectNoTextOverflow,
  expectNotOccluded,
  expectInteractiveA11y,
  expectResponsiveIntegrity,
} from '../support/ui-checks';
import {
  expectIdempotentSubmit,
  expectSafeXssRender,
  expectStatePersistence,
  expectBoundaryRejected,
  XSS_PAYLOADS,
} from '../support/deep-guards';

/**
 * ${reqId} - ${cleanTitle}
 * Requirement : requirements/${reqId}-${cleanSlug}.md
 */
test.describe('${reqId} - ${cleanTitle}', { tag: '@${reqId}' }, () => {
  test.fixme(
    'TC-001 - AC-001 verify state persistence after reload',
    { tag: ['@wip', '@p0', '@smoke'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      await page.getByRole('button', { name: /save|submit|lưu/i }).click();
      await expectStatePersistence(page, async () => {
        await expect(page.getByRole('status')).toBeVisible();
      });
    },
  );

  test.fixme(
    'TC-002 - AC-002 verify boundary and invalid input rejection',
    { tag: ['@wip', '@p1'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      await expectBoundaryRejected(
        page,
        async () => {
          await page.getByRole('textbox').first().fill('');
          await page.getByRole('button', { name: /save|submit|lưu/i }).click();
        },
        page.getByRole('alert'),
        { mutationUrlPattern: '/api/${cleanSlug}' },
      );
    },
  );

  test.fixme(
    'TC-003 - AC-003 verify idempotent submit under rapid clicks',
    { tag: ['@wip', '@p1'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      await expectIdempotentSubmit(
        page,
        page.getByRole('button', { name: /save|submit|lưu/i }),
        '/api/${cleanSlug}',
        { methods: ['POST', 'PUT', 'PATCH'] },
      );
    },
  );

  test.fixme(
    'TC-004 - AC-004 verify UI geometry and interactive accessibility',
    { tag: ['@wip', '@p1'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      const mainRegion = page.locator('main, [role="main"], form').first();
      await expectNoHorizontalScroll(page);
      await expectNoTextOverflow(mainRegion);
      await expectNotOccluded(page.getByRole('button').first());
      await expectInteractiveA11y(mainRegion);
    },
  );

  test.fixme(
    'TC-005 - AC-005 verify responsive integrity across viewports',
    { tag: ['@wip', '@p2'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      await expectResponsiveIntegrity(page, {
        requiredLocators: [page.locator('main, [role="main"], form').first()],
        optionalLocators: [page.locator('aside, nav').first()],
      });
    },
  );

  test.fixme(
    'TC-006 - AC-006 verify safe XSS sink rendering',
    { tag: ['@wip', '@p1'] },
    async ({ page }) => {
      await page.goto('/${cleanSlug}');
      await expectSafeXssRender(
        page,
        async (payload) => {
          await page.getByRole('textbox').first().fill(payload);
          await page.getByRole('button', { name: /save|submit|lưu/i }).click();
        },
        {
          sinkLocator: page.locator('main, [role="main"]').first(),
          payloads: XSS_PAYLOADS.slice(0, 3),
        },
      );
    },
  );
});
`;
}

module.exports = {
  renderRequirementTemplate,
  renderTestCaseTemplate,
  renderSpecTemplate,
};
