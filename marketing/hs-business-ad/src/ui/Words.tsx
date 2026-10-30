import React from 'react';
import { C, F, HEAD_Y, ramp } from '../theme';

const STAGGER = 0.06; // 60 ms between words
const DUR = 0.42;

/** Time (s) at which the last word of `text` is fully revealed when the reveal starts at `start`. */
export const fullyVisibleAt = (text: string, start: number) => start + (text.split(' ').length - 1) * STAGGER + DUR;

/**
 * Word-by-word reveal: opacity 0→1, 14 px rise, blur 6→0 px, 60 ms stagger.
 * Whole words only (each word is one inline-block) so Arabic shaping is never split.
 * Lines break after a word that ends with "…"; otherwise words wrap as whole units.
 */
export const Words: React.FC<{
  text: string;
  t: number;
  start: number;
  size: number;
  weight?: number;
  color?: string;
  font?: string;
  lineHeight?: number;
  gap?: number;
  align?: 'center' | 'flex-start' | 'flex-end';
  maxWidth?: number;
  breakAfter?: number;
  /** false: don't force a line break after a word ending in “…” (use `breakAfter` instead). */
  ellipsisBreak?: boolean;
}> = ({ text, t, start, size, weight = 700, color = C.ivory, font = F.head, lineHeight = 1.4, gap = 0.26, align = 'center', maxWidth = 940, breakAfter, ellipsisBreak = true }) => {
  const words = text.split(' ');
  const lines: { word: string; i: number }[][] = [[]];
  words.forEach((word, i) => {
    lines[lines.length - 1].push({ word, i });
    if (((ellipsisBreak && word.endsWith('…')) || i === breakAfter) && i < words.length - 1) lines.push([]);
  });
  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align, columnGap: gap * size, direction: 'rtl' }}>
          {line.map(({ word, i }) => {
            const p = ramp(t, start + i * STAGGER, DUR);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  fontFamily: font,
                  fontWeight: weight,
                  fontSize: size,
                  lineHeight,
                  color,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                  filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Scene headline in the top safe band, with a soft exit ending at `end`. */
export const Headline: React.FC<{
  text: string;
  t: number;
  start: number;
  end: number;
  size?: number;
  color?: string;
  exit?: number;
  y?: number;
  breakAfter?: number;
  ellipsisBreak?: boolean;
  glow?: boolean;
}> = ({ text, t, start, end, size = 72, color = C.ivory, exit = 0.25, y = HEAD_Y, breakAfter, ellipsisBreak, glow = true }) => {
  if (t < start - 0.05 || t > end) return null;
  const out = exit > 0 ? ramp(t, end - exit, exit) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        transform: `translateY(-50%) translateY(${-out * 12}px)`,
        display: 'flex',
        justifyContent: 'center',
        opacity: 1 - out,
        filter: out > 0 ? `blur(${out * 6}px)` : undefined,
        textShadow: glow ? '0 6px 30px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.45)' : undefined,
      }}
    >
      <Words text={text} t={t} start={start} size={size} color={color} breakAfter={breakAfter} ellipsisBreak={ellipsisBreak} />
    </div>
  );
};
