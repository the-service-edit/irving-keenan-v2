(() => {
  const root = document.querySelector('[data-gallery]');
  if (!root) return;
  const dlg = root.querySelector('[data-lightbox]');
  const imgEl = dlg.querySelector('[data-lightbox-img]');
  const count = dlg.querySelector('[data-lightbox-count]');
  const images = JSON.parse(dlg.querySelector('[data-lightbox-images]').textContent);
  let i = 0; let opener = null;
  const show = (n) => {
    i = (n + images.length) % images.length;
    imgEl.src = images[i];
    imgEl.alt = `Photo ${i + 1} of ${images.length}`;
    count.textContent = `${i + 1} / ${images.length}`;
  };
  root.querySelectorAll('[data-open-gallery]').forEach((b) => b.addEventListener('click', () => {
    opener = b; show(Number(b.dataset.openGallery)); dlg.showModal();
  }));
  dlg.querySelector('[data-lightbox-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(i - 1));
  dlg.querySelector('[data-lightbox-next]').addEventListener('click', () => show(i + 1));
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  dlg.addEventListener('close', () => opener?.focus());
  let x0 = null;
  dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
})();
