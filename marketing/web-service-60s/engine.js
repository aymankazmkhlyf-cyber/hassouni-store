// Deterministic motion engine: window.render(t) sets every element for time t (seconds).
// Elements declare animations with data attributes; sound cues (data-sfx) are read by the
// audio composer from this same HTML, so picture and sound stay in sync.
const clamp = (x) => Math.max(0, Math.min(1, x));
const outCubic = (x) => 1 - Math.pow(1 - x, 3);
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const rand = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const DURATION = +document.body.dataset.dur;
const $$ = (s) => [...document.querySelectorAll(s)];

const IN = {
  // big impact title: from huge + blurred to crisp
  slam: (p, r) => ({ tr: `scale(${1 + (1 - outExpo(r)) * 1.6})`, f: `blur(${(1 - outExpo(r)) * 22}px)`, o: clamp(r * 3) }),
  fade: (p) => ({ o: p }),
  // text revealed by a moving mask (line rises inside its own box)
  rise: (p) => ({ tr: `translateY(${(1 - p) * 110}%)`, clip: true, o: 1 }),
  wipe: (p) => ({ cp: `inset(0 0 0 ${(1 - p) * 100}%)`, o: 1 }),
  wipel: (p) => ({ cp: `inset(0 ${(1 - p) * 100}% 0 0)`, o: 1 }),
  circle: (p) => ({ cp: `circle(${p * 150}% at 50% 50%)`, o: 1 }),
  flip: (p) => ({ tr: `perspective(1800px) rotateY(${(1 - p) * -78}deg) translateZ(${(1 - p) * -300}px)`, o: clamp(p * 2) }),
  tilt: (p) => ({ tr: `perspective(2000px) rotateX(${(1 - p) * 40}deg) rotateY(${(1 - p) * 18}deg) translateY(${(1 - p) * 500}px)`, o: clamp(p * 2) }),
  pop: (p, r) => ({ tr: `scale(${r < 1 ? 0.2 + 0.8 * backOut(r) : 1})`, o: clamp(r * 4) }),
  up: (p) => ({ tr: `translateY(${(1 - p) * 90}px)`, o: p }),
  side: (p) => ({ tr: `translateX(${(1 - p) * 260}px)`, o: p }),
  sidel: (p) => ({ tr: `translateX(${(1 - p) * -260}px)`, o: p }),
  drop: (p, r) => ({ tr: `translateY(${(1 - outCubic(r)) * -160}px) scale(${1 + (1 - outCubic(r)) * 0.25})`, o: clamp(r * 3) }),
};
const OUT = {
  fade: (q) => ({ o: 1 - q }),
  zoom: (q) => ({ tr: `scale(${1 + q * 0.6})`, f: `blur(${q * 14}px)`, o: 1 - q }),
  up: (q) => ({ tr: `translateY(${-q * 120}px)`, o: 1 - q }),
  shrink: (q) => ({ tr: `scale(${1 - q * 0.35})`, o: 1 - q }),
  flip: (q) => ({ tr: `perspective(1800px) rotateY(${q * 78}deg) translateZ(${q * -300}px)`, o: 1 - clamp(q * 1.4) }),
  drop: (q) => ({ tr: `translateY(${q * 260}px) rotate(${q * 4}deg)`, o: 1 - q }),
};

window.render = (t) => {
  // scenes
  for (const s of $$(".scene")) {
    const a = +s.dataset.s, b = +s.dataset.e;
    s.style.visibility = t >= a - 0.001 && t < b ? "visible" : "hidden";
  }
  // element animations
  for (const el of $$("[data-a]")) {
    const a = +el.dataset.t, d = +(el.dataset.d || 0.6), r = clamp((t - a) / d), p = outCubic(r);
    const o = el.dataset.o ? +el.dataset.o : 1e9, od = +(el.dataset.od || 0.45), q = inOut(clamp((t - o) / od));
    const i = (IN[el.dataset.a] || IN.fade)(p, r);
    const u = q > 0 ? (OUT[el.dataset.out || "fade"] || OUT.fade)(q) : { o: 1 };
    const target = i.clip ? el.firstElementChild || el : el;
    if (i.clip) { el.style.overflow = "hidden"; target.style.display = "inline-block"; }
    target.style.transform = [i.tr, u.tr].filter(Boolean).join(" ");
    el.style.opacity = t < a ? 0 : ((i.o ?? 1) * (u.o ?? 1)).toFixed(3);
    el.style.filter = [i.f, u.f].filter(Boolean).join(" ");
    el.style.clipPath = i.cp && r < 1 ? i.cp : "";
  }
  // typewriter
  for (const el of $$("[data-type]")) {
    const [a, d] = el.dataset.type.split(",").map(Number), full = el.dataset.text;
    const n = Math.round(clamp((t - a) / d) * full.length);
    el.textContent = full.slice(0, n);
  }
  // SVG line drawing
  for (const el of $$("[data-draw]")) {
    const [a, d] = el.dataset.draw.split(",").map(Number);
    const len = +(el.dataset.len || 1000);
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = (1 - inOut(clamp((t - a) / d))) * len;
  }
  // counters
  for (const el of $$("[data-count]")) {
    const [a, d, to] = el.dataset.count.split(",").map(Number);
    el.textContent = Math.round(outCubic(clamp((t - a) / d)) * to).toLocaleString("en-US");
  }
  // vertical scroll inside phones
  for (const el of $$("[data-scroll]")) {
    const segs = el.dataset.scroll.split(";").map((x) => x.split(",").map(Number));
    let y = 0;
    for (const [a, d, dist] of segs) y += inOut(clamp((t - a) / d)) * dist;
    el.style.transform = `translateY(${-y}px)`;
  }
  // glitch bursts: RGB split + slice jitter
  for (const el of $$("[data-glitch]")) {
    const [a, d] = el.dataset.glitch.split(",").map(Number);
    const on = t >= a && t < a + d;
    const k = Math.floor(t * 30);
    if (on) {
      const dx = (rand(k) - 0.5) * 46, dy = (rand(k + 7) - 0.5) * 10;
      el.style.textShadow = `${dx * 0.5}px 0 #ff2bd6, ${-dx * 0.5}px 0 #22e7ff`;
      el.style.translate = `${dx}px ${dy}px`;
      el.style.clipPath = rand(k + 3) > 0.45 ? `inset(${rand(k + 1) * 60}% 0 ${rand(k + 2) * 30}% 0)` : "";
    } else if (el.style.translate) {
      el.style.textShadow = ""; el.style.translate = ""; el.style.clipPath = "";
    }
  }
  // cursor paths
  for (const el of $$("[data-path]")) {
    const pts = el.dataset.path.split(";").map((x) => x.split(",").map(Number)); // t,x,y
    let x = pts[0][1], y = pts[0][2];
    for (let i = 1; i < pts.length; i++) {
      const [t0, x0, y0] = pts[i - 1], [t1, x1, y1] = pts[i];
      if (t >= t0) { const k = inOut(clamp((t - t0) / (t1 - t0))); x = x0 + (x1 - x0) * k; y = y0 + (y1 - y0) * k; }
    }
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
  // click ripples
  for (const el of $$("[data-ripple]")) {
    const a = +el.dataset.ripple, r = clamp((t - a) / 0.5);
    el.style.opacity = t < a ? 0 : (1 - r).toFixed(3);
    el.style.transform = `translate(-50%,-50%) scale(${0.2 + r * 2.2})`;
  }
  for (const el of $$("[data-pulse]")) {
    const a = +el.dataset.pulse;
    el.style.scale = t > a ? String(1 + Math.sin((t - a) * 6) * 0.04) : "1";
  }
  for (const el of $$("[data-blink]")) el.style.opacity = Math.floor(t * 2.2) % 2 ? 0 : 1;
  for (const el of $$("[data-spin]")) el.style.rotate = `${t * +el.dataset.spin}deg`;
  for (const el of $$("[data-float]")) {
    const ph = +el.dataset.float;
    el.style.translate = `${Math.sin(t * 0.7 + ph) * 18}px ${Math.cos(t * 0.9 + ph) * 22}px`;
  }

  // particles
  $$(".pt").forEach((el, i) => {
    const sp = 20 + rand(i) * 60, x = rand(i + 50) * 1080, y = (rand(i + 90) * 1920 - t * sp) % 1920;
    el.style.transform = `translate(${x + Math.sin(t + i) * 12}px, ${(y + 1920) % 1920}px)`;
  });
  // background orbs drift
  const o1 = document.getElementById("orb1"), o2 = document.getElementById("orb2"), o3 = document.getElementById("orb3");
  o1.style.transform = `translate(${Math.sin(t * 0.35) * 220}px, ${Math.cos(t * 0.28) * 260}px)`;
  o2.style.transform = `translate(${Math.cos(t * 0.31) * -240}px, ${Math.sin(t * 0.25) * 220}px)`;
  o3.style.transform = `translate(${Math.sin(t * 0.22 + 2) * 200}px, ${Math.cos(t * 0.33) * -200}px)`;
  // film grain moves every frame
  document.getElementById("grain").style.backgroundPosition = `${rand(Math.floor(t * 30)) * 400}px ${rand(Math.floor(t * 30) + 9) * 400}px`;

  // camera shake impulses (decaying), from [data-shake] markers
  let sx = 0, sy = 0, rot = 0;
  for (const el of $$("[data-shake]")) {
    const a = +el.dataset.t, s = +el.dataset.shake, dt = t - a;
    if (dt >= 0 && dt < 0.6) {
      const e = Math.exp(-dt * 9) * s;
      sx += Math.sin(dt * 90) * 26 * e; sy += Math.cos(dt * 75) * 20 * e; rot += Math.sin(dt * 60) * 0.8 * e;
    }
  }
  // slow cinematic push-in per scene
  let push = 1;
  for (const s of $$(".scene")) {
    const a = +s.dataset.s, b = +s.dataset.e;
    if (t >= a && t < b) push = 1 + ((t - a) / (b - a)) * +(s.dataset.push || 0.04);
  }
  document.getElementById("stage").style.transform = `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${push})`;

  // flashes / light leaks / zoom-through
  let flash = 0;
  for (const el of $$("[data-flash]")) {
    const a = +el.dataset.flash, dt = t - a;
    if (dt >= -0.06 && dt < 0.5) flash = Math.max(flash, dt < 0 ? (dt + 0.06) / 0.06 : Math.exp(-dt * 7));
  }
  document.getElementById("flash").style.opacity = flash.toFixed(3);
  for (const el of $$(".leak")) {
    const a = +el.dataset.t, r = clamp((t - a) / 1.1);
    el.style.opacity = r > 0 && r < 1 ? Math.sin(r * Math.PI).toFixed(3) : 0;
    el.style.transform = `translateX(${(r * 2 - 1) * 900}px) rotate(-18deg)`;
  }
  for (const el of $$("[data-zoomthru]")) {
    const a = +el.dataset.zoomthru, r = clamp((t - a) / 0.35);
    if (t >= a - 0.001 && t < a + 0.35) { el.style.transform = `scale(${1 + Math.pow(r, 2) * 5})`; el.style.filter = `blur(${r * 16}px)`; el.style.opacity = 1 - r; }
  }
  document.getElementById("fade").style.opacity = Math.max(1 - clamp(t / 0.12), clamp((t - (DURATION - 0.45)) / 0.45)).toFixed(3);
};
window.render(0);
