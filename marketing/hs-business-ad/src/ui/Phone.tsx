import React from 'react';
import { C, F, ramp } from '../theme';
import { ui } from '../texts';

export const PHONE = { w: 470, h: 940, bezel: 12, radius: 74 };
export const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 };

export type Cam = { x?: number; y?: number; ry?: number; rx?: number; rz?: number; scale?: number; persp?: number; blur?: number; opacity?: number };

/**
 * 3D phone mockup (CSS 3D): `cam` places/rotates it. The frame has a visible edge so orbits read as 3D.
 * Centre of the phone sits at (540 + x, 1015 + y).
 */
export const Phone: React.FC<{ cam: Cam; children: React.ReactNode; glow?: number; dim?: number; statusTime?: string }> = ({ cam, children, glow = 0.35, dim = 0, statusTime = ui.statusTime }) => {
  const { x = 0, y = 0, ry = 0, rx = 0, rz = 0, scale = 1, persp = 2400, blur = 0, opacity = 1 } = cam;
  const edge = Math.max(-1, Math.min(1, ry / 35));
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - PHONE.w / 2 + x,
        top: 1015 - PHONE.h / 2 + y,
        width: PHONE.w,
        height: PHONE.h,
        opacity,
        transform: `perspective(${persp}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* screen glow on the surroundings */}
      <div style={{ position: 'absolute', inset: -120, borderRadius: 200, background: 'radial-gradient(ellipse at 50% 50%, rgba(95,183,229,0.55), rgba(0,0,0,0) 65%)', opacity: glow * (1 - dim), transform: 'translateZ(-40px)' }} />
      {/* side edge (thickness) */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: PHONE.radius, background: '#05090f', transform: `translateZ(-14px) translateX(${-edge * 9}px)`, boxShadow: '0 80px 140px -40px rgba(0,0,0,0.85)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: PHONE.radius, background: 'linear-gradient(150deg, #3a4a5c 0%, #141e2b 40%, #0a0f17 100%)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.14), inset 0 0 0 5px rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'absolute', left: PHONE.bezel, top: PHONE.bezel, width: SCREEN.w, height: SCREEN.h, borderRadius: PHONE.radius - 10, overflow: 'hidden', background: C.navy }}>
        {children}
        <StatusBar time={statusTime} />
        {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: dim }} />}
      </div>
      {/* glass reflection that moves with the orbit */}
      <div style={{ position: 'absolute', inset: PHONE.bezel, borderRadius: PHONE.radius - 10, background: `linear-gradient(${110 + ry * 2.5}deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.13) 44%, rgba(255,255,255,0) 56%)`, pointerEvents: 'none' }} />
    </div>
  );
};

const StatusBar: React.FC<{ time: string }> = ({ time }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 62, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 15, left: '50%', marginLeft: -60, width: 120, height: 34, borderRadius: 20, background: '#000' }} />
    <div dir="rtl" style={{ position: 'absolute', top: 16, right: 38, fontFamily: F.body, fontWeight: 600, fontSize: 24, color: 'rgba(244,239,230,0.9)' }}>{time}</div>
    <div style={{ position: 'absolute', top: 22, left: 36, display: 'flex', gap: 5, alignItems: 'flex-end' }}>
      {[8, 11, 14, 17].map((h, i) => (
        <div key={i} style={{ width: 5, height: h, borderRadius: 2, background: 'rgba(244,239,230,0.9)' }} />
      ))}
      <div style={{ width: 32, height: 16, borderRadius: 5, border: '2px solid rgba(244,239,230,0.9)', marginLeft: 6, padding: 2 }}>
        <div style={{ width: '60%', height: '100%', borderRadius: 2, background: 'rgba(244,239,230,0.9)' }} />
      </div>
    </div>
  </div>
);

/** Touch indicator with ripple; `slow` stretches the ripple (slow-motion tap). Coordinates are inside the screen. */
export const Tap: React.FC<{ t: number; at: number; x: number; y: number; slow?: number; color?: string }> = ({ t, at, x, y, slow = 1, color = C.gold }) => {
  const rd = 0.6 * slow;
  if (t < at - 0.5 || t > at + rd + 0.3) return null;
  const approach = ramp(t, at - 0.5, 0.42);
  const press = t < at ? 0 : Math.max(0, 1 - Math.abs(t - at - 0.06 * slow) / (0.12 * slow));
  const leave = ramp(t, at + 0.25 * slow, 0.4);
  return (
    <>
      {[0, 0.18].map((d, i) => {
        const r = ramp(t, at + d * slow, rd);
        return t >= at + d * slow ? (
          <div key={i} style={{ position: 'absolute', left: x - 130, top: y - 130, width: 260, height: 260, borderRadius: '50%', border: `${4 - i}px solid ${color}`, opacity: (1 - r) * 0.7, transform: `scale(${0.15 + r * 0.85})` }} />
        ) : null;
      })}
      <div
        style={{
          position: 'absolute',
          left: x - 42 + (1 - approach) * 70 + leave * 40,
          top: y - 42 + (1 - approach) * 110 + leave * 70,
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.9), rgba(200,215,230,0.55))',
          boxShadow: '0 14px 30px -8px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.8)',
          opacity: approach * (1 - leave),
          transform: `scale(${1 - press * 0.16})`,
        }}
      />
    </>
  );
};
