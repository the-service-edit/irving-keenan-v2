(() => {
  document.documentElement.classList.add('js');
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile menu
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
      header.classList.toggle('is-scrolled', open || window.scrollY > 24);
      if (open) menu.querySelector('a')?.focus();
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); } });
    window.matchMedia('(min-width: 1240px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
  }

  // Filters: submit on change; keep drawer open on desktop
  document.querySelectorAll('[data-filters]').forEach((form) => {
    form.addEventListener('change', () => form.requestSubmit());
    // Static preview has no server: apply URL filters in the browser (no-op when the server already filtered)
    const q = new URLSearchParams(location.search);
    if (![...q.keys()].length) return;
    q.forEach((v, k) => { const el = form.elements[k]; if (el && v) el.value = v; });
    const cards = [...document.querySelectorAll('.card-grid .card')];
    let shown = 0;
    cards.forEach((c) => {
      const d = c.dataset; const price = Number(d.price) || 0;
      const ok = (!q.get('suburb') || d.suburb === q.get('suburb')) && (!q.get('type') || d.type === q.get('type'))
        && (!q.get('beds') || Number(d.beds) >= Number(q.get('beds')))
        && (!q.get('min') || (price && price >= Number(q.get('min')))) && (!q.get('max') || (price && price <= Number(q.get('max'))))
        && (q.get('status') !== 'open' || d.open === '1') && (q.get('status') !== 'available' || d.status === 'available');
      c.hidden = !ok; if (ok) shown += 1;
    });
    const count = document.querySelector('.results-count');
    if (count) count.textContent = `${shown} ${shown === 1 ? 'property' : 'properties'}`;
    if (!shown && cards.length) {
      const p = document.createElement('div'); p.className = 'empty';
      p.innerHTML = '<p class="h3">No properties match those filters.</p><p class="muted">Try another suburb, or contact us and we will let you know when something suitable comes up.</p>';
      count?.after(p);
    }
  });

  // Deferred map (privacy: Google only loads on request)
  document.querySelectorAll('[data-map]').forEach((box) => {
    box.querySelector('[data-load-map]')?.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = box.dataset.src.replace(/&amp;/g, '&');
      f.title = 'Map';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      box.replaceChildren(f);
      box.classList.add('is-loaded');
      f.focus();
    });
  });

  // Form helpers (shared with apply-start.js)
  window.IK = window.IK || {};
  IK.showErrors = (form, errors) => {
    form.querySelectorAll('.error').forEach((e) => { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    let first = null;
    Object.entries(errors || {}).forEach(([name, msg]) => {
      const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!input) return;
      input.setAttribute('aria-invalid', 'true');
      const err = document.getElementById(`${input.id}-err`);
      if (err) { err.textContent = msg; err.hidden = false; }
      first = first || input;
    });
    first?.focus();
  };
  IK.formData = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = v; });
    form.querySelectorAll('input[type=checkbox]').forEach((c) => { o[c.name] = c.checked; });
    return o;
  };
  IK.post = async (url, body, extraHeaders = {}) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body), credentials: 'same-origin' });
    let data = {};
    try { data = await r.json(); } catch { /* ignore */ }
    return { ok: r.ok, status: r.status, data };
  };

  document.querySelectorAll('[data-enquiry]').forEach((form) => {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true; status.className = 'form-status'; status.textContent = '';
      const { ok, data } = await IK.post('/api/enquiry', IK.formData(form)).catch(() => ({ ok: false, data: {} }));
      btn.disabled = false;
      if (ok) {
        IK.showErrors(form, {});
        form.reset();
        status.textContent = data.emailDelivered ? 'Thanks, we’ve received your message and will be in touch soon.' : 'Thanks, your message has been saved for our team. (Email notifications are not switched on in this preview.)';
      } else if (data.errors) {
        IK.showErrors(form, data.errors);
      } else {
        status.classList.add('is-error');
        status.textContent = data.error || 'Sorry, something went wrong. Please try again or call us.';
      }
    });
  });
})();
