// Demonstration mode for the digital application (static preview / GitHub Pages).
// Mirrors the real API in memory only. Nothing is saved, uploaded or sent, and no browser storage is used.
import { STEPS, LEAD_STEPS, DECLARATIONS, APPLICATION_STATUSES, validateFields, sanitise, deepMerge } from './app-schema.mjs';

const listings = JSON.parse(document.getElementById('demo-listings').textContent);
const MAX = 10 * 1024 * 1024;
let st = null;
const uid = () => Math.random().toString(36).slice(2, 10);
const ok = (data, status = 200) => ({ ok: status < 300, status, data });
const fail = (status, data) => ({ ok: false, status, data });

function publicStep(k) { const s = STEPS[k]; return { id: k, title: s.title, intro: s.intro, scope: s.scope, fields: s.fields, categories: s.categories }; }

function start({ listingId, firstName, lastName, email }) {
  const l = listings.find((x) => x.id === listingId) || listings[0];
  st = {
    csrf: 'demo', demo: true, emailDelivered: false, role: 'lead',
    steps: LEAD_STEPS.map(publicStep), progress: {},
    application: { ref: `DEMO-${uid().toUpperCase().slice(0, 5)}`, status: 'draft', statusLabel: APPLICATION_STATUSES.draft.applicant, editable: true, listing: l, tenancy: {} },
    me: { firstName, data: { details: { firstName, lastName, email } }, documents: [], signed: false, status: 'in_progress' },
    others: [], requests: [],
    declarations: { version: 'DRAFT-2026-09-17', approved: false, items: DECLARATIONS },
    upload: { maxBytes: MAX, maxFiles: 15 },
  };
}

function setStatus(s) { st.application.status = s; st.application.statusLabel = APPLICATION_STATUSES[s].applicant; st.application.editable = ['draft', 'awaiting_applicants', 'info_requested'].includes(s); }
const clone = (o) => JSON.parse(JSON.stringify(o));

async function api(method, url, body) {
  await new Promise((r) => setTimeout(r, 120));
  const path = url.replace(/^\/api\/apply/, '');
  if (!st && path !== '/start') return fail(401, { error: 'Start the demo first.' });
  let m;
  if (method === 'GET' && path === '/state') return ok(clone(st));
  if ((m = path.match(/^\/step\/(\w+)(\/complete)?$/))) {
    const step = STEPS[m[1]]; if (!step) return fail(404, { error: 'Unknown step.' });
    const clean = sanitise(step.fields, body?.data || {});
    let data = {};
    if (step.scope === 'application') { st.application.tenancy = deepMerge(st.application.tenancy, clean); data = st.application.tenancy; }
    if (step.scope === 'applicant') { if (clean.details) clean.details.email = st.me.data.details.email; st.me.data = deepMerge(st.me.data, clean); data = st.me.data; }
    if (!m[2]) return ok({ ok: true });
    let errors = (step.scope === 'application' || step.scope === 'applicant') ? validateFields(step.fields, data) : {};
    if (step.scope === 'documents') step.categories.filter((c) => c.required).forEach((c) => { if (!st.me.documents.some((d) => d.category === c.id)) errors[`doc.${c.id}`] = `Upload your ${c.label.toLowerCase()}.`; });
    if (step.scope === 'invites') { const need = Number(st.application.tenancy.adults || 1) - 1 - st.others.length; if (need > 0) errors = { invites: `You said ${st.application.tenancy.adults} adults will live at the property. Add ${need} more applicant${need === 1 ? '' : 's'}, or change the number in “The property”.` }; }
    st.progress[m[1]] = !Object.keys(errors).length;
    return Object.keys(errors).length ? fail(422, { errors }) : ok({ ok: true, progress: st.progress });
  }
  if (method === 'POST' && path === '/invites') {
    const errors = {};
    if (!body.firstName?.trim()) errors.firstName = 'Enter their first name.';
    if (!body.lastName?.trim()) errors.lastName = 'Enter their last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email || '')) errors.email = 'Enter a valid email address.';
    if (Object.keys(errors).length) return fail(422, { errors });
    // In the live system the co-applicant receives a private link. The demo marks them complete so you can see the full flow.
    st.others.push({ id: uid(), firstName: body.firstName.trim(), lastName: body.lastName.trim(), isLead: false, status: 'complete', signed: true });
    return ok({ ok: true, emailDelivered: false }, 201);
  }
  if ((m = path.match(/^\/invites\/(\w+)(\/resend)?$/))) {
    if (!m[2]) st.others = st.others.filter((o) => o.id !== m[1]);
    return ok({ ok: true, emailDelivered: false });
  }
  if (method === 'DELETE' && (m = path.match(/^\/documents\/(\w+)$/))) { st.me.documents = st.me.documents.filter((d) => d.id !== m[1]); st.progress.documents = false; return ok({ ok: true }); }
  if (path === '/sign') {
    const missing = LEAD_STEPS.filter((s) => !['review', 'declaration'].includes(s) && !st.progress[s]);
    if (missing.length) return fail(422, { error: 'Please complete every section first.' });
    if (DECLARATIONS.some((d) => !body.accepted?.includes(d.id))) return fail(422, { error: 'Please confirm every declaration.' });
    const d = st.me.data.details; const expected = `${d.firstName} ${d.lastName}`.toLowerCase().replace(/\s+/g, ' ');
    if (String(body.signedName || '').trim().toLowerCase().replace(/\s+/g, ' ') !== expected) return fail(422, { error: `Type your full name exactly as “${d.firstName} ${d.lastName}”.`, field: 'signedName' });
    st.me.signed = true; st.me.status = 'complete'; st.progress.declaration = true;
    setStatus('submitted');
    return ok({ ok: true, submitted: true });
  }
  if (path === '/message') {
    if (body.kind === 'withdraw') { setStatus('withdrawn'); return ok({ ok: true }); }
    if (!body.message?.trim()) return fail(422, { errors: { message: 'Enter your message.' } });
    return ok({ ok: true });
  }
  if (path === '/send-update') { setStatus('under_review'); return ok({ ok: true }); }
  if (path === '/logout') { st = null; return ok({ ok: true }); }
  return fail(404, { error: 'Not available in the demo.' });
}

async function upload(category, file) {
  await new Promise((r) => setTimeout(r, 400));
  const typeOk = /\.(pdf|jpe?g|png|heic)$/i.test(file.name) || ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'].includes(file.type);
  if (!typeOk) return { status: 415, data: { error: 'That file type isn’t supported. Upload a PDF, JPG, PNG or HEIC file.' } };
  if (file.size > MAX) return { status: 413, data: { error: 'That file is larger than 10MB. Try a smaller photo or a compressed PDF.' } };
  const document = { id: uid(), category, name: file.name.slice(0, 120), mime: file.type, size: file.size };
  st.me.documents.push(document);
  return { status: 201, data: { ok: true, document } };
}

window.IK_DEMO = { api, upload };

// Start form: choose property, then open the application in the same page.
const form = document.querySelector('[data-demo-start]');
const select = form.querySelector('#s-listing');
const wanted = new URLSearchParams(location.search).get('listing');
if (wanted && listings.some((l) => l.id === wanted)) select.value = wanted;
const showProperty = () => {
  const l = listings.find((x) => x.id === select.value);
  document.querySelector('[data-demo-address]').textContent = `${l.street}, ${l.suburb}`;
  document.querySelector('[data-demo-meta]').textContent = `$${l.rentWeekly.toLocaleString('en-AU')} per week · Ref ${l.ref}`;
  document.querySelector('[data-demo-thumb]').src = `https://i0.wp.com/irvingandkeenan.com.au/wp-content/uploads/${l.image}?w=320`;
};
select.addEventListener('change', showProperty);
showProperty();
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = window.IK.formData(form);
  const errors = {};
  if (!d.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!d.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) errors.email = 'Enter a valid email address, like name@example.com.';
  if (!d.privacyAck) errors.privacyAck = 'Please confirm you have read how your information is handled.';
  if (Object.keys(errors).length) return window.IK.showErrors(form, errors);
  start({ listingId: d.listingId, firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim().toLowerCase() });
  document.querySelector('[data-demo-intro]').hidden = true;
  history.replaceState(null, '', `${location.pathname}${location.search}#welcome`);
  window.IK_APP_START();
  window.scrollTo(0, 0);
});
