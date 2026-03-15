// ============================================================
//  GALLERY.JS — Dynamic photo loading from Cloudflare R2
//              with automatic folder-based categories
// ============================================================

(function () {
  'use strict';

  const cfg = window.PORTFOLIO_CONFIG || {};
  const BUCKET_URL = (cfg.R2_BUCKET_URL || '').replace(/\/$/, '');
  const EXTENSIONS = cfg.SUPPORTED_EXTENSIONS || ['jpg','jpeg','png','webp','avif'];

  // DOM refs
  const grid         = document.getElementById('galleryGrid');
  const countEl      = document.getElementById('photoCount');
  const configBanner = document.getElementById('configBanner');
  const filterBar    = document.getElementById('filterBar');
  const lightbox     = document.getElementById('lightbox');
  const lbImg        = document.getElementById('lightboxImg');
  const lbClose      = document.getElementById('lightboxClose');
  const lbPrev       = document.getElementById('lightboxPrev');
  const lbNext       = document.getElementById('lightboxNext');
  const lbCounter    = document.getElementById('lightboxCounter');
  const lbCategory   = document.getElementById('lightboxCategory');
  const yearEl       = document.getElementById('year');
  const cursor       = document.getElementById('cursor');
  const cursorRing   = document.getElementById('cursorRing');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Hero Slideshow ----
  const heroRight   = document.getElementById('heroRight');
  const heroDots    = document.getElementById('heroDots');
  const HERO_FOLDER = cfg.HERO_FOLDER || 'hero';
  const SLIDE_INTERVAL = 4000; // 4 seconds
  let heroSlides = [];
  let heroIndex  = 0;
  let heroTimer  = null;

  async function loadHeroSlides() {
    if (!BUCKET_URL) return;
    try {
      const res = await fetch('/api');
      if (!res.ok) return;
      const data = await res.json();
      const photos = (data.photos || []).filter(key => {
        const folder = key.split('/')[0];
        const ext = key.split('.').pop().toLowerCase();
        return folder === HERO_FOLDER && EXTENSIONS.includes(ext);
      });
      if (photos.length === 0) return;

      heroSlides = photos;
      buildHeroSlides();
      startHeroSlideshow();
    } catch (e) {
      console.warn('Hero slideshow load failed:', e);
    }
  }

  function buildHeroSlides() {
    // Remove any existing slides (keep overlay and dots)
    heroRight.querySelectorAll('.hero-slide').forEach(el => el.remove());
    heroDots.innerHTML = '';

    heroSlides.forEach((key, i) => {
      const url = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
      const img = document.createElement('img');
      img.className = 'hero-slide';
      img.src = url;
      img.alt = '';
      img.loading = i === 0 ? 'eager' : 'lazy';
      // Insert before the overlay
      heroRight.insertBefore(img, heroRight.querySelector('.hero-photo-overlay'));

      const dot = document.createElement('button');
      dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goToSlide(i));
      heroDots.appendChild(dot);
    });
  }

  function goToSlide(index) {
    const slides = heroRight.querySelectorAll('.hero-slide');
    const dots   = heroDots.querySelectorAll('.hero-dot');

    // Mark current as leaving
    slides[heroIndex].classList.remove('active');
    slides[heroIndex].classList.add('leaving');
    dots[heroIndex].classList.remove('active');

    heroIndex = index;

    // Force reflow so animation restarts
    slides[heroIndex].classList.remove('leaving');
    void slides[heroIndex].offsetWidth;
    slides[heroIndex].classList.add('active');
    dots[heroIndex].classList.add('active');

    // Clean up leaving class after transition
    setTimeout(() => {
      slides.forEach(s => s.classList.remove('leaving'));
    }, 1200);
  }

  function startHeroSlideshow() {
    if (heroSlides.length === 0) return;
    // Show first slide immediately
    const slides = heroRight.querySelectorAll('.hero-slide');
    if (slides[0]) slides[0].classList.add('active');

    if (heroSlides.length === 1) return; // No need to cycle

    heroTimer = setInterval(() => {
      const next = (heroIndex + 1) % heroSlides.length;
      goToSlide(next);
    }, SLIDE_INTERVAL);
  }

  loadHeroSlides();
  applyConfig();

  function applyConfig() {
    if (cfg.PHOTOGRAPHER_NAME) {
      document.title = cfg.PHOTOGRAPHER_NAME + ' — Portfolio';
      const logoEl = document.querySelector('.logo');
      if (logoEl) logoEl.innerHTML = '<span>' + cfg.PHOTOGRAPHER_NAME[0] + '</span>' + cfg.PHOTOGRAPHER_NAME.slice(1);
      const footerLeft = document.querySelector('footer span:first-child');
      if (footerLeft) footerLeft.innerHTML = '© ' + new Date().getFullYear() + ' ' + cfg.PHOTOGRAPHER_NAME;
    }
    if (cfg.HERO_EYEBROW) { const el = document.querySelector('.hero-eyebrow'); if (el) el.textContent = cfg.HERO_EYEBROW; }
    if (cfg.HERO_TITLE_LINE1 || cfg.HERO_TITLE_LINE2) {
      const el = document.querySelector('.hero-title');
      if (el) el.innerHTML = (cfg.HERO_TITLE_LINE1 || '') + '<br><em>' + (cfg.HERO_TITLE_LINE2 || '') + '</em>';
    }
    if (cfg.HERO_DESC) { const el = document.querySelector('.hero-desc'); if (el) el.textContent = cfg.HERO_DESC; }
    if (cfg.GRID_COLUMNS && grid) grid.style.columns = cfg.GRID_COLUMNS;
  }

  // ---- Cursor ----
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
  document.addEventListener('mousemove', (e) => {
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

  // ---- Data ----
  // allPhotos = [ { key, url, name, category } ]
  let allPhotos = [];
  let filteredPhotos = [];
  let activeCategory = 'all';
  let currentIndex = 0;

  // ---- Load Photos ----
  async function loadPhotos() {
    if (!BUCKET_URL) { showConfigBanner(); return; }
    showLoading();
    try {
      // Use the Pages Function to list photos server-side (avoids R2 public listing restrictions)
      const res = await fetch('/api');
      if (!res.ok) throw new Error('Could not load photo list (status ' + res.status + ')');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const photos = keysToPhotos(data.photos || []);
      if (photos.length === 0) { showEmpty(); return; }
      allPhotos = photos;
      buildFilterBar(photos);
      filterAndRender('all');
    } catch (err) {
      console.error('Gallery load error:', err);
      showError(err.message);
    }
  }

  function keysToPhotos(keys) {
    return keys
      .filter(key => {
        const ext = key.split('.').pop().toLowerCase();
        const folder = key.split('/')[0];
        // Exclude hero folder and hidden files from the gallery
        return EXTENSIONS.includes(ext) && !key.startsWith('.') && folder !== HERO_FOLDER;
      })
      .sort()
      .map(key => {
        const parts = key.split('/');
        const category = parts.length > 1 ? parts[0] : 'uncategorised';
        const filename = parts[parts.length - 1];
        const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const url = BUCKET_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
        return { key, url, name, category };
      });
  }

  // ---- Filter Bar ----
  function buildFilterBar(photos) {
    if (!filterBar) return;

    // Collect unique categories preserving order of first appearance
    const seen = new Set();
    const categories = [];
    photos.forEach(p => {
      if (!seen.has(p.category)) { seen.add(p.category); categories.push(p.category); }
    });

    // Only show filter bar if there's more than one category
    if (categories.length <= 1) { filterBar.style.display = 'none'; return; }

    filterBar.innerHTML = '';

    const allBtn = makeFilterBtn('All', 'all', true);
    filterBar.appendChild(allBtn);

    categories.forEach(cat => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/[-_]/g, ' ');
      filterBar.appendChild(makeFilterBtn(label, cat, false));
    });

    filterBar.style.display = 'flex';
  }

  function makeFilterBtn(label, value, active) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.dataset.category = value;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterAndRender(value);
    });
    btn.addEventListener('mouseenter', () => setCursorHover(true));
    btn.addEventListener('mouseleave', () => setCursorHover(false));
    return btn;
  }

  // ---- Filter & Render ----
  function filterAndRender(category) {
    activeCategory = category;
    filteredPhotos = category === 'all'
      ? allPhotos
      : allPhotos.filter(p => p.category === category);

    countEl.textContent = filteredPhotos.length + ' image' + (filteredPhotos.length !== 1 ? 's' : '');
    renderGallery(filteredPhotos);
  }

  function renderGallery(photos) {
    grid.innerHTML = '';

    photos.forEach((photo, i) => {
      const item = document.createElement('div');
      item.className = 'gallery-item';

      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = 'lazy';

      // Once image loads, set flex-basis from natural aspect ratio
      // so portrait images are narrow and landscape images are wide —
      // all at the same fixed row height
      img.addEventListener('load', () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const rowHeight = 320;
        item.style.flexBasis = Math.round(ratio * rowHeight) + 'px';
      });

      const overlay = document.createElement('div');
      overlay.className = 'gallery-item-overlay';
      overlay.innerHTML = `
        <span class="gallery-item-category">${photo.category === 'uncategorised' ? '' : photo.category}</span>
        <span class="gallery-item-name">${photo.name}</span>
      `;

      item.appendChild(img);
      item.appendChild(overlay);
      item.addEventListener('click', () => openLightbox(i));
      item.addEventListener('mouseenter', () => setCursorHover(true));
      item.addEventListener('mouseleave', () => setCursorHover(false));
      grid.appendChild(item);
    });

    // Staggered reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), idx * 55);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.04 });
    document.querySelectorAll('.gallery-item').forEach(el => observer.observe(el));
  }

  // ---- Lightbox ----
  function openLightbox(index) {
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const photo = filteredPhotos[currentIndex];
    lbImg.src = photo.url;
    lbImg.alt = photo.name;
    lbCounter.textContent = (currentIndex + 1) + ' / ' + filteredPhotos.length;
    if (lbCategory) {
      lbCategory.textContent = photo.category !== 'uncategorised'
        ? photo.category.charAt(0).toUpperCase() + photo.category.slice(1).replace(/[-_]/g, ' ')
        : '';
    }
  }

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => { currentIndex = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length; updateLightbox(); });
  lbNext.addEventListener('click', () => { currentIndex = (currentIndex + 1) % filteredPhotos.length; updateLightbox(); });
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') { currentIndex = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length; updateLightbox(); }
    if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % filteredPhotos.length; updateLightbox(); }
  });
  [lbClose, lbPrev, lbNext].forEach(el => {
    el.addEventListener('mouseenter', () => setCursorHover(true));
    el.addEventListener('mouseleave', () => setCursorHover(false));
  });

  // ---- States ----
  function showLoading() {
    grid.innerHTML = `<div class="loading-state" style="column-span:all"><div class="loading-dots"><span></span><span></span><span></span></div><p>Loading images…</p></div>`;
    countEl.textContent = '—';
  }
  function showEmpty() {
    grid.innerHTML = `<div class="empty-state" style="column-span:all"><div class="empty-state-icon">◎</div><h3>No photos yet</h3><p>Upload images to your Cloudflare R2 bucket and they'll appear here automatically. Use folders to create categories.</p></div>`;
    countEl.textContent = '0 images';
  }
  function showError(msg) {
    grid.innerHTML = `<div class="error-state" style="column-span:all"><p>Could not load photos.</p><p style="margin-top:8px;font-size:11px">${msg}</p><p style="margin-top:16px">Make sure your R2 bucket is set to <strong>public</strong> and the URL in <code>config.js</code> is correct.</p></div>`;
    countEl.textContent = '—';
  }
  function showConfigBanner() {
    if (configBanner) configBanner.style.display = 'flex';
    grid.innerHTML = `<div class="empty-state" style="column-span:all"><div class="empty-state-icon">◎</div><h3>Welcome to your portfolio</h3><p>Follow the steps in <strong>SETUP.md</strong> to connect your Cloudflare R2 bucket.</p></div>`;
    countEl.textContent = '—';
  }

  // ---- Init ----
  loadPhotos();

})();

