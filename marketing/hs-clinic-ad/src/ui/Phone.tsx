import React from 'react';
import { C, F, PHONE, SCREEN, ramp } from '../theme';
import { ui } from '../texts';

/** Gentle 3D tilt (±6°) and slow camera drift, shared by every phone so stacked copies line up exactly. */
export const phoneTilt = (t: number) => ({
  ry: 5.2 * Math.sin((2 * Math.PI * t) / 9.5),
  rx: 2.4 * Math.sin((2 * Math.PI * t) / 12 + 1.1),
  dy: 6 * Math.sin((2 * Math.PI * t) / 7),
});

export const Phone: React.FC<{
  t: number;
  children: React.ReactNode;
  dx?: number;
  dy?: number;
  scale?: number;
  opacity?: number;
  rotZ?: number;
  dark?: boolean;
}> = ({ t, children, dx = 0, dy = 0, scale = 1, opacity = 1, rotZ = 0, dark = false }) => {
  const { ry, rx, dy: drift } = phoneTilt(t);
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE.cx - PHONE.w / 2 + dx,
        top: PHONE.top + dy + drift,
        width: PHONE.w,
        height: PHONE.h,
        opacity,
        transform: `perspective(2600px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rotZ}deg) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 78,
          background: 'linear-gradient(150deg, #29434f 0%, #10242E 45%, #0a1a21 100%)',
          boxShadow:
            '0 70px 120px -40px rgba(16,36,46,0.5), 0 24px 48px -24px rgba(16,36,46,0.4), inset 0 0 0 2px rgba(255,255,255,0.12), inset 0 0 0 5px rgba(0,0,0,0.35)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: PHONE.bezel,
          top: PHONE.bezel,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: 66,
          overflow: 'hidden',
          background: dark ? '#0e1f27' : C.bg,
        }}
      >
        {children}
        <StatusBar dark={dark} />
      </div>
      {/* glass reflection */}
      <div
        style={{
          position: 'absolute',
          inset: PHONE.bezel,
          borderRadius: 66,
          background: `linear-gradient(${118 + ry * 2}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.10) 42%, rgba(255,255,255,0) 54%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

const StatusBar: React.FC<{ dark: boolean }> = ({ dark }) => {
  const c = dark ? 'rgba(255,255,255,0.85)' : C.navy;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 16, left: '50%', marginLeft: -62, width: 124, height: 36, borderRadius: 20, background: '#08141a' }} />
      <div dir="rtl" style={{ position: 'absolute', top: 18, right: 40, fontFamily: F.body, fontWeight: 600, fontSize: 24, color: c }}>{ui.statusTime}</div>
      <div style={{ position: 'absolute', top: 24, left: 38, display: 'flex', gap: 6, alignItems: 'center' }}>
        {[8, 11, 14, 17].map((h, i) => (
          <div key={i} style={{ width: 5, height: h, borderRadius: 2, background: c, alignSelf: 'flex-end' }} />
        ))}
        <div style={{ width: 34, height: 17, borderRadius: 5, border: `2px solid ${c}`, marginLeft: 6, padding: 2 }}>
          <div style={{ width: '75%', height: '100%', borderRadius: 2, background: c }} />
        </div>
      </div>
    </div>
  );
};

/** Touch indicator: approaches, presses at `at`, ripple expands. Coordinates are inside the phone screen. */
export const Tap: React.FC<{ t: number; at: number; x: number; y: number; color?: string }> = ({ t, at, x, y, color = C.teal }) => {
  if (t < at - 0.55 || t > at + 0.7) return null;
  const approach = ramp(t, at - 0.55, 0.45);
  const press = t < at ? 0 : Math.max(0, 1 - Math.abs(t - at - 0.06) / 0.12);
  const leave = ramp(t, at + 0.25, 0.4);
  const ripple = ramp(t, at, 0.6);
  const ox = (1 - approach) * 70 + leave * 40;
  const oy = (1 - approach) * 110 + leave * 70;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - 120,
          top: y - 120,
          width: 240,
          height: 240,
          borderRadius: '50%',
          border: `4px solid ${color}`,
          opacity: t >= at ? (1 - ripple) * 0.55 : 0,
          transform: `scale(${0.2 + ripple * 0.8})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 44 + ox,
          top: y - 44 + oy,
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(220,236,240,0.75))',
          boxShadow: '0 14px 30px -8px rgba(16,36,46,0.45), inset 0 0 0 2px rgba(255,255,255,0.9)',
          opacity: approach * (1 - leave),
          transform: `scale(${1 - press * 0.16})`,
        }}
      />
    </>
  );
};
