// ============================================================
//  GALLERY.JS — Scrolling strip carousel + fullscreen viewer
// ============================================================

(function () {
  'use strict';

  const cfg         = window.PORTFOLIO_CONFIG || {};
  const BUCKET_URL  = (cfg.R2_BUCKET_URL || '').replace(/\/$/, '');
  const EXTENSIONS  = cfg.SUPPORTED_EXTENSIONS || ['jpg','jpeg','png','webp','avif'];
  const HERO_FOLDER = cfg.HERO_FOLDER || 'hero';

  // DOM
  const countEl       = document.getElementById('photoCount');
  const configBanner  = document.getElementById('configBanner');
  const filterBar     = document.getElementById('filterBar');
  const yearEl        = document.getElementById('year');
  const cursor        = document.getElementById('cursor');
  const cursorRing    = document.getElementById('cursorRing');
  const carouselWrap  = document.getElementById('carouselWrap');
  const carouselStrip = document.getElementById('carouselStrip');
  const carouselName  = document.getElementById('carouselName');
  const carouselCat   = document.getElementById('carouselCategory');
  const carouselCtr   = document.getElementById('carouselCounter');
  const grid          = document.getElementById('galleryGrid');
  const heroRight     = document.getElementById('heroRight');
  const heroDots      = document.getElementById('heroDots');
  const sortSelect    = document.getElementById('sortSelect');
  const sortLoading   = document.getElementById('sortLoading');

  // Fullscreen viewer
  const fsViewer  = document.getElementById('fsViewer');
  const fsImg     = document.getElementById('fsImg');
  const fsClose   = document.getElementById('fsClose');
  const fsPrev    = document.getElementById('fsPrev');
  const fsNext    = document.getElementById('fsNext');
  const fsCtr     = document.getElementById('fsCounter');
  const fsContact = document.getElementById('fsContact');

  if (yearEl) yearEl.textContent = new Date().getFullYear();
  applyConfig();

  // ---- Config ----
  function applyConfig() {
    if (cfg.PHOTOGRAPHER_NAME) {
      document.title = cfg.PHOTOGRAPHER_NAME + ' — Portfolio';
      const logoEl = document.querySelector('.logo');
      if (logoEl) logoEl.innerHTML = '<span>' + cfg.PHOTOGRAPHER_NAME[0] + '</span>' + cfg.PHOTOGRAPHER_NAME.slice(1);
      const footerLeft = document.querySelector('footer span:first-child');
      if (footerLeft) footerLeft.textContent = '\u00a9 ' + new Date().getFullYear() + ' ' + cfg.PHOTOGRAPHER_NAME;
    }
    if (cfg.HERO_EYEBROW) { const el = document.querySelector('.hero-eyebrow'); if (el) el.textContent = cfg.HERO_EYEBROW; }
    if (cfg.HERO_TITLE_LINE1 || cfg.HERO_TITLE_LINE2) {
      const el = document.querySelector('.hero-title');
      if (el) el.innerHTML = (cfg.HERO_TITLE_LINE1 || '') + '<br><em>' + (cfg.HERO_TITLE_LINE2 || '') + '</em>';
    }
    if (cfg.HERO_DESC) { const el = document.querySelector('.hero-desc'); if (el) el.textContent = cfg.HERO_DESC; }
  }

  // ---- Cursor hover (uses default system cursor) ----
  function setCursorHover(on) { /* no custom cursor */ }

  // ---- Data ----
  let allPhotos      = [];
  let filteredPhotos = [];
  let focusedIndex   = 0;
  let currentCategory = null;
  let datesLoaded    = false;
  let fsIndex        = 0;

  // ---- Init ----
  async function init() {
    if (!BUCKET_URL) { showConfigBanner(); return; }
    try {
      const res = await fetch('/api');
      if (!res.ok) throw new Error('Could not load photo list (status ' + res.status + ')');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const heroKeys    = (data.photos || []).filter(k => k.split('/')[0] === HERO_FOLDER && isImage(k));
      const galleryKeys = (data.photos || []).filter(k => k.split('/')[0] !== HERO_FOLDER && isImage(k) && !k.startsWith('.'));

      loadHeroSlides(heroKeys);

      allPhotos = galleryKeys.sort().map(keyToPhoto);
      if (allPhotos.length === 0) { showEmpty(); return; }

      buildFilterBar(allPhotos);
      readExifDatesInBackground();

    } catch (err) {
      console.error('Gallery load error:', err);
      showError(err.message);
    }
  }

  function isImage(key) { return EXTENSIONS.includes(key.split('.').pop().toLowerCase()); }

  function keyToPhoto(key) {
    const parts    = key.split('/');
    const category = parts.length > 1 ? parts[0] : 'uncategorised';
    const filename = parts[parts.length - 1];
    const name     = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const url      = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
    return { key, url, name, category, date: null };
  }

  // ---- Hero Slideshow ----
  let heroSlides = [], heroIndex = 0;

  function loadHeroSlides(keys) {
    if (!keys.length || !heroRight) return;
    heroSlides = keys;
    heroRight.querySelectorAll('.hero-slide').forEach(el => el.remove());
    if (heroDots) heroDots.innerHTML = '';
    keys.forEach((key, i) => {
      const url = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
      const img = document.createElement('img');
      img.className = 'hero-slide'; img.src = url; img.alt = '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      heroRight.insertBefore(img, heroRight.querySelector('.hero-photo-overlay'));
      if (heroDots) {
        const dot = document.createElement('button');
        dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => heroGoTo(i));
        heroDots.appendChild(dot);
      }
    });
    heroRight.querySelectorAll('.hero-slide')[0].classList.add('active', 'dissolve-in');
    if (keys.length > 1) setInterval(() => heroGoTo((heroIndex + 1) % heroSlides.length), 4000);
  }

  function heroGoTo(index) {
    const slides = heroRight.querySelectorAll('.hero-slide');
    const dots   = heroDots ? heroDots.querySelectorAll('.hero-dot') : [];

    // Remove dissolve-in from previous active before transitioning
    slides[heroIndex].classList.remove('active', 'dissolve-in');
    slides[heroIndex].classList.add('leaving');
    if (dots[heroIndex]) dots[heroIndex].classList.remove('active');

    heroIndex = index;

    // Force reflow so animation restarts cleanly
    void slides[heroIndex].offsetWidth;
    slides[heroIndex].classList.remove('leaving');
    slides[heroIndex].classList.add('active', 'dissolve-in');
    if (dots[heroIndex]) dots[heroIndex].classList.add('active');

    setTimeout(() => slides.forEach(s => s.classList.remove('leaving')), 1400);
  }

  // ---- Filter Bar ----
  function buildFilterBar(photos) {
    if (!filterBar) return;
    const seen = new Set(), cats = [];
    photos.forEach(p => { if (!seen.has(p.category)) { seen.add(p.category); cats.push(p.category); } });
    if (cats.length <= 1) { filterBar.style.display = 'none'; filterAndRender(cats[0] || 'all'); return; }
    filterBar.innerHTML = '';
    cats.forEach((cat, i) => filterBar.appendChild(makeFilterBtn(cat.charAt(0).toUpperCase() + cat.slice(1).replace(/[-_]/g, ' '), cat, i === 0)));
    filterBar.style.display = 'flex';
    filterAndRender(cats[0]);
  }

  function makeFilterBtn(label, value, active) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterAndRender(value);
    });
    btn.addEventListener('mouseenter', () => setCursorHover(true));
    btn.addEventListener('mouseleave', () => setCursorHover(false));
    return btn;
  }

  // ---- Sort — always oldest first by shoot date ----
  function applySortOrder(photos) {
    return [...photos].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;  // no date goes to end
      if (!b.date) return -1;
      return a.date - b.date; // oldest first
    });
  }

  async function readExifDatesInBackground() {
    // Wait briefly for exifr to load if it hasn't yet (both scripts are deferred)
    if (!window.exifr) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    if (!window.exifr) return;
    await Promise.allSettled(allPhotos.map(async photo => {
      try {
        const data = await window.exifr.parse(photo.url, ['DateTimeOriginal', 'CreateDate']);
        const raw  = data && (data.DateTimeOriginal || data.CreateDate);
        if (raw) photo.date = raw instanceof Date ? raw : new Date(raw);
      } catch (e) {}
    }));
    datesLoaded = true;
    reRender(); // re-sort by date once all dates are read
  }

  function reRender() {
    const base = currentCategory === 'all' || !currentCategory ? allPhotos : allPhotos.filter(p => p.category === currentCategory);
    filteredPhotos = applySortOrder(base);
    focusedIndex = 0;
    buildStrip(filteredPhotos);
  }

  // ---- Filter & Render ----
  function filterAndRender(category) {
    currentCategory = category;
    const base = !category || category === 'all' ? allPhotos : allPhotos.filter(p => p.category === category);
    filteredPhotos = applySortOrder(base);
    countEl.textContent = filteredPhotos.length + ' image' + (filteredPhotos.length !== 1 ? 's' : '');
    focusedIndex = 0;
    buildStrip(filteredPhotos);
  }

  // ---- Scrolling Strip ----
  function buildStrip(photos) {
    if (!carouselStrip) return;
    carouselStrip.innerHTML = '';

    photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'strip-item' + (i === 0 ? ' focused' : '');

      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = i < 4 ? 'eager' : 'lazy';

      // Set natural width once loaded so strip items size correctly
      img.addEventListener('load', () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        item.style.width = Math.round(340 * ratio) + 'px';
      });

      item.appendChild(img);

      // Click always opens fullscreen (focus is handled by scroll position)
      item.addEventListener('click', () => openFullscreen(i));

      item.addEventListener('mouseenter', () => setCursorHover(true));
      item.addEventListener('mouseleave', () => setCursorHover(false));

      carouselStrip.appendChild(item);
    });

    // Add spacers at each end so first and last items can scroll to center
    const stripWidth = carouselStrip.clientWidth || window.innerWidth;
    const spacerSize = Math.floor(stripWidth / 2) + 'px';

    const spacerStart = document.createElement('div');
    spacerStart.className = 'strip-spacer';
    spacerStart.style.width = spacerSize;
    carouselStrip.insertBefore(spacerStart, carouselStrip.firstChild);

    const spacerEnd = document.createElement('div');
    spacerEnd.className = 'strip-spacer';
    spacerEnd.style.width = spacerSize;
    carouselStrip.appendChild(spacerEnd);

    updateCaption();
    setupDragScroll();
    setupScrollFocus();

    // Scroll first item into center on load (instant, no animation)
    requestAnimationFrame(() => scrollToFocused('instant'));
  }

  function setFocus(index) {
    const items = carouselStrip.querySelectorAll('.strip-item');
    if (!items.length) return;
    if (focusedIndex === index) return; // already focused
    items[focusedIndex].classList.remove('focused');
    focusedIndex = index;
    items[focusedIndex].classList.add('focused');
    updateCaption();
  }

  function scrollToFocused(behavior) {
    const items = carouselStrip.querySelectorAll('.strip-item');
    if (!items.length) return;
    const item = items[focusedIndex];
    // offsetLeft is relative to strip including the leading spacer
    const itemCenter = item.offsetLeft + item.offsetWidth / 2;
    carouselStrip.scrollTo({ left: itemCenter - carouselStrip.clientWidth / 2, behavior: behavior || 'smooth' });
  }

  // Auto-focus the item closest to the strip center — runs every animation frame
  // while scrolling so the magnify/brighten effect is continuous and immediate
  function setupScrollFocus() {
    if (!carouselStrip) return;
    let rafId = null;

    function findAndSetFocus() {
      const stripCenter = carouselStrip.scrollLeft + carouselStrip.clientWidth / 2;
      const items = Array.from(carouselStrip.querySelectorAll('.strip-item'));
      let closest = 0, minDist = Infinity;
      items.forEach((item, i) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const dist = Math.abs(itemCenter - stripCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setFocus(closest);
      rafId = null;
    }

    carouselStrip.addEventListener('scroll', () => {
      if (!rafId) rafId = requestAnimationFrame(findAndSetFocus);
    }, { passive: true });
  }

  function updateCaption() {
    if (!filteredPhotos.length) return;
    const p = filteredPhotos[focusedIndex];
    if (carouselName) carouselName.textContent = p.name;
    if (carouselCat)  carouselCat.textContent  = p.category !== 'uncategorised' ? p.category.replace(/[-_]/g, ' ') : '';
    if (carouselCtr)  carouselCtr.textContent  = (focusedIndex + 1) + ' / ' + filteredPhotos.length;
  }

  // ---- Drag to scroll ----
  function setupDragScroll() {
    if (!carouselStrip) return;
    let isDragging = false, startX = 0, scrollLeft = 0;

    carouselStrip.addEventListener('mousedown', e => {
      isDragging = true; startX = e.pageX - carouselStrip.offsetLeft; scrollLeft = carouselStrip.scrollLeft;
      carouselStrip.style.cursor = 'grabbing';
    });
    document.addEventListener('mouseup', () => { isDragging = false; carouselStrip.style.cursor = 'grab'; });
    carouselStrip.addEventListener('mousemove', e => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - carouselStrip.offsetLeft;
      carouselStrip.scrollLeft = scrollLeft - (x - startX);
    });
  }

  // ---- Keyboard nav for strip ----
  document.addEventListener('keydown', e => {
    if (fsViewer && fsViewer.classList.contains('open')) {
      if (e.key === 'Escape')      closeFullscreen();
      if (e.key === 'ArrowLeft')   fsGoTo(fsIndex - 1);
      if (e.key === 'ArrowRight')  fsGoTo(fsIndex + 1);
      return;
    }
    if (e.key === 'ArrowLeft' && focusedIndex > 0) {
      setFocus(focusedIndex - 1);
      scrollToFocused('smooth');
    }
    if (e.key === 'ArrowRight' && focusedIndex < filteredPhotos.length - 1) {
      setFocus(focusedIndex + 1);
      scrollToFocused('smooth');
    }
    if (e.key === 'Enter') openFullscreen(focusedIndex);
  });

  // ---- Fullscreen Viewer ----
  function openFullscreen(index) {
    fsIndex = index;
    updateFs();
    fsViewer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeFullscreen() {
    fsViewer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function fsGoTo(index) {
    fsIndex = ((index % filteredPhotos.length) + filteredPhotos.length) % filteredPhotos.length;
    updateFs();
    // Keep strip in sync
    setFocus(fsIndex);
  }

  function updateFs() {
    const p = filteredPhotos[fsIndex];
    fsImg.src = p.url;
    fsImg.alt = p.name;
    if (fsCtr) fsCtr.textContent = (fsIndex + 1) + ' / ' + filteredPhotos.length;
    // Update enquiry link to pre-fill the contact form with this image's name
    if (fsContact) {
      fsContact.href = '#contact';
      fsContact.onclick = () => {
        const field = document.getElementById('contactImage');
        if (field) field.value = p.name;
        closeFullscreen();
      };
    }
  }

  if (fsClose) fsClose.addEventListener('click', closeFullscreen);
  if (fsPrev)  fsPrev.addEventListener('click',  () => fsGoTo(fsIndex - 1));
  if (fsNext)  fsNext.addEventListener('click',  () => fsGoTo(fsIndex + 1));

  if (fsViewer) {
    fsViewer.addEventListener('click', e => { if (e.target === fsViewer) closeFullscreen(); });
    // Touch swipe in fullscreen
    let fsTouchX = 0;
    fsViewer.addEventListener('touchstart', e => { fsTouchX = e.touches[0].clientX; }, { passive: true });
    fsViewer.addEventListener('touchend', e => {
      const diff = fsTouchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) fsGoTo(diff > 0 ? fsIndex + 1 : fsIndex - 1);
    });
  }

  [fsClose, fsPrev, fsNext].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', () => setCursorHover(true));
    el.addEventListener('mouseleave', () => setCursorHover(false));
  });

  // ---- States ----
  function showEmpty() {
    if (carouselWrap) carouselWrap.style.display = 'none';
    if (grid) { grid.style.display = 'block'; grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\u25ce</div><h3>No photos yet</h3><p>Upload images to your R2 bucket and they\'ll appear here automatically.</p></div>'; }
    countEl.textContent = '0 images';
  }
  function showError(msg) {
    if (carouselWrap) carouselWrap.style.display = 'none';
    if (grid) { grid.style.display = 'block'; grid.innerHTML = '<div class="error-state"><p>Could not load photos.</p><p style="margin-top:8px;font-size:11px">' + msg + '</p></div>'; }
    countEl.textContent = '—';
  }
  function showConfigBanner() {
    if (configBanner) configBanner.style.display = 'flex';
    if (carouselWrap) carouselWrap.style.display = 'none';
    countEl.textContent = '—';
  }

  // ---- Contact form — submits directly to Formspree from browser ----
  const contactForm    = document.getElementById('contactForm');
  const contactSuccess = document.getElementById('contactSuccess');
  const contactSubmit  = contactForm ? contactForm.querySelector('.contact-submit') : null;
  const contactAgain   = document.getElementById('contactAgain');

  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (contactSubmit) { contactSubmit.disabled = true; contactSubmit.textContent = 'Sending…'; }

      try {
        const data = new FormData(contactForm);
        const res  = await fetch('https://formspree.io/f/mnjljrnv', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: data,
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok) {
          contactForm.style.display = 'none';
          if (contactSuccess) contactSuccess.style.display = 'block';
        } else {
          alert('Sorry — ' + (json.error || 'there was a problem. Please try again.'));
          if (contactSubmit) { contactSubmit.disabled = false; contactSubmit.textContent = 'Send message'; }
        }
      } catch (err) {
        alert('Sorry, there was a problem sending your message. Please try again.');
        if (contactSubmit) { contactSubmit.disabled = false; contactSubmit.textContent = 'Send message'; }
      }
    });
  }

  if (contactAgain) {
    contactAgain.addEventListener('click', () => {
      if (contactForm)    { contactForm.reset(); contactForm.style.display = 'flex'; }
      if (contactSuccess) { contactSuccess.style.display = 'none'; }
      if (contactSubmit)  { contactSubmit.disabled = false; contactSubmit.textContent = 'Send message'; }
    });
  }

  init();

})();
