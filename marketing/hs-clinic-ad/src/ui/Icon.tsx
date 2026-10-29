import React from 'react';
import { C, glass, ramp, sp } from '../theme';

// 24×24 line icons (hand-drawn paths, no third-party marks).
export const ICONS = {
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M8 14.5h3', 'M13 14.5h3', 'M8 17.5h3'],
  clock: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M12 7v5l3.2 2'],
  users: ['M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z', 'M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2', 'M19 8v6', 'M16 11h6'],
  bookingCheck: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 3v4', 'M16 3v4', 'M8.5 14l2.5 2.5 4.5-5'],
  chat: ['M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M8 11h.01', 'M12 11h.01', 'M16 11h.01'],
  handoff: ['M6 4.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z', 'M2 15.5c0-2.4 1.8-4 4-4s4 1.6 4 4', 'M18 4.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z', 'M14 15.5c0-2.4 1.8-4 4-4s4 1.6 4 4', 'M8 20h8', 'M13.5 17.5L16 20l-2.5 2.5'],
  phone: ['M5 3h3.5l2 5-2.5 1.6a11 11 0 0 0 5.4 5.4L15 12.5l5 2V18a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  dashboard: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  dm: ['M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M16.5 8L7.5 11l3.5 1.2L12.2 15.5z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  lock: ['M6 10h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 6 10z', 'M8 10V7a4 4 0 0 1 8 0v3', 'M12 14.5v2.5'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  back: ['M9 6l6 6-6 6'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  sun: ['M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  medic: ['M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z'],
  stetho: ['M6 3v6a4 4 0 0 0 8 0V3', 'M10 13v2a5 5 0 0 0 10 0v-2', 'M20 11a2 2 0 1 1 0 0.01'],
  headset: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v5H5a1 1 0 0 1-1-1z', 'M20 14h-3v5h2a1 1 0 0 0 1-1z', 'M17 19a4 4 0 0 1-4 3h-1'],
  mic: ['M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'],
} as const;

export type IconName = keyof typeof ICONS;

/** Line icon. With `drawAt` the strokes draw on over 400 ms. */
export const Icon: React.FC<{ name: IconName; size: number; color?: string; t?: number; drawAt?: number; stroke?: number; style?: React.CSSProperties }> = ({
  name,
  size,
  color = C.teal,
  t = 0,
  drawAt,
  stroke = 1.9,
  style,
}) => {
  const p = drawAt === undefined ? 1 : ramp(t, drawAt, 0.4);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {ICONS[name].map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={p < 1 ? 1 : undefined}
          strokeDashoffset={p < 1 ? 1 - p : undefined}
        />
      ))}
    </svg>
  );
};

/** Floating glass feature badge: stroke draw-on (400 ms), then a small spring bounce. Gentle float afterwards. */
export const IconBadge: React.FC<{ name: IconName; t: number; at: number; x: number; y: number; until: number; size?: number; color?: string; dx?: number }> = ({
  name,
  t,
  at,
  x,
  y,
  until,
  size = 132,
  color = C.teal,
  dx = 0,
}) => {
  if (t < at - 0.1 || t > until + 0.4) return null;
  const appear = ramp(t, at - 0.1, 0.3);
  const bounce = sp(t, at + 0.4, 18, 220);
  const out = ramp(t, until, 0.35);
  const scale = (0.86 + 0.14 * appear) * (1 + 0.08 * Math.sin(Math.min(1, bounce) * Math.PI)) * (1 - out * 0.2);
  const float = Math.sin((t - at) * 1.6) * 7;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2 + dx,
        top: y - size / 2 + float,
        width: size,
        height: size,
        borderRadius: size * 0.3,
        ...glass(0.7),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: appear * (1 - out),
        transform: `scale(${scale})`,
      }}
    >
      <Icon name={name} size={size * 0.52} color={color} t={t} drawAt={at} stroke={1.8} />
    </div>
  );
};
