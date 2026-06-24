/**
 * FreeCode — minimal markdown renderer for the terminal.
 *
 * Handles: headings, bold/italic/code, inline code, fenced code blocks,
 * bullet/numbered lists, blockquotes, hr. Good enough for chat output.
 */
import chalk from 'chalk';
import { COLORS, c } from './theme.js';

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeBuf: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block toggle
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inCode) {
        inCode = true;
        codeLang = fence[1] ?? '';
        codeBuf = [];
      } else {
        // flush code block
        out.push(renderCodeBlock(codeBuf.join('\n'), codeLang));
        inCode = false;
        codeLang = '';
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      const colors = [COLORS.violet, COLORS.cyan, COLORS.blue, COLORS.pink, COLORS.purple, COLORS.gray];
      out.push(chalk.hex(colors[level - 1] ?? COLORS.gray).bold(text));
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line) && line.trim().length > 0) {
      out.push(c.gray('─'.repeat(60)));
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      out.push(c.gray('│ ') + c.italic(inline(line.replace(/^>\s?/, ''))));
      continue;
    }

    // Numbered list
    const num = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (num) {
      const indent = num[1];
      const n = num[2];
      out.push(`${indent}${c.cyan(n + '.')} ${inline(num[3])}`);
      continue;
    }

    // Bullet list
    const bul = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bul) {
      const indent = bul[1];
      out.push(`${indent}${c.violet('•')} ${inline(bul[2])}`);
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      out.push('');
      continue;
    }

    // Default paragraph
    out.push(inline(line));
  }

  // Flush trailing code block if missing closing fence
  if (inCode && codeBuf.length > 0) {
    out.push(renderCodeBlock(codeBuf.join('\n'), codeLang));
  }

  return out.join('\n');
}

function inline(s: string): string {
  // Inline code first (so we don't process formatting inside)
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i) {
        const code = s.slice(i + 1, end);
        out += chalk.bgHex('#1e1b2e').hex(COLORS.cyan)(' ' + code + ' ');
        i = end + 1;
        continue;
      }
    }
    if (s[i] === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2);
      if (end > i) {
        out += chalk.bold(s.slice(i + 2, end));
        i = end + 2;
        continue;
      }
    }
    if (s[i] === '_' && s[i + 1] === '_') {
      const end = s.indexOf('__', i + 2);
      if (end > i) {
        out += chalk.bold(s.slice(i + 2, end));
        i = end + 2;
        continue;
      }
    }
    if (s[i] === '*' || s[i] === '_') {
      const ch = s[i];
      const end = s.indexOf(ch, i + 1);
      if (end > i) {
        out += chalk.italic(s.slice(i + 1, end));
        i = end + 1;
        continue;
      }
    }
    // links [text](url)
    if (s[i] === '[') {
      const close = s.indexOf(']', i + 1);
      if (close > i && s[close + 1] === '(') {
        const paren = s.indexOf(')', close + 2);
        if (paren > close) {
          const text = s.slice(i + 1, close);
          const url = s.slice(close + 2, paren);
          out += chalk.hex(COLORS.blue).underline(text) + chalk.gray(` (${url})`);
          i = paren + 1;
          continue;
        }
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

function renderCodeBlock(code: string, lang: string): string {
  const lines = code.split('\n');
  const w = Math.max(...lines.map((l) => l.length), lang.length + 4, 20);
  const border = c.gray('─'.repeat(w + 2));
  const header = lang ? c.gray('[' + lang + ']') : '';
  const top = c.gray('╭') + (header ? header + c.gray('─'.repeat(Math.max(0, w - header.length - 2 + 2))) : c.gray('─'.repeat(w))) + c.gray('╮');
  const bot = c.gray('╰') + c.gray('─'.repeat(w)) + c.gray('╯');
  const body = lines.map((l) => c.gray('│ ') + chalk.bgHex('#0f0e1a').hex('#e2e8f0')(l.padEnd(w)) + c.gray(' │')).join('\n');
  return [top, body, bot].join('\n');
}
