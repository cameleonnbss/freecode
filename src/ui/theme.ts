/**
 * FreeCode — neon theme (gradient violet/cyan).
 */
import chalk from 'chalk';

// Force color even when piped — we're a TUI, the user wants the neon.
// chalk.level is a ColorSupportLevel enum (0|1|2|3).
chalk.level = 2 as any;

export const COLORS = {
  violet: '#a855f7',
  purple: '#7c3aed',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  pink: '#ec4899',
  green: '#10b981',
  yellow: '#eab308',
  red: '#ef4444',
  gray: '#6b7280',
  white: '#f8fafc',
} as const;

export const c = {
  violet: (s: string) => chalk.hex(COLORS.violet)(s),
  purple: (s: string) => chalk.hex(COLORS.purple)(s),
  cyan: (s: string) => chalk.hex(COLORS.cyan)(s),
  blue: (s: string) => chalk.hex(COLORS.blue)(s),
  pink: (s: string) => chalk.hex(COLORS.pink)(s),
  green: (s: string) => chalk.hex(COLORS.green)(s),
  yellow: (s: string) => chalk.hex(COLORS.yellow)(s),
  red: (s: string) => chalk.hex(COLORS.red)(s),
  gray: (s: string) => chalk.hex(COLORS.gray)(s),
  dim: (s: string) => chalk.dim(s),
  bold: (s: string) => chalk.bold(s),
  italic: (s: string) => chalk.italic(s),
  underline: (s: string) => chalk.underline(s),
};

// 2-stop gradient helpers — kept as chalk.hex combinations.
export function neon(s: string): string {
  // Approximate gradient by alternating colors per char.
  const stops = [COLORS.violet, COLORS.purple, COLORS.cyan, COLORS.blue];
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '\n') {
      out += ch;
      continue;
    }
    const stop = stops[i % stops.length];
    out += chalk.hex(stop)(ch);
  }
  return out;
}

export function gradientLine(s: string, from: string = COLORS.violet, to: string = COLORS.cyan): string {
  // Per-char linear interpolation between two hex colors.
  const fr = hexToRgb(from);
  const toRgb = hexToRgb(to);
  let out = '';
  const len = Math.max(s.length, 1);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '\n') {
      out += ch;
      continue;
    }
    const t = i / len;
    const r = Math.round(fr.r + (toRgb.r - fr.r) * t);
    const g = Math.round(fr.g + (toRgb.g - fr.g) * t);
    const b = Math.round(fr.b + (toRgb.b - fr.b) * t);
    out += chalk.rgb(r, g, b)(ch);
  }
  return out;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Wrap a string in a colored block border. */
export function box(s: string, color: string = COLORS.violet): string {
  const lines = s.split('\n');
  const w = Math.max(...lines.map((l) => l.length));
  const top = chalk.hex(color)(`╭${'─'.repeat(w + 2)}╮`);
  const bot = chalk.hex(color)(`╰${'─'.repeat(w + 2)}╯`);
  const mid = lines.map((l) => chalk.hex(color)('│ ') + l.padEnd(w) + chalk.hex(color)(' │')).join('\n');
  return `${top}\n${mid}\n${bot}`;
}
