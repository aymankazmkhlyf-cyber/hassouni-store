"""Spelling/format checks on every Arabic string in src/texts.ts (reports only — never edits)."""
import re, sys

src = open('src/texts.ts', encoding='utf8').read()
block = src[src.index('export const brief'):src.index('} as const;')]
problems = 0
# Layout line breaks used on screen (word index after which the line breaks) — the strings stay untouched.
LAYOUT_BREAKS = {'reveal2': 3, 'f3': 3, 'f4': 2}
for key, val in re.findall(r"(\w+): '([^']*)'", block):
    issues = []
    if '...' in val: issues.append('three dots instead of …')
    if re.search(r'\s[؟،…!.:»]', val): issues.append('space before punctuation')
    if '  ' in val: issues.append('double space')
    if re.search(r'[0-9]', val) and key != 'instagramHandle': issues.append('Latin digits')
    if '"' in val: issues.append('straight quotes (use « »)')
    words = val.split(' ')
    lines = [l.split(' ') for l in re.split(r'(?<=…) ', val)]
    if key in LAYOUT_BREAKS:
        k = LAYOUT_BREAKS[key] + 1
        lines = [words[:k], words[k:]]
    if any(len(l) > 6 for l in lines): issues.append(f'line over 6 words: {[len(l) for l in lines]}')
    if issues: problems += 1
    print(f"{key:16} {'OK' if not issues else issues}  {val}")
print('problems:', problems)
sys.exit(1 if problems else 0)
