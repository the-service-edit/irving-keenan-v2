(() => {
  const start = document.querySelector('[data-start-form]');
  if (start) {
    const status = start.querySelector('.form-status');
    start.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = IK.formData(start);
      const errors = {};
      if (!d.firstName.trim()) errors.firstName = 'Enter your first name.';
      if (!d.lastName.trim()) errors.lastName = 'Enter your last name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) errors.email = 'Enter a valid email address, like name@example.com.';
      if (!d.privacyAck) errors.privacyAck = 'Please confirm you have read how your information is handled.';
      if (Object.keys(errors).length) return IK.showErrors(start, errors);
      const btn = start.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Starting…';
      const r = await IK.post('/api/apply/start', d).catch(() => ({ ok: false, data: {} }));
      if (r.ok) { window.location.assign('/apply/app?welcome=1'); return; }
      btn.disabled = false; btn.textContent = 'Start application';
      if (r.data.errors) IK.showErrors(start, r.data.errors);
      else { status.className = 'form-status is-error'; status.textContent = r.data.error || 'Something went wrong. Please try again.'; }
    });
  }
  const resume = document.querySelector('[data-resume-form]');
  if (resume) {
    const status = resume.querySelector('.form-status');
    resume.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = IK.formData(resume);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) return IK.showErrors(resume, { email: 'Enter a valid email address.' });
      IK.showErrors(resume, {});
      const r = await IK.post('/api/apply/resume-request', d).catch(() => ({ ok: false, data: {} }));
      status.className = r.ok ? 'form-status' : 'form-status is-error';
      status.textContent = r.ok ? `${r.data.message}${r.data.emailDelivered ? '' : ' (Email delivery is switched off in this preview.)'}` : (r.data.error || 'Something went wrong.');
    });
  }
})();
