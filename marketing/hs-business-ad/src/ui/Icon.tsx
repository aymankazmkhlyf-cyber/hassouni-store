import React from 'react';
import { C, glass, ramp, sp } from '../theme';

// 24×24 line icons (hand-drawn paths; no third-party marks or brand logos).
export const ICONS = {
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M8 14.5h3', 'M13 14.5h3', 'M8 17.5h3'],
  clock: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M12 7v5l3.2 2'],
  plane: ['M10.5 21l1.5-1v-5.5l8 3v-2l-8-5V5a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-3V20l1.5 1z'],
  globe: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M3 12h18', 'M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z'],
  ticket: ['M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z', 'M14 6v2', 'M14 11v2', 'M14 16v2'],
  users: ['M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z', 'M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2', 'M16.5 4.8a3.3 3.3 0 0 1 0 6.4', 'M18.5 14.2c1.9.8 3 2.9 3 5.8'],
  gauge: ['M4 16a8 8 0 1 1 16 0', 'M12 16l4-5', 'M12 16h.01'],
  chat: ['M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M8 11h.01', 'M12 11h.01', 'M16 11h.01'],
  handoff: ['M6 4.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z', 'M2 15.5c0-2.4 1.8-4 4-4s4 1.6 4 4', 'M18 4.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z', 'M14 15.5c0-2.4 1.8-4 4-4s4 1.6 4 4', 'M8 20h8', 'M13.5 17.5L16 20l-2.5 2.5'],
  phone: ['M5 3h3.5l2 5-2.5 1.6a11 11 0 0 0 5.4 5.4L15 12.5l5 2V18a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  dashboard: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  dm: ['M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M16.5 8L7.5 11l3.5 1.2L12.2 15.5z'],
  comment: ['M12 3c5 0 9 3.4 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4 20l1.4-3.8C3.9 14.8 3 12.8 3 10.6 3 6.4 7 3 12 3z', 'M8 9.5h8', 'M8 12.5h5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  lock: ['M6 10h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 6 10z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  back: ['M9 6l6 6-6 6'],
  send: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  building: ['M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17', 'M15 9h3a1 1 0 0 1 1 1v11', 'M3 21h18', 'M8 7h1', 'M11 7h1', 'M8 11h1', 'M11 11h1', 'M8 15h1', 'M11 15h1'],
  headset: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v5H5a1 1 0 0 1-1-1z', 'M20 14h-3v5h2a1 1 0 0 0 1-1z', 'M17 19a4 4 0 0 1-4 3h-1'],
  briefcase: ['M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M3 13h18'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  pin: ['M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z', 'M12 7.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4z'],
} as const;

export type IconName = keyof typeof ICONS;

/** Line icon. With `drawAt` the strokes draw on over 400 ms. */
export const Icon: React.FC<{ name: IconName; size: number; color?: string; t?: number; drawAt?: number; stroke?: number; style?: React.CSSProperties }> = ({
  name,
  size,
  color = C.gold,
  t = 0,
  drawAt,
  stroke = 1.8,
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

/** Floating glass feature badge: stroke draw-on (400 ms), then a spring settle. Gentle float afterwards. */
export const IconBadge: React.FC<{ name: IconName; t: number; at: number; until: number; x: number; y: number; size?: number; color?: string; dx?: number }> = ({
  name,
  t,
  at,
  until,
  x,
  y,
  size = 128,
  color = C.gold,
  dx = 0,
}) => {
  if (t < at - 0.1 || t > until + 0.4) return null;
  const appear = ramp(t, at - 0.1, 0.3);
  const settle = sp(t, at + 0.4, 18, 200);
  const out = ramp(t, until, 0.35);
  const scale = (0.85 + 0.15 * appear) * (1 + 0.08 * Math.sin(Math.min(1, settle) * Math.PI)) * (1 - out * 0.2);
  const float = Math.sin((t - at) * 1.5) * 8;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2 + dx,
        top: y - size / 2 + float,
        width: size,
        height: size,
        borderRadius: size * 0.3,
        ...glass(0.1),
        backdropFilter: undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: appear * (1 - out),
        transform: `scale(${scale})`,
      }}
    >
      <Icon name={name} size={size * 0.5} color={color} t={t} drawAt={at} stroke={1.7} />
    </div>
  );
};
