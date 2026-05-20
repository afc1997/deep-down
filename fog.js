/**
 * DEEP DOWN — SVG turbulence fog
 *
 * On load   : #fog-layer fades in from 0 → full over ~5s
 * Always    : each fog bank breathes independently via GSAP
 * Transition: GSAP fades #fog-transition overlay 0 → 1 → 0
 * Depth     : displacement scale grows as slides advance
 */

const fogSystem = (function () {

  const layer   = document.getElementById('fog-layer');
  const overlay = document.getElementById('fog-transition');
  const turb    = document.getElementById('fog-turb');
  const disp    = document.getElementById('fog-disp');
  const banks   = Array.from(document.querySelectorAll('.fog-bank'));

  let t         = 0;
  let baseDepth = 0;

  /* ── turbulence breathing ────────────────────────────── */
  /* Slowly oscillates baseFrequency so the fog texture
     shifts and swirls rather than sitting static.          */
  function breathe() {
    requestAnimationFrame(breathe);
    t += 0.00016;

    const bfx = (0.009  + Math.sin(t * 0.68)  * 0.0032).toFixed(5);
    const bfy = (0.006  + Math.cos(t * 0.51)  * 0.0021).toFixed(5);
    turb.setAttribute('baseFrequency', bfx + ' ' + bfy);

    /* displacement scale grows as the user descends slides */
    const scale = 180 + baseDepth * 95;
    disp.setAttribute('scale', scale.toFixed(1));
  }

  /* ── intro: fog rolls in from nothing ───────────────── */
  function intro() {
    /* layer starts at opacity:0 in CSS */
    gsap.to(layer, {
      opacity: 1,
      duration: 5.5,
      delay: 0.3,
      ease: 'power2.inOut',
    });
  }

  /* ── dance: each bank pulses independently ───────────── */
  /* Banks oscillate between a low and high opacity so the
     fog feels alive — like mist responding to unseen wind. */
  function dance() {
    const config = [
      /* duration  low   high  delay */
      [  11,      0.20,  1.0,  0.0  ],   /* b1 — slow, heavy */
      [  16,      0.20,  0.92, 2.5  ],   /* b2 — very slow   */
      [   8,      0.20,  1.0,  1.2  ],   /* b3 — faster wisp */
      [  20,      0.20,  0.85, 4.0  ],   /* b4 — the veil    */
    ];

    banks.forEach((bank, i) => {
      const [dur, lo, hi, delay] = config[i];
      gsap.fromTo(bank,
        { opacity: hi },
        {
          opacity: lo,
          duration: dur,
          delay,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        }
      );
    });
  }

  /* ── public API ──────────────────────────────────────── */

  /** 0–1  fades the transition overlay in (→1) then out (→0) */
  function setFogProgress(val) {
    overlay.style.opacity = val;
  }

  /** called each slide change — deepens fog distortion over time */
  function advanceCamera(index, total) {
    baseDepth = index / Math.max(total - 1, 1);
  }

  function init() {
    breathe();
    intro();
    dance();
  }

  return { init, setFogProgress, advanceCamera };

}());

document.addEventListener('DOMContentLoaded', fogSystem.init);
