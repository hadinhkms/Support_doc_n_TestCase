import { test, expect } from '../tests/fixtures/test-fixtures';
import {
  expectContainedIn,
  expectInteractiveA11y,
  expectNoHorizontalScroll,
  expectNotOccluded,
  expectNoTextOverflow,
  expectPairwiseNoOverlap,
  expectResponsiveIntegrity,
} from '../tests/support/ui-checks';

test.describe('Phase 2 - UI/UX Geometry & Accessibility Engine (HM-03, HM-04, HM-05)', () => {
  test('HM-03 - TC-14-P2-01 expectNoTextOverflow catches delayed 150ms text clipping and validates allowEllipsis', async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        #late-overflow { width: 70px; overflow: hidden; white-space: nowrap; }
        #ellipsis-ok { width: 70px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        #clean-text { width: 320px; }
      </style>
      <div id="late-overflow" data-testid="late-box">OK</div>
      <div id="ellipsis-ok" data-testid="ellipsis-box"> INTENTIONAL_ELLIPSIS_LONG_LABEL_TEXT </div>
      <div id="clean-text" data-testid="clean-box">Clean short text</div>
      <script>
        setTimeout(() => {
          const el = document.getElementById('late-overflow');
          if (el) el.textContent = 'DELAYED_SUPER_LONG_UNBROKEN_OVERFLOW_STRING_99999';
        }, 120);
      </script>
    `);

    let overflowError = '';
    try {
      await expectNoTextOverflow(page, '[data-testid="late-box"]', {
        settleMs: 160,
        timeout: 800,
      });
    } catch (err) {
      overflowError = String(err);
    }
    expect(overflowError).toMatch(/Phát hiện tràn chữ \(Text Overflow\)[\s\S]*late-overflow/);

    let emptySelectorError = '';
    try {
      await expectNoTextOverflow(page, '[data-testid="does-not-exist"]', {
        settleMs: 20,
        timeout: 600,
      });
    } catch (err) {
      emptySelectorError = String(err);
    }
    expect(emptySelectorError).toMatch(/Bắt buộc có ít nhất 1 phần tử hiển thị/);

    await expectNoTextOverflow(page, '[data-testid="ellipsis-box"]', {
      allowEllipsis: true,
      settleMs: 30,
    });
    await expectNoTextOverflow(page, '[data-testid="clean-box"]', { settleMs: 30 });
  });

  test('HM-04 - TC-14-P2-02 expectPairwiseNoOverlap catches 12x12px button collision and rejects hidden elements', async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        .stage { position: relative; width: 400px; height: 200px; }
        #btn-a { position: absolute; left: 20px; top: 20px; width: 100px; height: 40px; }
        #btn-b { position: absolute; left: 108px; top: 48px; width: 100px; height: 40px; }
        #btn-c { position: absolute; left: 240px; top: 20px; width: 100px; height: 40px; }
        #btn-hidden { display: none; }
      </style>
      <div class="stage">
        <button id="btn-a" data-testid="btn-a" type="button">Primary</button>
        <button id="btn-b" data-testid="btn-b" type="button">Colliding</button>
        <button id="btn-c" data-testid="btn-c" type="button">Separated</button>
        <button id="btn-hidden" data-testid="btn-hidden" type="button">Hidden</button>
      </div>
    `);

    let collisionError = '';
    try {
      await expectPairwiseNoOverlap(
        [page.getByTestId('btn-a'), page.getByTestId('btn-b')],
        { timeout: 350 },
      );
    } catch (err) {
      collisionError = String(err);
    }
    expect(collisionError).toMatch(/Phần tử #0 và #1 bị đè lên nhau \(overlap\)/);

    let hiddenElementError = '';
    try {
      await expectPairwiseNoOverlap(
        [page.getByTestId('btn-a'), page.getByTestId('btn-hidden')],
        { timeout: 350 },
      );
    } catch (err) {
      hiddenElementError = String(err);
    }
    expect(hiddenElementError).toMatch(/không hiển thị \(isVisible=false\) — expectPairwiseNoOverlap cấm bỏ qua âm thầm/);

    await expectPairwiseNoOverlap([page.getByTestId('btn-a'), page.getByTestId('btn-c')]);
  });

  test('HM-04 - TC-14-P2-03 expectNotOccluded and expectContainedIn catch sticky header occlusion and ancestor clipping', async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        body { margin: 0; padding: 0; }
        #sticky-header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 60px;
          background: rgba(0, 0, 0, 0.9);
          z-index: 999;
        }
        #occluded-btn {
          position: absolute;
          top: 15px;
          left: 20px;
          width: 120px;
          height: 36px;
        }
        #clip-ancestor {
          position: absolute;
          top: 100px;
          left: 20px;
          width: 90px;
          height: 40px;
          overflow: hidden;
        }
        #clipped-btn {
          width: 220px;
          height: 36px;
        }
        #safe-card {
          position: absolute;
          top: 170px;
          left: 20px;
          width: 260px;
          height: 80px;
          padding: 10px;
        }
        #safe-btn {
          width: 140px;
          height: 36px;
        }
      </style>
      <header id="sticky-header">Sticky Header</header>
      <button id="occluded-btn" data-testid="occluded-btn" type="button">Covered Action</button>
      <div id="clip-ancestor" data-testid="clip-ancestor">
        <button id="clipped-btn" data-testid="clipped-btn" type="button">Clipped By Ancestor</button>
      </div>
      <div id="safe-card" data-testid="safe-card">
        <button id="safe-btn" data-testid="safe-btn" type="button">Safe Action</button>
      </div>
    `);

    let occludedByHeaderError = '';
    try {
      await expectNotOccluded(page.getByTestId('occluded-btn'), {
        scrollIntoView: false,
        timeout: 350,
      });
    } catch (err) {
      occludedByHeaderError = String(err);
    }
    expect(occludedByHeaderError).toMatch(/bị che khuất bởi <header#sticky-header>/);

    let occludedByAncestorError = '';
    try {
      await expectNotOccluded(page.getByTestId('clipped-btn'), {
        scrollIntoView: false,
        timeout: 350,
      });
    } catch (err) {
      occludedByAncestorError = String(err);
    }
    expect(occludedByAncestorError).toMatch(/bị cắt khuất bởi khung nhìn hoặc tổ tiên/);

    let containmentError = '';
    try {
      await expectContainedIn(
        page.getByTestId('clipped-btn'),
        page.getByTestId('clip-ancestor'),
        1,
        { timeout: 350 },
      );
    } catch (err) {
      containmentError = String(err);
    }
    expect(containmentError).toMatch(/Phần tử con tràn khỏi khung cha|bị cắt bởi ancestor/);

    await expectNotOccluded(page.getByTestId('safe-btn'));
    await expectContainedIn(page.getByTestId('safe-btn'), page.getByTestId('safe-card'));
  });

  test('HM-05 - TC-14-P2-04 expectInteractiveA11y catches unlabeled icon button and passes when labeled', async ({
    page,
  }) => {
    await page.setContent(`
      <section data-testid="bad-a11y-zone">
        <button id="unlabeled-icon-btn" type="button">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
        </button>
      </section>
      <section data-testid="good-a11y-zone">
        <label for="search-input">Search query</label>
        <input id="search-input" type="text" />
        <button id="labeled-icon-btn" type="button" aria-label="Execute search">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /></svg>
        </button>
      </section>
    `);

    let a11yError = '';
    try {
      await expectInteractiveA11y(page.getByTestId('bad-a11y-zone'), { timeout: 350 });
    } catch (err) {
      a11yError = String(err);
    }
    expect(a11yError).toMatch(/<button#unlabeled-icon-btn> thiếu accessible label/);

    await expectInteractiveA11y(page.getByTestId('good-a11y-zone'));
  });

  test('HM-05 - TC-14-P2-05 expectResponsiveIntegrity catches 900px table overflow on 320px mobile and honors optionalLocators', async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        body { margin: 0; padding: 0; }
        table.rigid-table { width: 900px; border-collapse: collapse; }
      </style>
      <table class="rigid-table">
        <tr><td>Unresponsive 900px wide table cell</td></tr>
      </table>
    `);

    let responsiveOverflowError = '';
    try {
      await expectResponsiveIntegrity(page, { timeout: 800 });
    } catch (err) {
      responsiveOverflowError = String(err);
    }
    expect(responsiveOverflowError).toMatch(/\[mobile-320\] Trang bị tràn khung ngang/);

    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 12px; font-family: sans-serif; }
        .shell { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 480px; }
        .brand-banner { padding: 8px; background: #eee; }
        @media (max-width: 480px) {
          .brand-banner { display: none; }
        }
      </style>
      <main class="shell">
        <div class="brand-banner" data-testid="brand-banner">Desktop Brand Banner</div>
        <input data-testid="email-input" type="email" placeholder="Email" style="width: 100%; height: 36px;" />
        <button data-testid="submit-btn" type="button" style="width: 100%; height: 40px;">Sign In</button>
      </main>
    `);

    await expectResponsiveIntegrity(page, {
      requiredLocators: [page.getByTestId('email-input'), page.getByTestId('submit-btn')],
      optionalLocators: [page.getByTestId('brand-banner')],
    });
    await expectNoHorizontalScroll(page, 'post-responsive-restore');
  });
});
