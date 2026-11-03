/**
 * Trang tham chiếu tổng hợp cho visual-accessibility.spec.ts (PLAN-16 Phase 3). Dữ liệu giả lập,
 * không phụ thuộc mạng/font web. Mỗi variant lỗi là một lỗi cài cố ý, đúng một nguyên nhân.
 */
export type CardVariant = 'good' | 'shifted' | 'price';

export function checkoutCard(variant: CardVariant, stamp: string): string {
  const price = variant === 'price' ? '18.00' : '17.00';
  const shift = variant === 'shifted' ? 'margin-left:12px;' : '';
  return `<!doctype html><html><body style="margin:0;font-family:Arial,sans-serif;background:#fff">
  <section data-testid="card" style="width:320px;padding:16px;border:1px solid #333;margin:16px">
    <h2 style="margin:0 0 8px;font-size:18px">Order summary</h2>
    <p style="margin:0 0 8px">Total: <strong data-testid="total">${price} USD</strong></p>
    <p data-testid="timestamp" style="margin:0 0 12px;color:#555">Updated ${stamp}</p>
    <button style="${shift}padding:8px 16px;background:#0b5;color:#fff;border:0">Pay now</button>
  </section></body></html>`;
}

export type A11yVariant =
  | 'good'
  | 'no-trap'
  | 'no-restore'
  | 'no-escape'
  | 'no-live'
  | 'late-live'
  | 'unassociated'
  | 'unlabeled'
  | 'wide';

export function a11yPage(variant: A11yVariant): string {
  const v = JSON.stringify(variant);
  const live = variant === 'late-live' ? '' : '<div id="live" role="alert"></div>';
  const icon = variant === 'unlabeled' ? '<button id="icon"><svg width="12" height="12"></svg></button>' : '<button id="icon" aria-label="Help"><svg width="12" height="12"></svg></button>';
  const width = variant === 'wide' ? 'width:900px;' : 'max-width:100%;';
  return `<!doctype html><html lang="en"><head><title>Reference account form</title></head>
  <body style="font-family:Arial,sans-serif"><main style="${width}">
    <h1>Account</h1>
    <button id="open" data-testid="open">Edit profile</button> ${icon}
    <div id="dlg" data-testid="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" hidden>
      <h2 id="dlg-title">Edit profile</h2>
      <label for="nick">Nickname</label> <input id="nick">
      <button id="save">Save</button> <button id="cancel">Cancel</button>
    </div>
    <form id="form" novalidate>
      <label for="email">Email</label>
      <input id="email" name="email" data-testid="email" ${variant === 'unassociated' ? '' : 'aria-describedby="email-err"'}>
      <span id="email-err"></span>
      <button id="submit" data-testid="submit" type="submit">Create account</button>
    </form>
    ${live}
  </main>
  <script>(() => {
    // IIFE: setContent dùng document.write, const top-level của trang trước vẫn còn trong realm.
    const variant = ${v};
    const dlg = document.getElementById('dlg'), open = document.getElementById('open');
    const inDlg = () => [...dlg.querySelectorAll('input,button')];
    open.addEventListener('click', () => { dlg.hidden = false; inDlg()[0].focus(); });
    const close = () => { dlg.hidden = true; if (variant !== 'no-restore') open.focus(); };
    document.getElementById('cancel').addEventListener('click', close);
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && variant !== 'no-escape') { close(); return; }
      if (e.key !== 'Tab' || variant === 'no-trap') return;
      const f = inDlg(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.getElementById('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email');
      if (email.value) return;
      email.setAttribute('aria-invalid', 'true');
      document.getElementById('email-err').textContent = 'Enter an email address';
      if (variant === 'late-live') {
        const r = document.createElement('div'); r.setAttribute('role', 'alert'); r.textContent = 'Fix 1 error'; document.body.append(r);
      } else if (variant !== 'no-live') { document.getElementById('live').textContent = 'Fix 1 error'; }
      email.focus();
    });
  })();</script></body></html>`;
}
