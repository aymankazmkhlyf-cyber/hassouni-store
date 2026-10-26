// Deterministic timeline: window.render(t) positions every element for time t (seconds).
const clamp = (x) => Math.max(0, Math.min(1, x));
const outCubic = (x) => 1 - Math.pow(1 - x, 3);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const DURATION = +document.body.dataset.dur;
const nums = (s) => s.split(",").map(Number);

window.render = (t) => {
  for (const el of document.querySelectorAll("[data-in]")) {
    const a = +el.dataset.in, b = el.dataset.out ? +el.dataset.out : 1e9, d = +(el.dataset.d || 0.7);
    const raw = clamp((t - a) / d), p = outCubic(raw), q = inOut(clamp((t - b) / 0.4));
    const kind = el.dataset.anim || "up";
    let tr = "";
    if (kind === "up") tr = `translateY(${(1 - p) * 70 - q * 50}px)`;
    else if (kind === "rise") tr = `translateY(${(1 - p) * 420 + q * 120}px) rotate(${(1 - p) * 6}deg)`;
    else if (kind === "left") tr = `translateX(${(1 - p) * -320 - q * 160}px)`;
    else if (kind === "right") tr = `translateX(${(1 - p) * 320 + q * 160}px)`;
    else if (kind === "pop") tr = `scale(${raw < 1 ? 0.4 + 0.6 * backOut(raw) : 1 - q * 0.15})`;
    else if (kind === "zoom") tr = `scale(${1.6 - 0.6 * p + q * 0.3})`;
    el.style.opacity = (p * (1 - q)).toFixed(3);
    el.style.transform = tr;
  }
  for (const el of document.querySelectorAll("[data-float]")) {
    const [phase, rot] = nums(el.dataset.float);
    el.style.transform = `translateY(${Math.sin(t * 1.6 + phase) * 10}px) rotate(${rot}deg)`;
  }
  for (const el of document.querySelectorAll("[data-scroll]")) {
    const [s, d, dist] = nums(el.dataset.scroll);
    el.style.transform = `translateY(${-inOut(clamp((t - s) / d)) * dist}px)`;
  }
  for (const el of document.querySelectorAll("[data-sweep]")) {
    const [s, d] = nums(el.dataset.sweep);
    el.style.transform = `translateX(${inOut(clamp((t - s) / d)) * 1600}px) skewX(-18deg)`;
  }
  for (const el of document.querySelectorAll("[data-pulse]")) {
    const s = +el.dataset.pulse;
    el.style.transform = t > s ? `scale(${1 + Math.sin((t - s) * 5) * 0.035})` : "";
  }
  for (const el of document.querySelectorAll("[data-spin]")) el.style.transform = `rotate(${t * +el.dataset.spin}deg)`;
  document.querySelectorAll(".typing i").forEach((el, i) => { el.style.transform = `translateY(${Math.sin(t * 12 - i * 0.9) * 8}px)`; });
  const b1 = document.getElementById("blob1"), b2 = document.getElementById("blob2");
  if (b1) b1.style.transform = `translate(${Math.sin(t * 0.6) * 120}px, ${Math.cos(t * 0.5) * 90}px)`;
  if (b2) b2.style.transform = `translate(${Math.cos(t * 0.55) * -110}px, ${Math.sin(t * 0.45) * 100}px)`;
  document.getElementById("fade").style.opacity = Math.max(1 - clamp(t / 0.3), clamp((t - (DURATION - 0.4)) / 0.4)).toFixed(3);
};
window.render(0);
