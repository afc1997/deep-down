/**
 * DEEP DOWN — World Navigation Engine
 *
 * Quinn explores a foggy Scottish village on a top-down 2D canvas map.
 * Walk to a location, press E or Enter to read the pitch deck content.
 *
 * Architecture:
 *   MapRenderer   – draws static world (terrain, paths, buildings, trees, well)
 *   AtmoSystem    – animated fog patches + rain on a second canvas
 *   Quinn         – character movement + rendering
 *   Camera        – smooth follow cam clamped to world bounds
 *   ZoneManager   – proximity detection + screen-space prompt
 *   ContentPanel  – slide content UI
 *   Engine        – main loop + input
 */

'use strict';

// ── WORLD SIZE ────────────────────────────────────────────────
const WW = 3400;   // world width
const WH = 2400;   // world height

// ── COLOUR PALETTE ────────────────────────────────────────────
const C = {
  bg:        '#02050a',
  moor:      '#07100a',
  moor2:     '#0b1a0e',
  path:      '#182118',
  pathDark:  '#0f170f',
  stone:     '#1c261e',
  roof:      '#0d1410',
  roofLine:  '#141d16',
  winGlow:   'rgba(210,148,50,',
  water:     '#060e0c',
  waterRim:  '#1a2e24',
  treeDark:  '#060e06',
  treeMid:   '#0c1a0b',
  quinnBody: '#ccc0aa',
  quinnHead: '#c0b49e',
  fog:       'rgba(128,162,118,',
  rain:      'rgba(160,195,150,',
};

// ── MAP DATA ──────────────────────────────────────────────────

// Paths: arrays of [x,y] waypoints connected as smooth curves
const PATHS = [
  // Main road from south entrance → village centre
  { pts: [[1700,2300],[1680,2050],[1600,1800],[1520,1540],[1400,1300]] },
  // Village centre → well (NW)
  { pts: [[1400,1300],[1200,1150],[1050,1020],[920,940]] },
  // Well → farmhouse (far NW)
  { pts: [[920,940],[680,720],[440,500],[260,330]] },
  // Well → church (NE)
  { pts: [[920,940],[1280,760],[1700,580],[2200,380],[2560,250]] },
  // Village centre → pub (E)
  { pts: [[1400,1300],[1700,1280],[2000,1160],[2280,1050]] },
  // Village square branching paths
  { pts: [[1520,1540],[1750,1560],[1980,1500],[2100,1420]] },
  { pts: [[1520,1540],[1260,1600],[1020,1660],[800,1740]] },
  // Road to contact (SW cliffs)
  { pts: [[800,1740],[600,1900],[400,2050],[240,2180]] },
];

const BUILDINGS = [
  // Farmhouse complex
  { id:'farmhouse',    x:160, y:240,  w:200, h:140, type:'house',  wins:[[22,32],[130,32],[22,92],[130,92]] },
  { id:'barn',         x:380, y:300,  w:140, h:100, type:'barn',   wins:[] },
  { id:'farmwall-n',   x:160, y:220,  w:360, h:10,  type:'wall',   wins:[] },
  { id:'farmwall-w',   x:150, y:220,  w:10,  h:200, type:'wall',   wins:[] },

  // Church
  { id:'church',       x:2530,y:130,  w:110, h:200, type:'church', wins:[[38,50],[38,120]] },
  { id:'church-nave',  x:2490,y:270,  w:190, h:110, type:'church', wins:[[22,30],[130,30]] },

  // Pub / Black Mare Inn
  { id:'pub',          x:2220,y:980,  w:220, h:130, type:'pub',    wins:[[22,28],[84,28],[148,28],[22,80],[148,80]] },
  { id:'pub-stable',   x:2220,y:1120, w:100, h:70,  type:'barn',   wins:[] },

  // Village cottages
  { id:'cot1',         x:1680,y:1490, w:100, h:75,  type:'house',  wins:[[16,20],[62,20]] },
  { id:'cot2',         x:1840,y:1420, w:90,  h:70,  type:'house',  wins:[[16,20],[54,20]] },
  { id:'cot3',         x:1230,y:1560, w:85,  h:65,  type:'house',  wins:[[16,20]] },
  { id:'cot4',         x:2000,y:1390, w:80,  h:60,  type:'house',  wins:[[14,18]] },

  // Cliff-side cottage (contact area)
  { id:'cliffcot',     x:200, y:2100, w:100, h:80,  type:'house',  wins:[[14,20],[62,20]] },
];

const WELL = { x:920, y:940, r:34 };

// Tree clusters: {x,y,count,spread,rMin,rMax}
const TREES = [
  { x:100,  y:600,  count:14, spread:130, rMin:18, rMax:36 },
  { x:300,  y:180,  count:8,  spread:80,  rMin:14, rMax:28 },
  { x:100,  y:1100, count:10, spread:90,  rMin:16, rMax:30 },
  { x:650,  y:200,  count:6,  spread:60,  rMin:12, rMax:24 },
  { x:2700, y:150,  count:12, spread:110, rMin:18, rMax:34 },
  { x:2900, y:480,  count:9,  spread:90,  rMin:16, rMax:30 },
  { x:3200, y:800,  count:8,  spread:80,  rMin:14, rMax:28 },
  { x:500,  y:1600, count:7,  spread:70,  rMin:14, rMax:26 },
  { x:3000, y:1600, count:8,  spread:80,  rMin:14, rMax:28 },
  { x:1100, y:400,  count:5,  spread:50,  rMin:12, rMax:22 },
  { x:1800, y:250,  count:5,  spread:50,  rMin:12, rMax:22 },
  { x:900,  y:2100, count:6,  spread:60,  rMin:12, rMax:24 },
  { x:2600, y:2100, count:5,  spread:60,  rMin:12, rMax:22 },
  { x:3200, y:2200, count:9,  spread:90,  rMin:14, rMax:28 },
];

// Interactive zones (Quinn proximity triggers)
const ZONES = [
  { id:'well',      x:920,  y:940,  r:140, label:'The Well',          content:'well'      },
  { id:'farmhouse', x:300,  y:320,  r:180, label:'Farmhouse',         content:'farmhouse' },
  { id:'church',    x:2620, y:340,  r:180, label:"St. Cormac's Kirk", content:'church'    },
  { id:'pub',       x:2340, y:1040, r:180, label:'The Black Mare',    content:'pub'       },
  { id:'village',   x:1700, y:1560, r:220, label:'Village Square',    content:'about'     },
  { id:'contact',   x:320,  y:2160, r:180, label:'The Road Out',      content:'contact'   },
];

// ── CONTENT DATA ──────────────────────────────────────────────
const CONTENT = {
  well: [
    {
      tag: 'Logline',
      body: `<p class="panel-quote">An Irish expat in the Scottish Highlands falls into obsession when he discovers an ancient well on his girlfriend's family farm — and begins to hear it speak.</p>`,
    },
    {
      tag: 'Synopsis',
      body: `<p class="panel-body">Quinn arrives in a coastal village outside Inverness with nothing but a duffel bag and an invitation he probably shouldn't have accepted. Fiona's family farm is quiet, old, and strange. Her father Godfrey watches everything without speaking. Her brother Colin hasn't looked Quinn in the eye since he arrived.</p>`,
    },
    {
      tag: 'Synopsis',
      body: `<p class="panel-quote">Visions begin to plague him — a woman at the bottom of the well, still as stone, staring up at him.</p>`,
    },
    {
      tag: 'Synopsis',
      body: `<p class="panel-body">The visions bleed into daylight. When Quinn confides in the local priest, the man goes pale and tells him to leave before nightfall. But Quinn doesn't leave. He lowers himself into the dark, hand over hand, further down than the well should go — and what he finds there will undo every certainty he has left.</p>`,
    },
  ],
  farmhouse: [
    {
      tag: 'Characters',
      charName: 'Quinn',
      body: `<p class="panel-body">Quinn operates through charm and neediness in equal measure. He works hard, drinks harder, and looks at things he shouldn't. He's running from whatever happened on that Edinburgh street. The well is the first honest thing he's found.</p>`,
    },
    {
      tag: 'Characters',
      charName: 'Colin',
      body: `<p class="panel-body">Fiona's older brother. Knows the land. Doesn't want Quinn here and doesn't pretend otherwise. Not cruel — just clear. Something happened years ago at the well and he has never spoken of it.</p>`,
    },
    {
      tag: 'Characters',
      charName: 'Fiona',
      body: `<p class="panel-body">Light brown hair, big hazel eyes. Unmistakably beautiful. She works the pub, hauls the deliveries alone down the road, lives two doors down from the bar her mother runs. She's never been anywhere else and she knows exactly what that means.</p>`,
    },
    {
      tag: 'Characters',
      charName: 'Siren',
      body: `<p class="panel-body">She is seen at the bottom of the well. Her eyes are open. She does not appear afraid. Whether she is a vision, a memory, a spirit, or something worse is a question the film does not answer easily.</p>`,
    },
    {
      tag: 'Characters',
      charName: 'Godfrey',
      body: `<p class="panel-body">Fiona's father. Built the farm by hand. Speaks in long silences. Something broke in him years ago and the break healed crooked. He feeds the animals, mends the fences, and sleeps beside the well.</p>`,
    },
  ],
  church: [
    {
      tag: 'Theme',
      body: `<p class="panel-quote">What does it mean to be called somewhere — and to answer?</p>`,
    },
    {
      tag: 'Theme',
      body: `<p class="panel-body">DEEP DOWN is a film about the particular madness of longing — the way a place, a person, or a wound can pull a man toward his own undoing. Quinn doesn't fall into the well because he is weak. He falls because the well is the only thing that has ever spoken directly to him.</p><p class="panel-body">We are interested in dread as a spiritual state. Not horror — dread. The weight of something coming that cannot be named or stopped. A faith in reverse.</p>`,
    },
  ],
  pub: [
    {
      tag: 'Camera',
      body: `<p class="panel-body">Anamorphic. Tight focal lengths in close quarters. The landscape earns wide when Quinn earns distance — which is rare. We shoot the Highlands as weight, not beauty. Sky and moor that press down rather than open up.</p>`,
    },
    {
      tag: 'Production Design',
      body: `<p class="panel-body">The farm is pre-modern and functional. Nothing decorative. Stone, wool, cast iron. The pub is the one warm room in the film and even there, warmth is borrowed. The well is the only designed element — its stonework is older than anything else on the property.</p>`,
    },
    {
      tag: 'Music',
      body: `<p class="panel-body">Scottish and Irish folk instrumentation — uilleann pipes, fiddle, bodhrán — played against their grain. Slow. Sometimes a single note held until it becomes the sound of the film itself.</p>`,
    },
    {
      tag: 'Sound Design',
      body: `<p class="panel-body">The well has a frequency. Low, sub-bass, felt rather than heard. It appears before Quinn is aware of the well. It grows. By the third act it is indistinguishable from silence.</p>`,
    },
    {
      tag: 'Editing',
      body: `<p class="panel-body">Slow. Unafraid of duration. Cuts that withhold as often as they reveal. We want the audience to feel the weight of each scene before we release them from it.</p>`,
    },
  ],
  about: [
    {
      tag: 'Fisherman & Trout',
      body: `<p class="panel-body">Alex Fischman Cárdenas and Trout Cohen are a writer-director duo who met at a urinal on their first day at NYU. Their work has earned Vimeo Staff Picks and screened at Sundance, Clermont-Ferrand, Sitges, and AFI Fest.</p>`,
    },
    {
      tag: 'Selected Work',
      body: `
        <div class="panel-work">
          <p class="panel-work-title">¡PIKA! (The Itch)</p>
          <p class="panel-work-meta">2025 · Sundance · Sitges</p>
        </div>
        <div class="panel-work">
          <p class="panel-work-title">Ovejas y Lobos</p>
          <p class="panel-work-meta">2024 · Clermont-Ferrand · AFI Fest</p>
        </div>
      `,
    },
  ],
  contact: [
    {
      tag: 'Contact',
      body: `
        <div class="panel-contact-group">
          <p class="panel-contact-agency">WME</p>
          <p class="panel-contact-name">Marco Alvarez</p>
          <p class="panel-contact-email">MAlvarez@wmeagency.com</p>
        </div>
        <div class="panel-contact-group">
          <p class="panel-contact-agency">Industry Entertainment</p>
          <p class="panel-contact-name">Keith Addis</p>
          <p class="panel-contact-email">kaddis@industryentertainment.com</p>
        </div>
        <div class="panel-contact-group">
          <p class="panel-contact-agency">Direct</p>
          <p class="panel-contact-name">Alex Fischman Cárdenas</p>
          <p class="panel-contact-email">alexfischmancardenas@gmail.com</p>
          <p class="panel-contact-name" style="margin-top:0.4rem">Trout Cohen</p>
          <p class="panel-contact-email">troutcohen@gmail.com</p>
        </div>
      `,
    },
  ],
};

// ── SEEDED RNG ────────────────────────────────────────────────
class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = Math.imul(1664525, this.s) + 1013904223 >>> 0;
    return this.s / 4294967296;
  }
}

// ── MAP RENDERER ──────────────────────────────────────────────
class MapRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = new RNG(7);
    this._buildStaticGeometry();
  }

  _buildStaticGeometry() {
    const r = this.rng;

    // Pre-generate grass tufts
    this.grass = Array.from({ length: 1200 }, () => ({
      wx: r.next() * WW,
      wy: r.next() * WH,
      angle: r.next() * Math.PI * 2,
      len:   4 + r.next() * 10,
      op:    0.04 + r.next() * 0.09,
    }));

    // Pre-generate scattered stones
    this.stones = Array.from({ length: 300 }, () => ({
      wx: r.next() * WW,
      wy: r.next() * WH,
      rx: 3 + r.next() * 8,
      ry: 2 + r.next() * 4,
      op: 0.04 + r.next() * 0.07,
    }));

    // Expand tree clusters into individual dots
    this.treeDots = [];
    for (const cl of TREES) {
      for (let i = 0; i < cl.count; i++) {
        const ang  = r.next() * Math.PI * 2;
        const dist = r.next() * cl.spread;
        this.treeDots.push({
          wx: cl.x + Math.cos(ang) * dist,
          wy: cl.y + Math.sin(ang) * dist,
          rad: cl.rMin + r.next() * (cl.rMax - cl.rMin),
        });
      }
    }
    this.treeDots.sort((a, b) => a.wy - b.wy); // painter sort
  }

  draw(cx, cy, vw, vh) {
    const ctx = this.ctx;
    const tx = wx => wx - cx;
    const ty = wy => wy - cy;

    // ── Ground ───────────────────────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, vw, vh);

    // Soft moor radial
    const mg = ctx.createRadialGradient(vw/2,vh/2, 0, vw/2,vh/2, Math.max(vw,vh)*0.85);
    mg.addColorStop(0, 'rgba(11,28,14,0.5)');
    mg.addColorStop(1, 'rgba(2,5,3,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, vw, vh);

    // ── Grass tufts ──────────────────────────────────────────
    for (const g of this.grass) {
      const sx = tx(g.wx), sy = ty(g.wy);
      if (sx < -20 || sx > vw+20 || sy < -20 || sy > vh+20) continue;
      ctx.strokeStyle = `rgba(18,32,16,${g.op})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(g.angle)*g.len, sy + Math.sin(g.angle)*g.len);
      ctx.stroke();
    }

    // ── Stones ───────────────────────────────────────────────
    for (const s of this.stones) {
      const sx = tx(s.wx), sy = ty(s.wy);
      if (sx < -20 || sx > vw+20 || sy < -20 || sy > vh+20) continue;
      ctx.fillStyle = `rgba(28,42,26,${s.op})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, s.rx, s.ry, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // ── Paths ────────────────────────────────────────────────
    this._drawPaths(tx, ty);

    // ── Trees (back — wy < 1400) ─────────────────────────────
    this._drawTrees(tx, ty, vw, vh, false);

    // ── Buildings ────────────────────────────────────────────
    this._drawBuildings(tx, ty);

    // ── Well ─────────────────────────────────────────────────
    this._drawWell(tx, ty);

    // ── Trees (front — wy >= 1400) ───────────────────────────
    this._drawTrees(tx, ty, vw, vh, true);

    // ── Edge vignette ────────────────────────────────────────
    const vig = ctx.createRadialGradient(vw/2,vh/2, vh*0.18, vw/2,vh/2, Math.max(vw,vh)*0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(1,3,1,0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, vw, vh);
  }

  _drawPaths(tx, ty) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of PATHS) {
      const pts = path.pts;

      // Outer edge (darker, slightly wider)
      ctx.strokeStyle = C.pathDark;
      ctx.lineWidth = 32;
      this._strokeCurve(ctx, pts, tx, ty);

      // Inner surface
      ctx.strokeStyle = C.path;
      ctx.lineWidth = 24;
      this._strokeCurve(ctx, pts, tx, ty);
    }
    ctx.restore();
  }

  _strokeCurve(ctx, pts, tx, ty) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i-1], q = pts[i];
      const mx = (tx(p[0]) + tx(q[0])) / 2;
      const my = (ty(p[1]) + ty(q[1])) / 2;
      ctx.quadraticCurveTo(tx(p[0]), ty(p[1]), mx, my);
    }
    const last = pts[pts.length-1];
    ctx.lineTo(tx(last[0]), ty(last[1]));
    ctx.stroke();
  }

  _drawBuildings(tx, ty) {
    const ctx = this.ctx;

    for (const b of BUILDINGS) {
      if (b.type === 'wall') {
        ctx.fillStyle = 'rgba(28,38,28,0.8)';
        ctx.fillRect(tx(b.x), ty(b.y), b.w, b.h);
        continue;
      }

      const sx = tx(b.x), sy = ty(b.y);
      const w = b.w, h = b.h;

      // Outer stone wall
      ctx.fillStyle = C.stone;
      ctx.fillRect(sx, sy, w, h);

      // Roof surface
      ctx.fillStyle = C.roof;
      ctx.fillRect(sx+7, sy+7, w-14, h-14);

      // Roof ridge lines
      ctx.strokeStyle = C.roofLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx+7, sy+7); ctx.lineTo(sx+w-7, sy+h-7);
      ctx.moveTo(sx+w-7, sy+7); ctx.lineTo(sx+7, sy+h-7);
      ctx.stroke();

      // Windows
      for (const [wx, wy] of b.wins) {
        const wsx = sx+wx, wsy = sy+wy;
        // Warm glow spread
        const glow = ctx.createRadialGradient(wsx+4,wsy+5,0, wsx+4,wsy+5,22);
        glow.addColorStop(0, `${C.winGlow}0.18)`);
        glow.addColorStop(1, `${C.winGlow}0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(wsx-18, wsy-18, 44, 44);
        // Window pane
        ctx.fillStyle = `${C.winGlow}0.75)`;
        ctx.fillRect(wsx, wsy, 8, 11);
      }

      // Wall border
      ctx.strokeStyle = 'rgba(42,58,40,0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, w, h);
    }

    // Church spire
    const ch = BUILDINGS.find(b => b.id === 'church');
    if (ch) {
      const sx = tx(ch.x + ch.w/2), sy = ty(ch.y);
      ctx.fillStyle = C.roof;
      ctx.beginPath();
      ctx.moveTo(sx, sy-36);
      ctx.lineTo(sx-18, sy);
      ctx.lineTo(sx+18, sy);
      ctx.closePath();
      ctx.fill();
      // Cross
      ctx.strokeStyle = 'rgba(48,64,44,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy-34); ctx.lineTo(sx, sy-12);
      ctx.moveTo(sx-8, sy-24); ctx.lineTo(sx+8, sy-24);
      ctx.stroke();
    }
  }

  _drawWell(tx, ty) {
    const ctx = this.ctx;
    const sx = tx(WELL.x), sy = ty(WELL.y);
    const r  = WELL.r;

    // Eerie ambient glow
    const glow = ctx.createRadialGradient(sx,sy,0, sx,sy,r*5.5);
    glow.addColorStop(0, 'rgba(50,110,70,0.1)');
    glow.addColorStop(1, 'rgba(30,80,50,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx,sy,r*5.5,0,Math.PI*2);
    ctx.fill();

    // Stone rim fill
    ctx.fillStyle = 'rgba(20,38,26,0.85)';
    ctx.beginPath();
    ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fill();

    // Stone rim edge
    ctx.strokeStyle = C.waterRim;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.stroke();

    // Dark water inside
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.arc(sx,sy,r-10,0,Math.PI*2);
    ctx.fill();

    // Water shimmer rings
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(50,120,80,${0.06 - i*0.015})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx,sy,(r-12)*(0.3 + i*0.3),0,Math.PI*2);
      ctx.stroke();
    }

    // Stone blocks around rim
    for (let i = 0; i < 14; i++) {
      const ang = (i/14)*Math.PI*2;
      ctx.fillStyle = 'rgba(34,52,40,0.7)';
      ctx.beginPath();
      ctx.arc(sx+Math.cos(ang)*r, sy+Math.sin(ang)*r, 4, 0, Math.PI*2);
      ctx.fill();
    }
  }

  _drawTrees(tx, ty, vw, vh, front) {
    const ctx = this.ctx;
    for (const t of this.treeDots) {
      const isFront = t.wy >= 1400;
      if (isFront !== front) continue;
      const sx = tx(t.wx), sy = ty(t.wy);
      if (sx < -(t.rad*2) || sx > vw+(t.rad*2) || sy < -(t.rad*2) || sy > vh+(t.rad*2)) continue;

      // Ground shadow
      ctx.fillStyle = 'rgba(1,4,1,0.45)';
      ctx.beginPath();
      ctx.ellipse(sx+5, sy+t.rad*0.25, t.rad*0.85, t.rad*0.28, 0, 0, Math.PI*2);
      ctx.fill();

      // Canopy
      const cg = ctx.createRadialGradient(sx-t.rad*0.2, sy-t.rad*0.2, 0, sx, sy, t.rad);
      cg.addColorStop(0, C.treeMid);
      cg.addColorStop(1, C.treeDark);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(sx, sy, t.rad, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

// ── ATMOSPHERE SYSTEM ─────────────────────────────────────────
class AtmoSystem {
  constructor(canvas) {
    this.c   = canvas;
    this.ctx = canvas.getContext('2d');
    this.t   = 0;
    this.fog = this._mkFog();
    this.rain = this._mkRain();
  }

  _mkFog() {
    return Array.from({ length: 14 }, () => ({
      wx:    Math.random() * WW,
      wy:    Math.random() * WH,
      r:     280 + Math.random() * 480,
      vx:    (Math.random()-0.5) * 0.18,
      vy:    (Math.random()-0.5) * 0.08,
      op:    0.04 + Math.random() * 0.09,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  _mkRain() {
    return Array.from({ length: 340 }, () => ({
      x:    Math.random() * window.innerWidth,
      y:    Math.random() * window.innerHeight,
      len:  9  + Math.random() * 18,
      spd:  3.5 + Math.random() * 4,
      op:   0.03 + Math.random() * 0.07,
    }));
  }

  update(dt) {
    this.t += dt;
    for (const f of this.fog) {
      f.wx += f.vx; f.wy += f.vy;
      if (f.wx < -f.r) f.wx = WW + f.r;
      if (f.wx > WW+f.r) f.wx = -f.r;
      if (f.wy < -f.r) f.wy = WH + f.r;
      if (f.wy > WH+f.r) f.wy = -f.r;
    }
    for (const d of this.rain) {
      d.y += d.spd; d.x -= d.spd * 0.22;
      if (d.y > this.c.height + d.len) {
        d.y = -d.len;
        d.x = Math.random() * this.c.width;
      }
    }
  }

  draw(camX, camY) {
    const ctx = this.ctx;
    const vw = this.c.width, vh = this.c.height;
    ctx.clearRect(0, 0, vw, vh);

    // Fog patches
    for (const f of this.fog) {
      const sx = f.wx - camX, sy = f.wy - camY;
      if (sx < -f.r*1.5 || sx > vw+f.r*1.5 || sy < -f.r*1.5 || sy > vh+f.r*1.5) continue;
      const pulse = 1 + Math.sin(this.t*0.28 + f.phase) * 0.14;
      const rr = f.r * pulse;
      const fg = ctx.createRadialGradient(sx,sy,0, sx,sy,rr);
      fg.addColorStop(0,   `${C.fog}${f.op})`);
      fg.addColorStop(0.5, `${C.fog}${f.op*0.5})`);
      fg.addColorStop(1,   `${C.fog}0)`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rr, rr*0.55, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Edge fog (always heavier at screen margins)
    const ef = ctx.createRadialGradient(vw/2,vh/2, vh*0.14, vw/2,vh/2, Math.max(vw,vh)*0.82);
    ef.addColorStop(0,   'rgba(70,100,60,0)');
    ef.addColorStop(0.65,'rgba(70,100,60,0.04)');
    ef.addColorStop(1,   'rgba(50,80,42,0.22)');
    ctx.fillStyle = ef;
    ctx.fillRect(0, 0, vw, vh);

    // Rain
    ctx.save();
    for (const d of this.rain) {
      ctx.strokeStyle = `${C.rain}${d.op})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len*0.22, d.y + d.len);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── QUINN ─────────────────────────────────────────────────────
class Quinn {
  constructor() {
    this.wx    = 1700;    // world position
    this.wy    = 2200;
    this.speed = 240;     // world units / second
    this.bob   = 0;
    this.moving = false;
  }

  update(dt, keys, panelOpen) {
    if (panelOpen) return;

    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx += 1;
    if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) dy -= 1;
    if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) dy += 1;

    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    this.moving = (dx !== 0 || dy !== 0);
    if (this.moving) {
      this.bob += dt * 9;
      this.wx = Math.max(20, Math.min(WW-20, this.wx + dx * this.speed * dt));
      this.wy = Math.max(20, Math.min(WH-20, this.wy + dy * this.speed * dt));
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.wx - camX;
    const sy = this.wy - camY;
    const bob = this.moving ? Math.sin(this.bob) * 1.8 : 0;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(sx, sy+11, 7, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // Subtle lantern glow around Quinn
    const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 32);
    gl.addColorStop(0, 'rgba(190,180,160,0.07)');
    gl.addColorStop(1, 'rgba(190,180,160,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(sx, sy, 32, 0, Math.PI*2);
    ctx.fill();

    // Body (coat)
    ctx.fillStyle = C.quinnBody;
    ctx.beginPath();
    // Use roundRect if available, else fillRect
    if (ctx.roundRect) {
      ctx.roundRect(sx-5, sy-2+bob, 10, 14, [3,3,2,2]);
    } else {
      ctx.rect(sx-5, sy-2+bob, 10, 14);
    }
    ctx.fill();

    // Head
    ctx.fillStyle = C.quinnHead;
    ctx.beginPath();
    ctx.arc(sx, sy-9+bob, 6, 0, Math.PI*2);
    ctx.fill();
  }

  screenPos(camX, camY) {
    return { x: this.wx - camX, y: this.wy - camY };
  }
}

// ── CAMERA ───────────────────────────────────────────────────
class Camera {
  constructor() { this.x = 0; this.y = 0; }

  follow(quinn, vw, vh) {
    const tx = Math.max(0, Math.min(WW-vw, quinn.wx - vw/2));
    const ty = Math.max(0, Math.min(WH-vh, quinn.wy - vh/2));
    this.x += (tx - this.x) * 0.09;
    this.y += (ty - this.y) * 0.09;
  }
}

// ── ZONE MANAGER ─────────────────────────────────────────────
class ZoneManager {
  constructor() {
    this.prompt  = document.getElementById('loc-prompt');
    this.nameEl  = document.getElementById('loc-name');
    this.active  = null;
  }

  update(quinn, camX, camY) {
    let nearest = null, nearestD = Infinity;
    for (const z of ZONES) {
      const d = Math.hypot(quinn.wx - z.x, quinn.wy - z.y);
      if (d < z.r && d < nearestD) { nearest = z; nearestD = d; }
    }
    this.active = nearest;

    if (nearest) {
      const sp = quinn.screenPos(camX, camY);
      this.prompt.style.left = sp.x + 'px';
      this.prompt.style.top  = sp.y + 'px';
      this.nameEl.textContent = nearest.label;
      this.prompt.classList.add('visible');
    } else {
      this.prompt.classList.remove('visible');
    }
  }
}

// ── CONTENT PANEL ─────────────────────────────────────────────
class ContentPanel {
  constructor() {
    this.el      = document.getElementById('content-panel');
    this.body    = document.getElementById('content-body');
    this.counter = document.getElementById('slide-counter');
    this.btnClose= document.getElementById('btn-close');
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.slides  = [];
    this.idx     = 0;
    this.open    = false;

    this.btnClose.addEventListener('click', () => this.close());
    this.btnPrev.addEventListener('click',  () => this.nav(-1));
    this.btnNext.addEventListener('click',  () => this.nav(1));
  }

  show(key) {
    this.slides = CONTENT[key] || [];
    this.idx    = 0;
    this._render();
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    this.open = true;
  }

  close() {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    this.open = false;
  }

  nav(dir) {
    this.idx = Math.max(0, Math.min(this.slides.length-1, this.idx+dir));
    this._render();
  }

  _render() {
    const s = this.slides[this.idx];
    if (!s) return;
    let html = `<p class="panel-tag">${s.tag}</p>`;
    if (s.charName) html += `<p class="panel-char-name">${s.charName}</p>`;
    html += s.body;
    this.body.innerHTML = html;
    this.counter.textContent = `${String(this.idx+1).padStart(2,'0')} / ${String(this.slides.length).padStart(2,'0')}`;
    this.btnPrev.disabled = this.idx === 0;
    this.btnNext.disabled = this.idx === this.slides.length - 1;
  }
}

// ── ENGINE ────────────────────────────────────────────────────
class Engine {
  constructor() {
    this.mapCanvas  = document.getElementById('map-canvas');
    this.mapCtx     = this.mapCanvas.getContext('2d');
    this.atmoCanvas = document.getElementById('atmo-canvas');
    this.renderer   = new MapRenderer(this.mapCtx);
    this.atmo       = new AtmoSystem(this.atmoCanvas);
    this.quinn      = new Quinn();
    this.camera     = new Camera();
    this.zones      = new ZoneManager();
    this.panel      = new ContentPanel();
    this.keys       = new Set();
    this.last       = 0;

    this._resize();
    this._bindInput();
    window.addEventListener('resize', () => this._resize());

    this._dismissTitle();
  }

  _dismissTitle() {
    const t = document.getElementById('title-screen');
    const dismiss = () => {
      gsap.to(t, {
        opacity: 0, duration: 1.4, ease: 'power2.inOut',
        onComplete: () => { t.style.display = 'none'; },
      });
      t.removeEventListener('click', dismiss);
    };
    // Auto-dismiss after 4 s, or on any interaction
    const tid = setTimeout(dismiss, 4000);
    const early = () => { clearTimeout(tid); dismiss(); };
    window.addEventListener('keydown', early, { once: true });
    t.addEventListener('click', dismiss);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.mapCanvas.width   = w; this.mapCanvas.height  = h;
    this.atmoCanvas.width  = w; this.atmoCanvas.height = h;
  }

  _bindInput() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);

      // Suppress arrow scrolling when walking
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }

      // Panel navigation
      if (this.panel.open) {
        if (e.key === 'ArrowLeft')  this.panel.nav(-1);
        if (e.key === 'ArrowRight') this.panel.nav(1);
        if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') this.panel.close();
        return;
      }

      // Open zone
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && this.zones.active) {
        this.panel.show(this.zones.active.content);
      }

      if (e.key === 'Escape') this.panel.close();
    });

    window.addEventListener('keyup', e => this.keys.delete(e.key));
  }

  start() {
    requestAnimationFrame(t => this._loop(t));
  }

  _loop(ts) {
    const dt = Math.min((ts - this.last) / 1000, 0.05);
    this.last = ts;

    const vw = this.mapCanvas.width, vh = this.mapCanvas.height;

    // Update
    this.quinn.update(dt, this.keys, this.panel.open);
    this.camera.follow(this.quinn, vw, vh);
    this.atmo.update(dt);
    this.zones.update(this.quinn, this.camera.x, this.camera.y);

    // Render map + Quinn on same canvas
    this.renderer.draw(this.camera.x, this.camera.y, vw, vh);
    this.quinn.draw(this.mapCtx, this.camera.x, this.camera.y);

    // Render atmosphere on top canvas
    this.atmo.draw(this.camera.x, this.camera.y);

    requestAnimationFrame(t => this._loop(t));
  }
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const engine = new Engine();
  engine.start();
});
