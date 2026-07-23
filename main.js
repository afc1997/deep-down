/**
 * DEEP DOWN — section navigation
 *
 * Slides cross-dissolve: the outgoing slide fades out as the incoming
 * one fades in, driven purely by the CSS opacity transition on .slide.
 */

document.addEventListener('DOMContentLoaded', () => {

  const SLIDES   = Array.from(document.querySelectorAll('.slide'));
  const DOTS     = Array.from(document.querySelectorAll('.dot'));
  const TOTAL    = SLIDES.length;
  const counter  = document.getElementById('counter-current');
  const navHome  = document.getElementById('nav-home');
  const PB_DOTS  = Array.from(document.querySelectorAll('.pb-dot'));

  /* which section dot owns each slide index */
  const SLIDE_TO_SECTION = [0,1,2,2,2,3,4,4,4,4,4,5,5,5,6,6,7];

  const progressBar = document.getElementById('progress-bar');
  const topNav      = document.getElementById('top-nav');

  function updateProgress(idx) {
    const sec = SLIDE_TO_SECTION[idx] ?? 0;
    PB_DOTS.forEach((d, i) => d.classList.toggle('active', i === sec));
    progressBar.classList.toggle('visible', idx > 0);
    topNav.classList.toggle('visible', idx > 0);
  }

  /* clicking a section dot jumps to its first slide */
  PB_DOTS.forEach((d, i) => {
    d.addEventListener('click', () => {
      const firstSlide = SLIDE_TO_SECTION.indexOf(i);
      if (firstSlide !== -1) goTo(firstSlide);
    });
  });

  let current      = 0;
  let isTransiting = false;
  const XFADE_MS   = 700;   /* keep in step with the .slide opacity transition */

  /* ── GOTO ─────────────────────────────────────────────── */
  function goTo(next) {
    if (isTransiting || next === current || next < 0 || next >= TOTAL) return;
    isTransiting = true;

    const from = current;
    current = next;

    /* update dots + counter + nav section label */
    DOTS.forEach((d, i) => d.classList.toggle('active', i === current));
    counter.textContent = String(current + 1).padStart(2, '0');
    updateProgress(current);

    /* cross-dissolve: CSS handles the opacity fade on both slides */
    SLIDES[from].classList.remove('active');
    SLIDES[next].classList.add('active');

    setTimeout(() => { isTransiting = false; }, XFADE_MS);
  }

  /* ── INPUT: WHEEL ─────────────────────────────────────── */
  let wheelAccum = 0;
  let wheelReset;

  window.addEventListener('wheel', e => {
    e.preventDefault();
    wheelAccum += e.deltaY;
    clearTimeout(wheelReset);
    wheelReset = setTimeout(() => { wheelAccum = 0; }, 400);

    if (wheelAccum > 60) {
      goTo(current + 1);
      wheelAccum = 0;
    } else if (wheelAccum < -60) {
      goTo(current - 1);
      wheelAccum = 0;
    }
  }, { passive: false });

  /* ── INPUT: KEYBOARD ──────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown'  || e.key === 'ArrowRight' || e.key === ' ')   goTo(current + 1);
    if (e.key === 'ArrowUp'    || e.key === 'ArrowLeft')                      goTo(current - 1);
  });

  /* ── INPUT: NAV DOTS ──────────────────────────────────── */
  DOTS.forEach(dot => {
    dot.addEventListener('click', () => goTo(Number(dot.dataset.index)));
  });

  /* ── INPUT: TOUCH SWIPE ───────────────────────────────── */
  let touchStartY = 0;
  let touchStartX = 0;

  document.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', e => {
    const dY = touchStartY - e.changedTouches[0].clientY;
    const dX = touchStartX - e.changedTouches[0].clientX;
    /* only trigger if vertical swipe dominates */
    if (Math.abs(dY) > Math.abs(dX) && Math.abs(dY) > 45) {
      goTo(current + (dY > 0 ? 1 : -1));
    }
  }, { passive: true });

  /* ── NAV HOME button ─────────────────────────────────── */
  navHome.addEventListener('click', () => goTo(0));

  /* ── COUNTER total ────────────────────────────────────── */
  document.getElementById('counter-total').textContent =
    String(TOTAL).padStart(2, '0');

  /* ── LIGHTBOX ─────────────────────────────────────────── */
  const lightbox        = document.getElementById('lightbox');
  const lightboxIframe  = document.getElementById('lightbox-iframe');
  const lightboxClose   = document.getElementById('lightbox-close');
  const lightboxBdrop   = document.getElementById('lightbox-backdrop');

  function openLightbox(embedSrc) {
    lightboxIframe.src = embedSrc;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxIframe.src = '';
  }

  document.querySelectorAll('.work-thumb[data-vimeo-embed]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(btn.dataset.vimeoEmbed);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxBdrop.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  /* ── VIMEO THUMBNAILS (live from oEmbed) ──────────────── */
  document.querySelectorAll('.work-thumb[data-vimeo-oembed]').forEach(btn => {
    const url    = btn.dataset.vimeoOembed;
    const img    = btn.querySelector('.work-thumb-poster');
    const api    = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=1280`;
    fetch(api)
      .then(r => r.json())
      .then(data => {
        if (data.thumbnail_url) {
          /* request a larger size by replacing the dimension suffix */
          img.src = data.thumbnail_url.replace(/_\d+x\d+/, '_1280x720');
        }
      })
      .catch(() => {}); /* fail silently */
  });

});

