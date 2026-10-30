// Headline readability check: every headline must be fully visible for ≥ 1.8 s.
import { HEADLINES } from '../src/headlines';

const STAGGER = 0.06;
const DUR = 0.42;
let bad = 0;
for (const h of HEADLINES) {
  const words = h.text.split(' ').length;
  const full = h.start + (words - 1) * STAGGER + DUR;
  const gone = h.end - (h.exit ?? 0.25);
  const readable = gone - full;
  const ok = readable >= 1.8;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${readable.toFixed(2)} s  ${h.start.toFixed(2)}–${h.end.toFixed(2)}  ${h.text}`);
}
console.log('problems:', bad);
process.exit(bad ? 1 : 0);
