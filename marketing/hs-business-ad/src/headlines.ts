import { brief } from './texts';

export type Head = { text: string; start: number; end: number; exit?: number; y?: number; size?: number; breakAfter?: number };

// Headline windows. Each stays fully readable ≥ 1.8 s (checked by tools/timing_qa.ts).
export const HEADLINES: Head[] = [
  { text: brief.hook, start: 0.0, end: 3.0, exit: 0 },
  { text: brief.hook2, start: 3.0, end: 5.55, exit: 0.07 },
  { text: brief.turn, start: 5.58, end: 8.31, exit: 0.2 },
  { text: brief.reveal1, start: 8.33, end: 10.94, exit: 0.2, breakAfter: 1 },
  // Bridges into 1/7 so both reveal lines stay readable ≥ 1.8 s; the 1/7 headline follows at 13.78.
  { text: brief.reveal2, start: 10.96, end: 13.75, exit: 0.2, breakAfter: 3 },
];

