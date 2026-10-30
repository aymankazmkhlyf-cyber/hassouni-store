// three.js shots (rendered with @remotion/three): night city, globe with flight arcs,
// glass office tower, airplane. Each takes a camera description so the scenes can move it per frame.
import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { C, H, W } from '../theme';
import { arcPoints, buildingGeometry, latLon, prng, windowTexture } from './util';

export type Cam3 = { pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number };

const Rig: React.FC<{ cam: Cam3 }> = ({ cam }) => {
  const { camera } = useThree();
  const pc = camera as THREE.PerspectiveCamera;
  pc.position.set(...cam.pos);
  pc.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
  pc.lookAt(...cam.look);
  if (cam.fov && pc.fov !== cam.fov) {
    pc.fov = cam.fov;
    pc.updateProjectionMatrix();
  }
  return null;
};

export const makeCamera = (cam: Cam3) => {
  const c = new THREE.PerspectiveCamera(cam.fov ?? 40, W / H, 0.1, 2000);
  c.position.set(...cam.pos);
  c.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
};

const Canvas: React.FC<{ cam: Cam3; children: React.ReactNode; style?: React.CSSProperties }> = ({ cam, children, style }) => (
  <ThreeCanvas
    width={W}
    height={H}
    style={{ position: 'absolute', inset: 0, ...style }}
    camera={{ fov: cam.fov ?? 40, near: 0.1, far: 2000, position: cam.pos }}
    gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
  >
    <Rig cam={cam} />
    {children}
  </ThreeCanvas>
);

// ───────────────────────────── Night city (hook + loop)
const City: React.FC<{ seed?: number }> = ({ seed = 7 }) => {
  const buildings = useMemo(() => {
    const r = prng(seed);
    const out: { x: number; z: number; w: number; d: number; h: number; v: number; cool: boolean }[] = [];
    for (let gx = -9; gx <= 9; gx++) {
      for (let gz = 0; gz < 22; gz++) {
        if (Math.abs(gx) < 1 && gz < 14) continue; // avenue down the middle
        if (r() < 0.12) continue;
        const w = 4 + r() * 5;
        const d = 4 + r() * 5;
        const centre = 1 - Math.min(1, Math.abs(gx) / 9);
        const h = 6 + r() * 22 + centre * r() * 45 + (gz > 12 ? r() * 30 : 0);
        out.push({ x: gx * 10 + (r() - 0.5) * 2, z: -gz * 11 - 6, w, d, h, v: Math.floor(r() * 4), cool: r() > 0.6 });
      }
    }
    return out;
  }, [seed]);
  const mats = useMemo(
    () =>
      [0, 1, 2, 3].flatMap((v) =>
        [false, true].map(
          (cool) =>
            new THREE.MeshStandardMaterial({
              color: '#0a1220',
              roughness: 0.55,
              metalness: 0.4,
              emissive: new THREE.Color('#ffffff'),
              emissiveMap: windowTexture(v, 0.2, cool),
              emissiveIntensity: 1.0,
            }),
        ),
      ),
    [],
  );
  return (
    <>
      {buildings.map((b, i) => (
        <mesh key={i} geometry={buildingGeometry(b.w, b.h, b.d)} material={mats[b.v * 2 + (b.cool ? 1 : 0)]} position={[b.x, b.h / 2, b.z]} />
      ))}
      {/* wet street with light streaks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -100]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#060b13" roughness={0.25} metalness={0.7} />
      </mesh>
      {Array.from({ length: 26 }).map((_, i) => (
        <mesh key={`l${i}`} position={[i % 2 ? 2.2 : -2.2, 0.05, -10 - i * 8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 3.2]} />
          <meshBasicMaterial color={i % 2 ? '#ff9a5c' : '#bfe3ff'} transparent opacity={0.85} />
        </mesh>
      ))}
    </>
  );
};

export const NightCity3D: React.FC<{ cam: Cam3; seed?: number }> = ({ cam, seed }) => (
  <Canvas cam={cam}>
    <fog attach="fog" args={[C.navy, 40, 230]} />
    <ambientLight intensity={0.35} color="#7aa6d6" />
    <directionalLight position={[-40, 80, 30]} intensity={0.6} color="#9cc7ff" />
    <pointLight position={[0, 6, -20]} intensity={60} distance={80} color="#ffb070" />
    <City seed={seed} />
  </Canvas>
);

// ───────────────────────────── Glass office tower at night (dashboard crane-down)
export const Tower3D: React.FC<{ cam: Cam3 }> = ({ cam }) => {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0d1b2c',
        roughness: 0.15,
        metalness: 0.9,
        emissive: new THREE.Color('#ffffff'),
        emissiveMap: windowTexture(9, 0.3, true),
        emissiveIntensity: 0.9,
      }),
    [],
  );
  const neighbours = useMemo(() => {
    const r = prng(42);
    return Array.from({ length: 18 }).map(() => ({ x: (r() - 0.5) * 140, z: -30 - r() * 120, w: 6 + r() * 10, h: 20 + r() * 70, v: Math.floor(r() * 4) }));
  }, []);
  return (
    <Canvas cam={cam}>
      <fog attach="fog" args={[C.navy, 60, 260]} />
      <ambientLight intensity={0.4} color="#88aacc" />
      <directionalLight position={[30, 120, 60]} intensity={0.9} color="#c8dcff" />
      <pointLight position={[0, 40, 22]} intensity={90} distance={120} color="#ffcf8a" />
      <mesh geometry={buildingGeometry(22, 140, 22, 7)} material={mat} position={[0, 70, 0]} />
      {/* glass fins */}
      {[-11.2, 11.2].map((x) => (
        <mesh key={x} position={[x, 70, 11.2]}>
          <boxGeometry args={[0.6, 140, 0.6]} />
          <meshStandardMaterial color="#9fd3f5" emissive="#5FB7E5" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {neighbours.map((b, i) => (
        <mesh key={i} geometry={buildingGeometry(b.w, b.h, b.w)} material={new THREE.MeshStandardMaterial({ color: '#0a1220', emissive: new THREE.Color('#fff'), emissiveMap: windowTexture(b.v, 0.25), emissiveIntensity: 0.9 })} position={[b.x, b.h / 2, b.z]} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#050a12" roughness={0.3} metalness={0.6} />
      </mesh>
    </Canvas>
  );
};

// ───────────────────────────── Globe with flight arcs
export const CITY_LL = {
  baghdad: [33.31, 44.36],
  istanbul: [41.01, 28.98],
  dubai: [25.2, 55.27],
} as const;

export const GLOBE_R = 10;
const cityPos = (k: keyof typeof CITY_LL, r: number) => latLon(CITY_LL[k][0], CITY_LL[k][1], r);

export const Globe3D: React.FC<{ cam: Cam3; spin: number; arcs: { from: keyof typeof CITY_LL; to: keyof typeof CITY_LL; p: number }[]; plane?: { arc: number; p: number } }> = ({ cam, spin, arcs, plane }) => {
  const dots = useMemo(() => {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = g * i;
      pos.set([Math.cos(th) * rr * GLOBE_R * 1.002, y * GLOBE_R * 1.002, Math.sin(th) * rr * GLOBE_R * 1.002], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);
  const arcGeos = useMemo(
    () =>
      arcs.map((a) => {
        const pts = arcPoints(cityPos(a.from, GLOBE_R), cityPos(a.to, GLOBE_R), GLOBE_R, 0.22);
        return { pts, curve: new THREE.CatmullRomCurve3(pts) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arcs.map((a) => a.from + a.to).join()],
  );
  return (
    <Canvas cam={cam}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 10, 30]} intensity={1.2} color="#ffe2b0" />
      <group rotation={[0.35, spin, 0]}>
        <mesh>
          <sphereGeometry args={[GLOBE_R, 96, 96]} />
          <meshStandardMaterial color="#0c2236" roughness={0.6} metalness={0.2} emissive="#0E6E73" emissiveIntensity={0.18} />
        </mesh>
        <points geometry={dots}>
          <pointsMaterial color="#5FB7E5" size={0.09} sizeAttenuation transparent opacity={0.55} />
        </points>
        {/* graticule */}
        {Array.from({ length: 11 }).map((_, i) => (
          <mesh key={`lat${i}`} rotation={[Math.PI / 2, 0, 0]} position={[0, GLOBE_R * Math.sin(((i - 5) * 15 * Math.PI) / 180), 0]}>
            <torusGeometry args={[GLOBE_R * Math.cos(((i - 5) * 15 * Math.PI) / 180) * 1.003, 0.012, 6, 160]} />
            <meshBasicMaterial color="#5FB7E5" transparent opacity={0.22} />
          </mesh>
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={`lon${i}`} rotation={[0, (i * Math.PI) / 12, 0]}>
            <torusGeometry args={[GLOBE_R * 1.003, 0.012, 6, 200]} />
            <meshBasicMaterial color="#5FB7E5" transparent opacity={0.18} />
          </mesh>
        ))}
        {/* cities */}
        {(Object.keys(CITY_LL) as (keyof typeof CITY_LL)[]).map((k) => (
          <group key={k} position={cityPos(k, GLOBE_R * 1.004)}>
            <mesh>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshBasicMaterial color={C.gold} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.38, 16, 16]} />
              <meshBasicMaterial color={C.gold} transparent opacity={0.25} />
            </mesh>
          </group>
        ))}
        {/* arcs */}
        {arcs.map((a, i) => {
          const n = Math.max(2, Math.floor(arcGeos[i].pts.length * a.p));
          if (a.p <= 0) return null;
          const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcGeos[i].pts.slice(0, n)), 64, 0.05, 8, false);
          const glow = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcGeos[i].pts.slice(0, n)), 64, 0.16, 8, false);
          return (
            <group key={i}>
              <mesh geometry={glow}>
                <meshBasicMaterial color={C.gold} transparent opacity={0.22} />
              </mesh>
              <mesh geometry={geo}>
                <meshBasicMaterial color="#ffd27a" />
              </mesh>
            </group>
          );
        })}
        {plane && plane.p > 0 && plane.p < 1 && (
          <group position={arcGeos[plane.arc].curve.getPoint(plane.p)}>
            <mesh>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.6, 16, 16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
            </mesh>
          </group>
        )}
      </group>
      {/* atmosphere rim */}
      <mesh scale={1.08}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial color="#5FB7E5" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
    </Canvas>
  );
};

/** World position of a city on the spinning globe (for HTML labels). */
export const globeCity = (k: keyof typeof CITY_LL, spin: number) =>
  cityPos(k, GLOBE_R * 1.02).applyEuler(new THREE.Euler(0.35, spin, 0));

// ───────────────────────────── Airplane flying past camera
const Jet: React.FC = () => {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9eef3', roughness: 0.35, metalness: 0.55 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#25384d', roughness: 0.4, metalness: 0.6 }), []);
  return (
    <group>
      <mesh material={body} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.55, 6.5, 8, 24]} />
      </mesh>
      {/* wings */}
      <mesh material={body} position={[0.2, -0.1, 0]} rotation={[0, 0.0, 0]}>
        <boxGeometry args={[1.6, 0.08, 9]} />
      </mesh>
      <mesh material={body} position={[-3.2, 0.05, 0]}>
        <boxGeometry args={[0.8, 0.06, 3.2]} />
      </mesh>
      <mesh material={dark} position={[-3.3, 0.8, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[1.1, 1.5, 0.08]} />
      </mesh>
      {/* engines */}
      {[-1.8, 1.8].map((z) => (
        <mesh key={z} material={dark} position={[0.6, -0.45, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.32, 1.2, 16]} />
        </mesh>
      ))}
      {/* navigation lights */}
      <mesh position={[0.2, -0.05, 4.5]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#ff4040" />
      </mesh>
      <mesh position={[0.2, -0.05, -4.5]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#40ff80" />
      </mesh>
    </group>
  );
};

export const Airplane3D: React.FC<{ cam: Cam3; pos: [number, number, number]; rot: [number, number, number] }> = ({ cam, pos, rot }) => (
  <Canvas cam={cam}>
    <ambientLight intensity={0.6} color="#9fc0e0" />
    <directionalLight position={[10, 20, 10]} intensity={1.6} color="#ffe0b0" />
    <directionalLight position={[-10, -5, -10]} intensity={0.5} color="#5FB7E5" />
    <group position={pos} rotation={rot}>
      <Jet />
    </group>
  </Canvas>
);
