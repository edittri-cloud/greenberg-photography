// ============================================================
//  GALLERY.JS — Dynamic photo loading from Cloudflare R2
//              Carousel view (default) + Grid view
// ============================================================

(function () {
  'use strict';

  const cfg        = window.PORTFOLIO_CONFIG || {};
  const BUCKET_URL = (cfg.R2_BUCKET_URL || '').replace(/\/$/, '');
  const EXTENSIONS = cfg.SUPPORTED_EXTENSIONS || ['jpg','jpeg','png','webp','avif'];
  const HERO_FOLDER = cfg.HERO_FOLDER || 'hero';

  // DOM refs
  const countEl        = document.getElementById('photoCount');
  const configBanner   = document.getElementById('configBanner');
  const filterBar      = document.getElementById('filterBar');
  const yearEl         = document.getElementById('year');
  const cursor         = document.getElementById('cursor');
  const cursorRing     = document.getElementById('cursorRing');
  const carouselWrap   = document.getElementById('carouselWrap');
  const carouselStage  = document.getElementById('carouselStage');
  const carouselPrev   = document.getElementById('carouselPrev');
  const carouselNext   = document.getElementById('carouselNext');
  const carouselName   = document.getElementById('carouselName');
  const carouselCat    = document.getElementById('carouselCategory');
  const carouselCtr    = document.getElementById('carouselCounter');
  const carouselThumbs = document.getElementById('carouselThumbs');
  const grid           = document.getElementById('galleryGrid');
  const heroRight      = document.getElementById('heroRight');
  const heroDots       = document.getElementById('heroDots');
  const sortSelect     = document.getElementById('sortSelect');
  const sortLoading    = document.getElementById('sortLoading');

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

  // ---- Cursor ----
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    cursor.style.left = mouseX + 'px'; cursor.style.top = mouseY + 'px';
  });
  (function animateRing() {
    ringX += (mouseX - ringX) * 0.12; ringY += (mouseY - ringY) * 0.12;
    cursorRing.style.left = ringX + 'px'; cursorRing.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  })();
  function setCursorHover(on) {
    cursor.classList.toggle('hover', on); cursorRing.classList.toggle('hover', on);
  }
  [carouselPrev, carouselNext].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', () => setCursorHover(true));
    el.addEventListener('mouseleave', () => setCursorHover(false));
  });

  // ---- Data ----
  let allPhotos      = [];
  let filteredPhotos = [];
  let carouselIndex  = 0;
  let currentCategory = null;
  let sortOrder      = 'default'; // 'default' | 'newest' | 'oldest'
  let datesLoaded    = false;

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
      // filterAndRender is called inside buildFilterBar with the first category

      // Read EXIF dates in background after gallery is displayed
      readExifDatesInBackground();

    } catch (err) {
      console.error('Gallery load error:', err);
      showError(err.message);
    }
  }

  function isImage(key) {
    return EXTENSIONS.includes(key.split('.').pop().toLowerCase());
  }

  function keyToPhoto(key) {
    const parts    = key.split('/');
    const category = parts.length > 1 ? parts[0] : 'uncategorised';
    const filename = parts[parts.length - 1];
    const name     = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const url      = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
    return { key, url, name, category };
  }

  // ---- Hero Slideshow ----
  let heroSlides = [];
  let heroIndex  = 0;

  function loadHeroSlides(keys) {
    if (!keys.length || !heroRight) return;
    heroSlides = keys;
    heroRight.querySelectorAll('.hero-slide').forEach(el => el.remove());
    if (heroDots) heroDots.innerHTML = '';

    keys.forEach((key, i) => {
      const url = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
      const img = document.createElement('img');
      img.className = 'hero-slide';
      img.src = url;
      img.alt = '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      heroRight.insertBefore(img, heroRight.querySelector('.hero-photo-overlay'));

      if (heroDots) {
        const dot = document.createElement('button');
        dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => heroGoTo(i));
        heroDots.appendChild(dot);
      }
    });

    heroRight.querySelectorAll('.hero-slide')[0].classList.add('active');
    if (keys.length > 1) setInterval(() => heroGoTo((heroIndex + 1) % heroSlides.length), 4000);
  }

  function heroGoTo(index) {
    const slides = heroRight.querySelectorAll('.hero-slide');
    const dots   = heroDots ? heroDots.querySelectorAll('.hero-dot') : [];
    slides[heroIndex].classList.remove('active');
    slides[heroIndex].classList.add('leaving');
    if (dots[heroIndex]) dots[heroIndex].classList.remove('active');
    heroIndex = index;
    void slides[heroIndex].offsetWidth;
    slides[heroIndex].classList.remove('leaving');
    slides[heroIndex].classList.add('active');
    if (dots[heroIndex]) dots[heroIndex].classList.add('active');
    setTimeout(() => slides.forEach(s => s.classList.remove('leaving')), 1400);
  }

  // ---- Filter Bar ----
  function buildFilterBar(photos) {
    if (!filterBar) return;
    const seen = new Set(), cats = [];
    photos.forEach(p => { if (!seen.has(p.category)) { seen.add(p.category); cats.push(p.category); } });
    if (cats.length <= 1) { filterBar.style.display = 'none'; return; }
    filterBar.innerHTML = '';
    // Show only category buttons — no "All" button
    cats.forEach((cat, i) => filterBar.appendChild(makeFilterBtn(cat.charAt(0).toUpperCase() + cat.slice(1).replace(/[-_]/g, ' '), cat, i === 0)));
    filterBar.style.display = 'flex';
    // Default to first category
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

  // ---- Sort ----
  function applySortOrder(photos) {
    const sorted = [...photos];
    if (sortOrder === 'newest') {
      sorted.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date - a.date;
      });
    } else if (sortOrder === 'oldest') {
      sorted.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date - b.date;
      });
    }
    return sorted;
  }

  async function readExifDatesInBackground() {
    if (!window.exifr) return;
    if (sortLoading) sortLoading.classList.add('visible');

    await Promise.allSettled(allPhotos.map(async photo => {
      try {
        const data = await window.exifr.parse(photo.url, ['DateTimeOriginal', 'CreateDate']);
        const raw  = data && (data.DateTimeOriginal || data.CreateDate);
        if (raw) photo.date = raw instanceof Date ? raw : new Date(raw);
      } catch (e) {
        // No EXIF date — photo stays at default position
      }
    }));

    datesLoaded = true;
    if (sortLoading) sortLoading.classList.remove('visible');

    // Re-render with dates if a date sort is active
    if (sortOrder !== 'default') reRender();
  }

  function reRender() {
    const base = currentCategory === 'all' || !currentCategory
      ? allPhotos
      : allPhotos.filter(p => p.category === currentCategory);
    filteredPhotos = applySortOrder(base);
    carouselIndex = 0;
    buildCarousel(filteredPhotos);
  }

  // Sort dropdown handler
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortOrder = sortSelect.value;
      if ((sortOrder === 'newest' || sortOrder === 'oldest') && !datesLoaded) {
        if (sortLoading) sortLoading.textContent = 'Reading dates…';
        if (sortLoading) sortLoading.classList.add('visible');
      }
      reRender();
    });
    sortSelect.addEventListener('mouseenter', () => setCursorHover(true));
    sortSelect.addEventListener('mouseleave', () => setCursorHover(false));
  }

  // ---- Filter & Render ----
  function filterAndRender(category) {
    currentCategory = category;
    const base = category === 'all' ? allPhotos : allPhotos.filter(p => p.category === category);
    filteredPhotos = applySortOrder(base);
    countEl.textContent = filteredPhotos.length + ' image' + (filteredPhotos.length !== 1 ? 's' : '');
    carouselIndex = 0;
    buildCarousel(filteredPhotos);
  }

  // ---- Carousel ----
  function buildCarousel(photos) {
    if (!carouselStage) return;
    carouselStage.innerHTML = '';
    if (carouselThumbs) carouselThumbs.innerHTML = '';

    photos.forEach((photo, i) => {
      // Slide
      const slide = document.createElement('div');
      slide.className = 'carousel-slide' + (i === 0 ? ' active' : '');
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(img);
      carouselStage.appendChild(slide);

      // Thumbnail
      if (carouselThumbs) {
        const thumb = document.createElement('img');
        thumb.className = 'carousel-thumb' + (i === 0 ? ' active' : '');
        thumb.src = photo.url;
        thumb.alt = photo.name;
        thumb.loading = 'lazy';
        thumb.addEventListener('click', () => goToSlide(i));
        thumb.addEventListener('mouseenter', () => setCursorHover(true));
        thumb.addEventListener('mouseleave', () => setCursorHover(false));
        carouselThumbs.appendChild(thumb);
      }
    });

    updateCaption();
  }

  function goToSlide(index) {
    const slides = carouselStage.querySelectorAll('.carousel-slide');
    const thumbs = carouselThumbs ? carouselThumbs.querySelectorAll('.carousel-thumb') : [];
    if (!slides.length) return;

    slides[carouselIndex].classList.remove('active');
    if (thumbs[carouselIndex]) thumbs[carouselIndex].classList.remove('active');

    carouselIndex = ((index % filteredPhotos.length) + filteredPhotos.length) % filteredPhotos.length;

    slides[carouselIndex].classList.add('active');
    if (thumbs[carouselIndex]) {
      thumbs[carouselIndex].classList.add('active');
      thumbs[carouselIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    updateCaption();
  }

  function updateCaption() {
    if (!filteredPhotos.length) return;
    const p = filteredPhotos[carouselIndex];
    if (carouselName) carouselName.textContent = p.name;
    if (carouselCat)  carouselCat.textContent  = p.category !== 'uncategorised' ? p.category.replace(/[-_]/g, ' ') : '';
    if (carouselCtr)  carouselCtr.textContent  = (carouselIndex + 1) + ' / ' + filteredPhotos.length;
  }

  if (carouselPrev) carouselPrev.addEventListener('click', () => goToSlide(carouselIndex - 1));
  if (carouselNext) carouselNext.addEventListener('click', () => goToSlide(carouselIndex + 1));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  goToSlide(carouselIndex - 1);
    if (e.key === 'ArrowRight') goToSlide(carouselIndex + 1);
  });

  // Touch swipe
  let touchStartX = 0;
  if (carouselStage) {
    carouselStage.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carouselStage.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goToSlide(diff > 0 ? carouselIndex + 1 : carouselIndex - 1);
    });
  }

  // ---- States ----
  function showEmpty() {
    if (carouselWrap) carouselWrap.style.display = 'none';
    if (grid) { grid.style.display = 'block'; grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\u25ce</div><h3>No photos yet</h3><p>Upload images to your R2 bucket and they\'ll appear here automatically.</p></div>'; }
    countEl.textContent = '0 images';
  }
  function showError(msg) {
    if (carouselWrap) carouselWrap.style.display = 'none';
    if (grid) { grid.style.display = 'block'; grid.innerHTML = '<div class="error-state"><p>Could not load photos.</p><p style="margin-top:8px;font-size:11px">' + msg + '</p><p style="margin-top:16px">Make sure your R2 bucket is <strong>public</strong> and the URL in <code>config.js</code> is correct.</p></div>'; }
    countEl.textContent = '—';
  }
  function showConfigBanner() {
    if (configBanner) configBanner.style.display = 'flex';
    if (carouselWrap) carouselWrap.style.display = 'none';
    countEl.textContent = '—';
  }

  init();

})();
