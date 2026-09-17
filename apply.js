/* Irving & Keenan, digital rental application (applicant side).
   All data lives on the server; nothing sensitive is written to browser storage. */
(() => {
  const root = document.querySelector('[data-app]');
  if (!root) return;

  const S = { state: null, step: null, data: {}, saving: null, savedAt: null, dirty: false, timer: null };
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `$${Number(n).toLocaleString('en-AU')}`;
  const ICON = {
    check: '<svg class="i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    arrowL: '<svg class="i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    upload: '<svg class="i" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    doc: '<svg class="i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>',
    lock: '<svg class="i" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };

  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); let t = o; ks.slice(0, -1).forEach((k) => { if (typeof t[k] !== 'object' || t[k] === null || Array.isArray(t[k])) t[k] = {}; t = t[k]; }); t[ks.at(-1)] = v; };
  const visible = (f, d) => { if (!f.when) return true; const v = get(d, f.when[0]); return Array.isArray(f.when[1]) ? f.when[1].includes(v) : v === f.when[1]; };
  const optVal = (o) => (Array.isArray(o) ? o[0] : o);
  const optLabel = (o) => (Array.isArray(o) ? o[1] : o);
  const fid = (name) => `q-${name.replace(/[^\w-]/g, '-')}`;

  async function api(method, url, body, isForm = false) {
    if (window.IK_DEMO) {
      const d = await window.IK_DEMO.api(method, url, body);
      if (d.status === 401) { renderSessionEnded(d.data.error); throw new Error('unauthenticated'); }
      return d;
    }
    const headers = { 'X-CSRF-Token': S.state?.csrf || '' };
    if (!isForm && body) headers['Content-Type'] = 'application/json';
    const r = await fetch(url, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let data = {};
    try { data = await r.json(); } catch { /* empty */ }
    if (r.status === 401) { renderSessionEnded(data.error); throw new Error('unauthenticated'); }
    return { ok: r.ok, status: r.status, data };
  }

  async function load() {
    const r = await api('GET', '/api/apply/state').catch(() => null);
    if (!r) return;
    if (!r.ok) return renderSessionEnded(r.data.error);
    S.state = r.data;
    route();
  }

  // ── Routing ────────────────────────────────────────────────────────────
  const steps = () => S.state.steps;
  const stepIndex = (id) => steps().findIndex((s) => s.id === id);
  function firstIncomplete() {
    return steps().find((s) => !S.state.progress[s.id] && s.id !== 'review' && s.id !== 'declaration')?.id || 'review';
  }
  function route() {
    const st = S.state;
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    const app = st.application;
    const locked = !app.editable || (st.me.signed && app.status !== 'info_requested');
    if (hash === 'status' || (locked && !hash.startsWith('view-'))) return renderStatus();
    if (hash === 'welcome' || (!hash && new URLSearchParams(location.search).has('welcome') && !Object.values(st.progress).some(Boolean))) return renderWelcome();
    const id = hash.startsWith('step-') ? hash.slice(5) : firstIncomplete();
    if (stepIndex(id) < 0) return go(firstIncomplete());
    renderStep(id);
  }
  function go(id) {
    const target = id === 'status' || id === 'welcome' ? id : `step-${id}`;
    if (location.hash !== `#${target}`) location.hash = target; else route();
  }
  window.addEventListener('hashchange', async () => { await flush(); route(); });

  // ── Shell ─────────────────────────────────────────────────────────────
  function shell(inner, { showSteps = true } = {}) {
    const st = S.state; const l = st.application.listing;
    const done = steps().filter((s) => st.progress[s.id]).length;
    const pct = Math.round((done / steps().length) * 100);
    root.innerHTML = `
<div class="app-top"><div class="wrap app-top-inner">
  <div class="app-prop"><div class="app-prop-thumb"><img src="https://i0.wp.com/irvingandkeenan.com.au/wp-content/uploads/${esc(l.image)}?w=240" alt="" width="64" height="48"></div>
  <div><p class="app-prop-addr">${esc(l.street)}, ${esc(l.suburb)}</p><p class="app-prop-meta">${money(l.rentWeekly)} per week · Ref ${esc(st.application.ref)}${l.propertyManager ? ` · ${esc(l.propertyManager.name)}` : ''}</p></div></div>
  <div class="app-save" aria-live="polite" data-save-status>${S.savedAt ? `Saved ${S.savedAt}` : ''}</div>
</div></div>
<div class="wrap app-body ${showSteps ? '' : 'app-body-single'}">
  ${showSteps ? `<nav class="app-steps" aria-label="Application steps">
    <div class="app-progress"><div class="app-progress-bar" data-pct="${pct}"></div></div>
    <p class="app-progress-label">${done} of ${steps().length} sections complete</p>
    <details class="app-steps-toggle" ${window.matchMedia('(min-width: 900px)').matches ? 'open' : ''}><summary>All sections</summary>
    <ol>${steps().map((s, i) => `<li><a href="#step-${s.id}" ${S.step === s.id ? 'aria-current="step"' : ''} class="${st.progress[s.id] ? 'is-done' : ''}"><span class="app-step-n">${st.progress[s.id] ? ICON.check : i + 1}</span>${esc(s.title)}${st.progress[s.id] ? '<span class="visually-hidden"> (complete)</span>' : ''}</a></li>`).join('')}</ol>
    </details>
    <div class="app-side-links"><a href="#status">Application status</a><button type="button" class="btn-link" data-signout>Save and sign out</button></div>
  </nav>` : ''}
  <div class="app-main">${inner}</div>
</div>`;
    root.querySelector('[data-signout]')?.addEventListener('click', signOut);
    const bar = root.querySelector('.app-progress-bar'); if (bar) bar.style.width = `${bar.dataset.pct}%`; // CSSOM, allowed by CSP
  }

  function setSaveStatus(text) {
    const el = $('[data-save-status]');
    if (el) el.textContent = text;
  }

  async function signOut() {
    await flush();
    await api('POST', '/api/apply/logout', {}).catch(() => {});
    if (window.IK_DEMO) { location.hash = ''; location.reload(); return; }
    root.innerHTML = `<div class="wrap narrow app-card app-done"><h1 class="h2">You’re signed out</h1><p>Your application is saved. Use the link in your email to continue on any device.</p><p><a class="btn btn-dark" href="/apply/resume">Email me a new link</a></p></div>`;
  }

  function renderSessionEnded(msg) {
    root.innerHTML = `<div class="wrap narrow app-card"><h1 class="h2">Please use your personal link</h1><p>${esc(msg || 'Your session has ended.')}</p><p>Your application is saved. We can email you a new link.</p><p><a class="btn btn-dark" href="/apply/resume">Email me a link</a></p></div>`;
  }

  // ── Welcome ───────────────────────────────────────────────────────────
  function renderWelcome() {
    const st = S.state; S.step = null;
    const lead = st.role === 'lead';
    const inviter = st.others.find((o) => o.isLead);
    shell(`<div class="app-card">
<p class="label">${lead ? 'Application started' : 'Joint application'}</p>
<h1 class="app-h1" tabindex="-1">Hi ${esc(st.me.firstName)}, let’s get your application done.</h1>
${lead ? '' : `<p>${esc(inviter?.firstName || 'The lead applicant')} added you to this application. Your details and documents stay private. Other applicants only see whether your part is complete.</p>`}
${st.emailDelivered ? `<p>We’ve emailed you a private link so you can come back any time.</p>` : `<p class="notice">${ICON.lock}<span>In this preview, emails aren’t sent. Your progress still saves as you go while you’re signed in.</span></p>`}
<h2 class="h4">You’ll need</h2>
<ul class="app-need">
<li>Photo ID: driver’s licence or passport</li>
<li>Proof of income, such as recent payslips or a Centrelink statement</li>
<li>Contact details for your current landlord or agent, and your employer</li>
<li>Details for one or two personal referees</li>
${lead ? '<li>Names and emails for any other adults who will live with you</li>' : ''}
</ul>
<p class="muted">It usually takes about 15 minutes. Everything saves automatically.</p>
<button class="btn btn-brand" type="button" data-begin>Let’s go</button>
</div>`);
    $('[data-begin]').addEventListener('click', () => go(firstIncomplete()));
    $('.app-h1').focus();
  }

  // ── Field rendering ───────────────────────────────────────────────────
  function describedBy(f, id) { return `${f.help ? `${id}-help ` : ''}${id}-err`; }

  function renderField(f, data, prefix = '') {
    if (f.heading) return `<h3 class="app-subhead" data-when='${f.when ? esc(JSON.stringify(f.when)) : ''}' ${visible(f, data) ? '' : 'hidden'}>${esc(f.heading)}</h3>`;
    const name = prefix + f.name;
    const id = fid(name);
    const value = get(data, name) ?? (prefix ? undefined : undefined);
    const cls = `field${f.half ? ' half' : ''}${f.quarter ? ' quarter' : ''}`;
    const whenAttr = f.when && !prefix ? ` data-when='${esc(JSON.stringify(f.when))}'` : '';
    const hidden = !prefix && !visible(f, data) ? ' hidden' : '';
    const req = f.required ? ' required aria-required="true"' : '';
    const help = f.help ? `<p class="help" id="${id}-help">${esc(f.help)}</p>` : '';
    const err = `<p class="error" id="${id}-err" hidden></p>`;
    const optional = f.required || f.type === 'checkbox' ? '' : (/\(optional\)/i.test(f.label) ? '' : ' <span class="optional">(optional)</span>');
    const locked = f.locked ? ' readonly aria-readonly="true"' : '';

    if (f.type === 'radio' || f.type === 'checkboxes') {
      const vals = f.type === 'checkboxes' ? (Array.isArray(value) ? value : []) : [value];
      return `<fieldset class="${cls} choice" id="${id}" data-name="${esc(name)}" data-type="${f.type}"${whenAttr}${hidden} aria-describedby="${describedBy(f, id)}">
<legend>${esc(f.label)}${optional}</legend>${help}
<div class="choices">${f.options.map((o, i) => `<label class="choice-item"><input type="${f.type === 'radio' ? 'radio' : 'checkbox'}" name="${esc(name)}" value="${esc(optVal(o))}" ${vals.includes(optVal(o)) ? 'checked' : ''} ${i === 0 ? `id="${id}-first"` : ''}><span>${esc(optLabel(o))}</span></label>`).join('')}</div>${err}</fieldset>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="${cls} check"${whenAttr}${hidden}><input type="checkbox" id="${id}" name="${esc(name)}" data-name="${esc(name)}" data-type="checkbox" ${value === true ? 'checked' : ''}${req} aria-describedby="${describedBy(f, id)}"><label for="${id}">${esc(f.label)}</label>${help}${err}</div>`;
    }
    if (f.type === 'list') {
      const items = Array.isArray(value) && value.length ? value : Array.from({ length: f.min || 0 }, () => ({}));
      return `<div class="${cls} app-list" data-list="${esc(name)}" id="${id}"${whenAttr}${hidden} tabindex="-1">
<p class="app-list-label">${esc(f.label)}</p>${err}
<div data-list-items>${items.map((item, i) => listItemScoped(f, item, i)).join('')}</div>
<button type="button" class="btn btn-ghost btn-sm" data-add-item ${items.length >= f.max ? 'hidden' : ''}>+ Add ${esc(f.itemLabel.toLowerCase())}</button></div>`;
    }
    let control;
    const common = `id="${id}" name="${esc(name)}" data-name="${esc(name)}" data-type="${f.type}"${req}${locked} aria-describedby="${describedBy(f, id)}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ''}`;
    if (f.type === 'select') control = `<select ${common}><option value="">Choose…</option>${f.options.map((o) => `<option value="${esc(optVal(o))}" ${String(value ?? '') === optVal(o) ? 'selected' : ''}>${esc(optLabel(o))}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') control = `<textarea ${common} rows="4" maxlength="${f.max || 1000}">${esc(value ?? '')}</textarea>`;
    else {
      const t = { money: 'text', number: 'number', tel: 'tel', email: 'email', date: 'date', month: 'month' }[f.type] || 'text';
      const extra = f.type === 'money' ? ' inputmode="decimal"' : f.type === 'number' ? ` inputmode="numeric" min="${f.min ?? ''}" max="${f.max ?? ''}"` : f.inputmode ? ` inputmode="${f.inputmode}"` : '';
      control = `${f.type === 'money' ? '<div class="prefix"><span aria-hidden="true">$</span>' : ''}<input type="${t}" ${common} value="${esc(value ?? '')}"${f.max && t === 'text' ? ` maxlength="${f.max}"` : ''}${extra}>${f.type === 'money' ? '</div>' : ''}`;
    }
    return `<div class="${cls}"${whenAttr}${hidden}><label for="${id}">${esc(f.label)}${optional}${f.locked ? ` <span class="optional">${ICON.lock} from your link</span>` : ''}</label>${help}${control}${err}</div>`;
  }

  // Build list item fields with names scoped to the list path.
  function scopedListField(sf, name, i) { return { ...sf, name: `${name}.${i}.${sf.name}` }; }

  function readForm(form, step) {
    const out = {};
    const fields = step.fields;
    const walk = (fs) => fs.forEach((f) => {
      if (!f.name) return;
      if (f.type === 'list') {
        const wrap = form.querySelector(`[data-list="${CSS.escape(f.name)}"]`);
        const arr = [];
        wrap?.querySelectorAll('[data-item]').forEach((itemEl, i) => {
          const o = {};
          f.fields.forEach((sf) => { const el = itemEl.querySelector(`[data-name="${CSS.escape(`${f.name}.${i}.${sf.name}`)}"]`); if (el) o[sf.name] = el.value.trim(); });
          arr.push(o);
        });
        set(out, f.name, arr);
        return;
      }
      const el = form.querySelector(`[data-name="${CSS.escape(f.name)}"]`);
      if (!el) return;
      if (f.type === 'radio') { const c = el.querySelector('input:checked'); set(out, f.name, c ? c.value : ''); }
      else if (f.type === 'checkboxes') set(out, f.name, [...el.querySelectorAll('input:checked')].map((c) => c.value));
      else if (f.type === 'checkbox') set(out, f.name, el.checked);
      else set(out, f.name, el.value.trim());
    });
    walk(fields);
    return out;
  }

  function applyVisibility(form, step) {
    const d = readForm(form, step);
    form.querySelectorAll('[data-when]').forEach((el) => {
      const w = el.getAttribute('data-when');
      if (!w) return;
      const [dep, val] = JSON.parse(w);
      const v = get(d, dep);
      el.hidden = !(Array.isArray(val) ? val.includes(v) : v === val);
    });
  }

  function showErrors(form, errors) {
    form.querySelectorAll('.error').forEach((e) => { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    const summary = form.querySelector('[data-error-summary]');
    const entries = Object.entries(errors || {});
    if (!entries.length) { summary.hidden = true; return; }
    const links = [];
    entries.forEach(([name, msg]) => {
      const id = fid(name);
      const errEl = document.getElementById(`${id}-err`);
      const input = document.getElementById(`${id}-first`) || document.getElementById(id);
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
      if (input) input.setAttribute('aria-invalid', 'true');
      const labelText = form.querySelector(`label[for="${id}"]`)?.textContent || form.querySelector(`#${CSS.escape(id)} legend`)?.textContent || form.querySelector(`#${CSS.escape(id)} .app-list-label`)?.textContent || '';
      const label = labelText.replace(/\(optional\)|from your link/g, '').trim().replace(/:$/, '');
      const generic = /required|Choose one of the options/.test(msg);
      const text = !label ? msg : generic ? `${label.replace(/\?$/, '')}${/\?$/.test(label) ? '?' : ''}: ${/Choose/.test(msg) ? 'choose an answer' : 'required'}` : `${label.replace(/\?$/, '')}: ${msg}`;
      links.push(`<li><a href="#${id}" data-focus="${id}">${esc(text)}</a></li>`);
    });
    summary.innerHTML = `<h2 class="h4">There ${entries.length === 1 ? 'is 1 thing' : `are ${entries.length} things`} to fix</h2><ul>${links.join('')}</ul>`;
    summary.hidden = false;
    summary.focus();
    summary.querySelectorAll('[data-focus]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.focus) || document.getElementById(`${a.dataset.focus}-first`);
      t?.scrollIntoView({ block: 'center' });
      (t?.matches('fieldset') ? t.querySelector('input') : t)?.focus();
    }));
  }

  // ── Autosave ──────────────────────────────────────────────────────────
  function queueSave(form, step) {
    S.dirty = true;
    setSaveStatus('Saving…');
    clearTimeout(S.timer);
    S.timer = setTimeout(() => save(form, step), 700);
  }
  async function save(form, step) {
    if (!S.dirty) return;
    S.dirty = false;
    const data = readForm(form, step);
    S.saving = api('PATCH', `/api/apply/step/${step.id}`, { data }).then((r) => {
      if (r.ok) { S.savedAt = new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); setSaveStatus(`Saved ${S.savedAt}`); }
      else setSaveStatus(r.data.error || 'Couldn’t save. Check your connection.');
    }).catch(() => setSaveStatus('Couldn’t save. Check your connection.'));
    await S.saving;
  }
  let flushTarget = null;
  async function flush() {
    if (flushTarget && S.dirty) { clearTimeout(S.timer); await save(flushTarget.form, flushTarget.step); }
    if (S.saving) await S.saving;
  }
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ── Step screens ──────────────────────────────────────────────────────
  function stepHeader(step) {
    const i = stepIndex(step.id);
    return `<p class="app-count">Step ${i + 1} of ${steps().length}</p><h1 class="app-h1" tabindex="-1">${esc(step.title)}</h1>${step.intro ? `<p class="app-intro">${esc(step.intro)}</p>` : ''}`;
  }
  function navButtons(step, { continueLabel = 'Save and continue' } = {}) {
    const i = stepIndex(step.id);
    return `<div class="app-nav">${i > 0 ? `<a class="btn btn-ghost" href="#step-${steps()[i - 1].id}">${ICON.arrowL} Back</a>` : '<span></span>'}<button class="btn btn-dark" type="submit">${continueLabel}</button></div>`;
  }
  const nextId = (step) => steps()[stepIndex(step.id) + 1]?.id;

  function renderStep(id) {
    const step = steps().find((s) => s.id === id);
    S.step = id;
    if (step.scope === 'invites') return renderInvites(step);
    if (step.scope === 'documents') return renderDocuments(step);
    if (step.scope === 'review') return renderReview(step);
    if (step.scope === 'declaration') return renderDeclaration(step);
    const data = step.scope === 'application' ? (S.state.application.tenancy || {}) : S.state.me.data;
    const listing = S.state.application.listing;
    let extra = '';
    if (id === 'property') extra = `<div class="app-summary-card"><p><strong>${esc(listing.address)}</strong></p><p class="muted">Rent ${money(listing.rentWeekly)} per week, as advertised${listing.availableFrom ? ` · Available ${new Date(`${listing.availableFrom}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</p><p class="small muted">Under WA law we can’t invite or accept offers above the advertised rent.</p></div>`;
    shell(`<form class="app-card form" novalidate data-step-form>
${stepHeader(step)}
<div class="error-summary" role="alert" tabindex="-1" data-error-summary hidden></div>
${extra}
<div class="form-grid">${step.fields.map((f) => renderField(f, data)).join('')}</div>
${navButtons(step)}
</form>`);
    const form = $('[data-step-form]');
    flushTarget = { form, step };
    form.addEventListener('input', () => { applyVisibility(form, step); queueSave(form, step); });
    form.addEventListener('change', () => { applyVisibility(form, step); queueSave(form, step); });
    // List add/remove
    form.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add-item]');
      const rem = e.target.closest('[data-remove-item]');
      if (!add && !rem) return;
      const wrap = e.target.closest('[data-list]');
      const f = step.fields.find((x) => x.name === wrap.dataset.list);
      const current = get(readForm(form, step), f.name) || [];
      if (add) current.push({});
      if (rem) current.splice(Number(rem.dataset.removeItem), 1);
      wrap.querySelector('[data-list-items]').innerHTML = current.map((item, i) => listItemScoped(f, item, i)).join('');
      wrap.querySelector('[data-add-item]').hidden = current.length >= f.max;
      const focusEl = add ? wrap.querySelector(`[data-item="${current.length - 1}"] input, [data-item="${current.length - 1}"] select`) : wrap;
      focusEl?.focus();
      queueSave(form, step);
    });
    // Re-render lists with correctly scoped names
    form.querySelectorAll('[data-list]').forEach((wrap) => {
      const f = step.fields.find((x) => x.name === wrap.dataset.list);
      const items = get(data, f.name);
      const arr = Array.isArray(items) && items.length ? items : Array.from({ length: f.min || 0 }, () => ({}));
      wrap.querySelector('[data-list-items]').innerHTML = arr.map((item, i) => listItemScoped(f, item, i)).join('');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearTimeout(S.timer); S.dirty = false;
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const payload = readForm(form, step);
      const r = await api('POST', `/api/apply/step/${step.id}/complete`, { data: payload }).catch(() => null);
      btn.disabled = false;
      if (!r) return setSaveStatus('Couldn’t save. Check your connection.');
      if (r.status === 422) {
        mergeLocal(step, payload);
        S.state.progress[step.id] = false;
        return showErrors(form, r.data.errors);
      }
      if (!r.ok) return showErrors(form, { _: r.data.error || 'Something went wrong.' });
      mergeLocal(step, payload);
      S.state.progress = r.data.progress;
      S.savedAt = new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      go(nextId(step) || 'review');
    });
    $('.app-h1').focus();
  }

  function listItemScoped(f, item, i) {
    const name = f.name;
    const fields = f.fields.map((sf) => renderField(scopedListField(sf, name, i), buildScoped(name, i, item)));
    return `<fieldset class="app-list-item" data-item="${i}"><legend>${esc(f.itemLabel)} ${i + 1}</legend><div class="form-grid">${fields.join('')}</div>
${i >= (f.min || 0) ? `<button type="button" class="btn-link small" data-remove-item="${i}">Remove ${esc(f.itemLabel.toLowerCase())} ${i + 1}</button>` : ''}</fieldset>`;
  }
  function buildScoped(name, i, item) { const o = {}; set(o, `${name}.${i}`, item); return o; }

  function mergeLocal(step, payload) {
    const deep = (a, b) => { const out = { ...(a || {}) }; Object.entries(b || {}).forEach(([k, v]) => { out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deep(out[k], v) : v; }); return out; };
    if (step.scope === 'application') S.state.application.tenancy = deep(S.state.application.tenancy, payload);
    else S.state.me.data = deep(S.state.me.data, payload);
  }

  // Invites
  function renderInvites(step) {
    const st = S.state;
    const adults = Number(st.application.tenancy?.adults || 1);
    const others = st.others;
    shell(`<div class="app-card">
${stepHeader(step)}
<div class="error-summary" role="alert" tabindex="-1" data-error-summary hidden></div>
<p class="app-summary-card">You told us <strong>${adults} adult${adults === 1 ? '' : 's'}</strong> will live at the property${adults > 1 ? `, so we need ${adults - 1} more applicant${adults - 1 === 1 ? '' : 's'}` : '. That’s just you, so you can skip this step'}. <a href="#step-property">Change</a></p>
<ul class="app-people">${others.length ? others.map((o) => `<li><div><strong>${esc(o.firstName)} ${esc(o.lastName || '')}</strong><br><span class="status-pill st-${o.status}">${o.status === 'complete' ? 'Complete and signed' : o.status === 'invited' ? 'Invited, not started' : 'In progress'}</span></div>
<div class="app-people-actions">${o.status !== 'complete' && st.application.editable ? `<button class="btn-link small" type="button" data-resend="${o.id}">Resend invite</button><button class="btn-link small" type="button" data-remove="${o.id}" data-name="${esc(o.firstName)}">Remove</button>` : ''}</div></li>`).join('') : '<li class="muted">No one added yet.</li>'}</ul>
<form class="form app-invite" novalidate data-invite-form>
<h2 class="h4">Add an adult applicant</h2>
<p class="muted small">They’ll get an email with a private link. Each person needs their own email address.</p>
<div class="form-grid">
<div class="field half"><label for="q-inv-first">First name</label><input id="q-inv-first" name="firstName" autocomplete="off" aria-describedby="q-inv-first-err"><p class="error" id="q-inv-first-err" hidden></p></div>
<div class="field half"><label for="q-inv-last">Last name</label><input id="q-inv-last" name="lastName" autocomplete="off" aria-describedby="q-inv-last-err"><p class="error" id="q-inv-last-err" hidden></p></div>
<div class="field"><label for="q-inv-email">Email</label><input id="q-inv-email" name="email" type="email" autocomplete="off" aria-describedby="q-inv-email-err"><p class="error" id="q-inv-email-err" hidden></p></div>
</div>
<button class="btn btn-ghost" type="submit">Send invite</button>
<div class="form-status" role="status" aria-live="polite"></div>
</form>
<form data-step-form novalidate><div class="error-summary" role="alert" tabindex="-1" data-error-summary hidden></div>${navButtons(step, { continueLabel: 'Continue' })}</form>
</div>`);
    const invite = $('[data-invite-form]');
    invite.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(invite));
      const r = await api('POST', '/api/apply/invites', d);
      const map = { firstName: 'inv-first', lastName: 'inv-last', email: 'inv-email' };
      invite.querySelectorAll('.error').forEach((x) => { x.hidden = true; });
      if (r.status === 422 && r.data.errors) {
        Object.entries(r.data.errors).forEach(([k, m]) => { const el = $(`#q-${map[k]}-err`); el.textContent = m; el.hidden = false; $(`#q-${map[k]}`).setAttribute('aria-invalid', 'true'); });
        return invite.querySelector('[aria-invalid]')?.focus();
      }
      const status = invite.querySelector('.form-status');
      if (!r.ok) { status.className = 'form-status is-error'; status.textContent = r.data.error; return; }
      await refresh();
      renderInvites(step);
      const s2 = $('[data-invite-form] .form-status');
      s2.textContent = `Invite ${r.data.emailDelivered ? 'sent' : 'created (email sending is switched off in this preview)'} for ${d.firstName}.`;
      s2.focus?.();
    });
    root.querySelectorAll('[data-resend]').forEach((b) => b.addEventListener('click', async () => {
      const r = await api('POST', `/api/apply/invites/${b.dataset.resend}/resend`, {});
      b.textContent = r.ok ? (r.data.emailDelivered ? 'Invite resent' : 'Re-issued (email off)') : 'Couldn’t resend';
    }));
    root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm(`Remove ${b.dataset.name} from this application? Anything they’ve entered will be deleted.`)) return;
      await api('DELETE', `/api/apply/invites/${b.dataset.remove}`);
      await refresh(); renderInvites(step);
    }));
    wireSimpleContinue(step);
    $('.app-h1').focus();
  }

  function wireSimpleContinue(step) {
    const form = $('[data-step-form]');
    flushTarget = null;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api('POST', `/api/apply/step/${step.id}/complete`, { data: {} });
      if (r.status === 422) {
        const sum = form.querySelector('[data-error-summary]');
        sum.innerHTML = `<h2 class="h4">Before you continue</h2><ul>${Object.values(r.data.errors).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
        sum.hidden = false; sum.focus();
        S.state.progress[step.id] = false;
        return;
      }
      if (!r.ok) return;
      S.state.progress = r.data.progress;
      go(nextId(step) || 'review');
    });
  }

  async function refresh() {
    const r = await api('GET', '/api/apply/state');
    if (r.ok) { const csrf = S.state.csrf; S.state = r.data; S.state.csrf = r.data.csrf || csrf; }
  }

  // Documents
  function renderDocuments(step) {
    const st = S.state;
    const docs = st.me.documents;
    const mb = st.upload.maxBytes / 1048576;
    const bondNeeded = st.role === 'lead' && st.application.tenancy?.bondAssistance === 'yes';
    shell(`<div class="app-card">
${stepHeader(step)}
<p class="notice small">${ICON.lock}<span>Only upload the documents asked for. If your document shows a number you don’t need to share (for example a Medicare number or full card number), you can cover it before taking the photo.</span></p>
<div class="app-docs">${step.categories.filter((c) => c.id !== 'bond' || bondNeeded).map((c) => {
    const list = docs.filter((d) => d.category === c.id);
    return `<section class="doc-cat" aria-labelledby="dc-${c.id}" id="q-doc-${c.id}" tabindex="-1">
<div class="doc-cat-head"><h2 class="h4" id="dc-${c.id}">${esc(c.label)}${c.required || (c.id === 'bond' && bondNeeded) ? '' : ''}</h2>${list.length ? `<span class="status-pill st-complete">${ICON.check} Added</span>` : c.required || c.id === 'bond' ? '<span class="status-pill">Required</span>' : ''}</div>
${c.help ? `<p class="muted small">${esc(c.help)}</p>` : ''}
<ul class="doc-list">${list.map((d) => `<li>${ICON.doc}<span class="doc-name">${esc(d.name)}</span><span class="muted small">${Math.max(1, Math.round(d.size / 1024))} KB</span><button class="btn-link small" type="button" data-del="${d.id}" aria-label="Remove ${esc(d.name)}">Remove</button></li>`).join('')}</ul>
<label class="dropzone" data-drop="${c.id}"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic" data-file="${c.id}" aria-describedby="up-${c.id}-err">
${ICON.upload}<span><strong>${list.length ? 'Add another file' : 'Choose a file'}</strong> or take a photo<br><span class="muted small">PDF, JPG, PNG or HEIC · up to ${mb}MB</span></span></label>
<div class="upload-progress" data-progress="${c.id}" hidden><div></div></div>
<p class="error" id="up-${c.id}-err" hidden></p>
</section>`;
  }).join('')}</div>
<form data-step-form novalidate><div class="error-summary" role="alert" tabindex="-1" data-error-summary hidden></div>${navButtons(step, { continueLabel: 'Continue' })}</form>
</div>`);
    root.querySelectorAll('[data-file]').forEach((input) => input.addEventListener('change', () => { if (input.files[0]) upload(step, input.dataset.file, input.files[0]); }));
    root.querySelectorAll('[data-drop]').forEach((zone) => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); const f = e.dataTransfer.files[0]; if (f) upload(step, zone.dataset.drop, f); });
    });
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const r = await api('DELETE', `/api/apply/documents/${b.dataset.del}`);
      if (r.ok) { st.me.documents = st.me.documents.filter((d) => d.id !== b.dataset.del); st.progress.documents = false; renderDocuments(step); }
    }));
    wireSimpleContinue(step);
    $('.app-h1').focus();
  }

  function upload(step, category, file) {
    const st = S.state;
    const err = $(`#up-${category}-err`);
    const bar = $(`[data-progress="${category}"]`);
    err.hidden = true;
    if (window.IK_DEMO) {
      bar.hidden = false; bar.firstElementChild.style.width = '60%';
      window.IK_DEMO.upload(category, file).then(({ status, data }) => {
        bar.hidden = true;
        if (status === 201) { st.me.documents.push(data.document); renderDocuments(step); }
        else { err.textContent = data.error; err.hidden = false; }
      });
      return;
    }
    const ok = /\.(pdf|jpe?g|png|heic)$/i.test(file.name) || ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'].includes(file.type);
    if (!ok) { err.textContent = 'That file type isn’t supported. Upload a PDF, JPG, PNG or HEIC file.'; err.hidden = false; return; }
    if (file.size > st.upload.maxBytes) { err.textContent = `That file is larger than ${st.upload.maxBytes / 1048576}MB. Try a smaller photo or a compressed PDF.`; err.hidden = false; return; }
    const fd = new FormData();
    fd.append('category', category);
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/apply/documents');
    xhr.setRequestHeader('X-CSRF-Token', st.csrf);
    bar.hidden = false;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) bar.firstElementChild.style.width = `${Math.round((e.loaded / e.total) * 100)}%`; };
    xhr.onload = () => {
      bar.hidden = true;
      let data = {}; try { data = JSON.parse(xhr.responseText); } catch { /* empty */ }
      if (xhr.status === 201) {
        st.me.documents.push(data.document);
        renderDocuments(step);
        const heading = $(`#dc-${category}`);
        const live = document.createElement('p'); live.className = 'visually-hidden'; live.setAttribute('role', 'status'); live.textContent = `${data.document.name} uploaded.`;
        heading.after(live);
      } else { err.textContent = data.error || 'Upload failed. Please try again.'; err.hidden = false; }
    };
    xhr.onerror = () => { bar.hidden = true; err.textContent = 'Upload failed. Check your connection and try again.'; err.hidden = false; };
    xhr.send(fd);
  }

  // Review
  function valueText(f, v) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
    if (f.type === 'radio' || f.type === 'select') { const o = f.options.find((x) => optVal(x) === v); return o ? optLabel(o) : v; }
    if (f.type === 'checkboxes') return v.map((x) => optLabel(f.options.find((o) => optVal(o) === x) || x)).join(', ');
    if (f.type === 'checkbox') return v ? 'Yes' : 'No';
    if (f.type === 'money') return money(v);
    if (f.type === 'date') return new Date(`${v}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    if (f.type === 'list') return v.map((it) => f.fields.map((sf) => it[sf.name]).filter(Boolean).join(' · ')).join('\n');
    return String(v);
  }
  function summaryRows(step, data) {
    return step.fields.filter((f) => f.name && visible(f, data)).map((f) => {
      const t = valueText(f, get(data, f.name));
      return `<div><dt>${esc(f.label)}</dt><dd>${t === null ? '<span class="muted">Not provided</span>' : esc(t).replace(/\n/g, '<br>')}</dd></div>`;
    }).join('');
  }
  function renderReview(step) {
    const st = S.state;
    const missing = steps().filter((s) => !['review', 'declaration'].includes(s.id) && !st.progress[s.id]);
    const blocks = steps().filter((s) => !['review', 'declaration'].includes(s.id)).map((s) => {
      let content = '';
      if (s.scope === 'application') content = `<dl class="app-dl">${summaryRows(s, st.application.tenancy || {})}</dl>`;
      else if (s.scope === 'applicant') content = `<dl class="app-dl">${summaryRows(s, st.me.data)}</dl>`;
      else if (s.scope === 'documents') content = `<ul class="plain">${st.me.documents.map((d) => `<li>${ICON.doc} ${esc(d.name)} <span class="muted small">(${esc(s.categories.find((c) => c.id === d.category)?.label)})</span></li>`).join('') || '<li class="muted">No documents yet</li>'}</ul>`;
      else if (s.scope === 'invites') content = `<ul class="plain">${st.others.map((o) => `<li>${esc(o.firstName)} ${esc(o.lastName || '')}, ${o.status === 'complete' ? 'complete' : 'not finished yet'}</li>`).join('') || '<li class="muted">No other applicants</li>'}</ul>`;
      return `<section class="review-block" aria-labelledby="rv-${s.id}"><div class="review-head"><h2 class="h4" id="rv-${s.id}">${esc(s.title)} ${st.progress[s.id] ? `<span class="status-pill st-complete">${ICON.check} Complete</span>` : '<span class="status-pill st-missing">Needs attention</span>'}</h2><a href="#step-${s.id}">Change<span class="visually-hidden"> ${esc(s.title)}</span></a></div>${content}</section>`;
    }).join('');
    shell(`<div class="app-card">
${stepHeader(step)}
${missing.length ? `<div class="error-summary" role="alert" tabindex="-1"><h2 class="h4">Some sections still need attention</h2><ul>${missing.map((m) => `<li><a href="#step-${m.id}">${esc(m.title)}</a></li>`).join('')}</ul></div>` : '<p class="notice">Everything looks complete. Check your answers, then continue to sign.</p>'}
${blocks}
<div class="app-nav"><a class="btn btn-ghost" href="#step-${steps()[stepIndex(step.id) - 1].id}">${ICON.arrowL} Back</a>${missing.length ? `<a class="btn btn-dark" href="#step-${missing[0].id}">Go to ${esc(missing[0].title)}</a>` : '<a class="btn btn-dark" href="#step-declaration">Continue to declarations</a>'}</div>
</div>`);
    st.progress.review = !missing.length;
    $('.app-h1').focus();
  }

  // Declaration
  function renderDeclaration(step) {
    const st = S.state;
    const missing = steps().filter((s) => !['review', 'declaration'].includes(s.id) && !st.progress[s.id]);
    if (missing.length) return go('review');
    const d = st.me.data.details || {};
    const lead = st.role === 'lead';
    const waiting = st.others.filter((o) => o.status !== 'complete');
    shell(`<form class="app-card form" novalidate data-sign-form>
${stepHeader(step)}
${st.declarations.approved ? '' : `<p class="notice small">${ICON.lock}<span>These declarations are a draft awaiting legal approval (version ${esc(st.declarations.version)}).</span></p>`}
<div class="error-summary" role="alert" tabindex="-1" data-error-summary hidden></div>
<p>Please read the <a href="/application-privacy" target="_blank" rel="noopener">application collection notice<span class="visually-hidden"> (opens in a new tab)</span></a> and the <a href="/application-privacy#tenancy-databases" target="_blank" rel="noopener">notice of use of residential tenancy databases<span class="visually-hidden"> (opens in a new tab)</span></a>.</p>
<fieldset class="field choice" id="q-declarations" aria-describedby="q-declarations-err"><legend>I confirm that:</legend>
<div class="choices">${st.declarations.items.map((x) => `<label class="choice-item decl"><input type="checkbox" name="accepted" value="${esc(x.id)}"><span>${esc(x.text)}</span></label>`).join('')}</div>
<p class="error" id="q-declarations-err" hidden></p></fieldset>
<div class="field"><label for="q-signedName">Type your full name to sign</label><p class="help" id="q-signedName-help">Enter it exactly as: <strong>${esc(d.firstName)} ${esc(d.lastName)}</strong></p>
<input id="q-signedName" name="signedName" autocomplete="off" aria-describedby="q-signedName-help q-signedName-err" class="signature"><p class="error" id="q-signedName-err" hidden></p></div>
<p class="small muted">Signed ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}. We record the time you sign and the declaration version.</p>
${lead && waiting.length ? `<p class="notice small">${waiting.map((w) => esc(w.firstName)).join(', ')} still ${waiting.length === 1 ? 'needs' : 'need'} to finish. Your application will be submitted automatically once everyone has signed.</p>` : ''}
${!lead ? '<p class="notice small">Once you sign, your part is complete. The application is submitted when every applicant has signed.</p>' : ''}
<div class="app-nav"><a class="btn btn-ghost" href="#step-review">${ICON.arrowL} Back</a><button class="btn btn-brand" type="submit">${lead && !waiting.length ? 'Sign and submit application' : 'Sign'}</button></div>
</form>`);
    const form = $('[data-sign-form]');
    flushTarget = null;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accepted = [...form.querySelectorAll('input[name=accepted]:checked')].map((c) => c.value);
      const signedName = form.querySelector('#q-signedName').value;
      const errors = {};
      if (accepted.length < st.declarations.items.length) errors.declarations = 'Tick every declaration to continue.';
      if (!signedName.trim()) errors.signedName = 'Type your full name to sign.';
      if (Object.keys(errors).length) return showErrors(form, errors);
      const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Submitting…';
      const r = await api('POST', '/api/apply/sign', { accepted, signedName });
      btn.disabled = false; btn.textContent = 'Sign';
      if (!r.ok) {
        if (r.data.field === 'signedName') return showErrors(form, { signedName: r.data.error });
        return showErrors(form, { declarations: r.data.error || 'Something went wrong.' });
      }
      await refresh();
      go('status');
    });
    $('.app-h1').focus();
  }

  // Status
  function renderStatus() {
    const st = S.state; S.step = null;
    const app = st.application;
    const open = st.requests.filter((r) => r.status === 'open');
    const statusCopy = {
      draft: 'Your application isn’t finished yet.',
      awaiting_applicants: 'You’ve signed. We’re waiting for the other applicants to finish and sign.',
      submitted: 'Your application has been submitted. Applications usually take 36–48 hours to process.',
      under_review: 'Your property manager is reviewing your application.',
      info_requested: 'Your property manager has asked for more information.',
      finalised: 'A decision has been made. We’ll have contacted you by email or phone.',
      withdrawn: 'This application has been withdrawn.',
    }[app.status];
    shell(`<div class="app-card">
<p class="label">Application ${esc(app.ref)}</p>
<h1 class="app-h1" tabindex="-1">${st.me.signed && app.status === 'awaiting_applicants' ? 'Thanks, you’ve signed' : app.status === 'submitted' ? 'Application submitted' : esc(app.statusLabel || 'Your application')}</h1>
<p class="app-status-line"><span class="status-pill st-${esc(app.status)}">${esc(app.statusLabel)}</span></p>
<p>${statusCopy}</p>
${app.status === 'submitted' && !st.emailDelivered ? '<p class="notice small">Confirmation emails are switched off in this preview, so you won’t receive one.</p>' : ''}
${open.length ? `<section class="app-requests"><h2 class="h4">Requested by your property manager</h2>${open.map((r) => `<blockquote>${esc(r.message).replace(/\n/g, '<br>')}</blockquote>`).join('')}
<p>Update the relevant sections, then tell us you’re done.</p>
<div class="actions"><a class="btn btn-ghost" href="#step-documents">Upload documents</a><a class="btn btn-ghost" href="#step-${steps()[0].id}">Edit my answers</a><button class="btn btn-dark" type="button" data-send-update>I’ve made the changes</button></div></section>` : ''}
<h2 class="h4 mt-s">Applicants</h2>
<ul class="app-people"><li><div><strong>${esc(st.me.firstName)} (you)</strong><br><span class="status-pill ${st.me.signed ? 'st-complete' : ''}">${st.me.signed ? 'Signed' : 'Not signed yet'}</span></div>${!st.me.signed && app.editable ? '<a class="btn btn-dark btn-sm" href="#step-review">Continue</a>' : ''}</li>
${st.others.map((o) => `<li><div><strong>${esc(o.firstName)}</strong><br><span class="status-pill ${o.status === 'complete' ? 'st-complete' : ''}">${o.status === 'complete' ? 'Signed' : o.status === 'invited' ? 'Invited' : 'In progress'}</span></div></li>`).join('')}</ul>
<details class="notice-box"><summary>Need to correct something or ask a question?</summary>
<form class="form" data-message-form novalidate><div class="field"><label for="q-message">Message to your property manager</label><textarea id="q-message" name="message" rows="4" maxlength="2000" aria-describedby="q-message-err"></textarea><p class="error" id="q-message-err" hidden></p></div>
<button class="btn btn-ghost btn-sm" type="submit">Send message</button><div class="form-status" role="status" aria-live="polite"></div></form></details>
${st.role === 'lead' && !['withdrawn', 'finalised'].includes(app.status) ? `<details class="notice-box"><summary>Withdraw this application</summary><p class="small">This withdraws the application for everyone on it. Your information will then be deleted in line with our collection notice.</p><button class="btn btn-ghost btn-sm" type="button" data-withdraw>Withdraw application</button></details>` : ''}
<div class="actions"><a class="btn btn-ghost" href="/rent">Browse other rentals</a><button class="btn-link" type="button" data-signout2>Sign out</button></div>
</div>`, { showSteps: app.editable && !st.me.signed });
    root.querySelector('[data-signout2]')?.addEventListener('click', signOut);
    root.querySelector('[data-send-update]')?.addEventListener('click', async (e) => {
      const r = await api('POST', '/api/apply/send-update', {});
      if (r.ok) { await refresh(); renderStatus(); } else e.target.textContent = r.data.error || 'Couldn’t send';
    });
    root.querySelector('[data-withdraw]')?.addEventListener('click', async () => {
      if (!window.confirm('Withdraw this application for all applicants?')) return;
      const r = await api('POST', '/api/apply/message', { kind: 'withdraw' });
      if (r.ok) { await refresh(); renderStatus(); }
    });
    const mf = root.querySelector('[data-message-form]');
    mf?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = mf.querySelector('textarea').value;
      const r = await api('POST', '/api/apply/message', { kind: 'correction', message });
      const status = mf.querySelector('.form-status');
      if (r.status === 422) { const er = $('#q-message-err'); er.textContent = r.data.errors.message; er.hidden = false; return; }
      status.textContent = r.ok ? 'Message sent. Your property manager will be in touch.' : (r.data.error || 'Couldn’t send.');
      if (r.ok) mf.reset();
    });
    $('.app-h1').focus();
  }

  if (window.IK_DEMO) window.IK_APP_START = load; else load();
})();
