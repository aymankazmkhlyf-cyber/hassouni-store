import { brief } from './texts';

export type Head = { text: string; start: number; end: number; exit?: number; y?: number; size?: number; breakAfter?: number; ellipsisBreak?: boolean };

// Headline windows. Each stays fully readable ≥ 1.8 s (checked by tools/timing_qa.ts).
export const HEADLINES: Head[] = [
  { text: brief.hook, start: 0.0, end: 3.0, exit: 0 },
  { text: brief.hook2, start: 3.0, end: 5.55, exit: 0.07 },
  { text: brief.turn, start: 5.58, end: 8.31, exit: 0.2 },
  { text: brief.reveal1, start: 8.33, end: 10.94, exit: 0.2, breakAfter: 1 },
  // Bridges into 1/7 so both reveal lines stay readable ≥ 1.8 s; the 1/7 headline follows at 13.78.
  { text: brief.reveal2, start: 10.96, end: 13.75, exit: 0.2, breakAfter: 3 },
  { text: brief.f1, start: 13.78, end: 16.85, exit: 0.15 },
  { text: brief.f2, start: 17.1, end: 22.85, exit: 0.2 },
  { text: brief.f3, start: 23.1, end: 27.85, exit: 0.2, breakAfter: 3, ellipsisBreak: false },
  { text: brief.f4, start: 28.1, end: 33.85, exit: 0.2, breakAfter: 2 },
  { text: brief.f5, start: 34.1, end: 39.85, exit: 0.2, size: 68 },
  { text: brief.f6, start: 40.1, end: 43.8, exit: 0.2 },
  { text: brief.f7, start: 44.1, end: 49.85, exit: 0.2, breakAfter: 2 },
  { text: brief.offer, start: 50.1, end: 54.85, exit: 0.2 },
  { text: brief.cta1, start: 55.15, end: 59.45, exit: 0.15 },
  { text: brief.cta2, start: 56.4, end: 59.45, exit: 0.15, y: 1395, size: 68 },
];

