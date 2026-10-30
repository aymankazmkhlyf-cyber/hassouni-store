import * as THREE from 'three';

/** Deterministic PRNG (mulberry32). */
export const prng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const texCache = new Map<string, THREE.CanvasTexture>();

/** Night-time window grid: mostly dark, some warm/cool lit windows. Tiles with RepeatWrapping. */
export const windowTexture = (variant: number, litRatio = 0.32, cool = false) => {
  const key = `${variant}-${litRatio}-${cool}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#04070c';
  g.fillRect(0, 0, 64, 128);
  const r = prng(1000 + variant);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 8; x++) {
      const v = r();
      if (v < litRatio) {
        const warm = r() > (cool ? 0.7 : 0.25);
        const k = 0.55 + r() * 0.45;
        g.fillStyle = warm ? `rgba(255,${190 + Math.floor(r() * 40)},${110 + Math.floor(r() * 50)},${k})` : `rgba(140,${200 + Math.floor(r() * 30)},255,${k})`;
      } else {
        g.fillStyle = `rgba(30,45,65,${0.08 + r() * 0.12})`;
      }
      g.fillRect(x * 8 + 1.5, y * 8 + 2, 5, 4.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
};

/** Box whose UVs repeat the window texture in proportion to its size (one tile ≈ tile × 2·tile units). */
export const buildingGeometry = (w: number, h: number, d: number, tile = 12) => {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const normal = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const sx = ny > 0.5 ? 0 : (nx > 0.5 ? d : w) / tile;
    const sy = ny > 0.5 ? 0 : h / (tile * 2);
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  uv.needsUpdate = true;
  return geo;
};

/** lat/lon (degrees) → point on a sphere of radius r (y up, lon 0 facing +z). */
export const latLon = (lat: number, lon: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

/** Great-circle arc lifted above the surface. */
export const arcPoints = (a: THREE.Vector3, b: THREE.Vector3, r: number, lift: number, n = 96) => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const p = new THREE.Vector3().copy(a).lerp(b, s).normalize();
    pts.push(p.multiplyScalar(r * (1 + lift * Math.sin(Math.PI * s))));
  }
  return pts;
};

/** Project a world point to frame pixels for HTML labels. */
export const project = (p: THREE.Vector3, cam: THREE.PerspectiveCamera, w: number, h: number) => {
  const v = p.clone().project(cam);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 };
};
