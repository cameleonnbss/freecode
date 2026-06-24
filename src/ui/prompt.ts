/**
 * FreeCode — interactive prompt + confirm.
 *
 * Uses raw readline + keypress for full control over rendering.
 */
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { c, COLORS } from './theme.js';

/** Simple text input with a neon prompt prefix. */
export function prompt(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    const prefix = c.violet('❯ ') + c.gray(question) + (defaultValue ? c.dim(` [${defaultValue}]`) : '') + ' ';
    rl.question(prefix, (ans) => {
      rl.close();
      const v = ans.trim();
      resolve(v === '' && defaultValue !== undefined ? defaultValue : v);
    });
  });
}

/** Password / secret input — masks characters with •. */
export function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    const prefix = c.violet('❯ ') + c.gray(question) + ' ';
    let val = '';
    process.stdout.write(prefix);
    const onData = (ch: Buffer) => {
      const s = ch.toString('utf-8');
      if (s === '\r' || s === '\n') {
        stdin.off('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve(val);
      } else if (s === '\u0003') {
        // Ctrl+C
        stdin.off('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve('');
      } else if (s === '\u007f' || s === '\b') {
        // Backspace
        if (val.length > 0) {
          val = val.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (s >= ' ') {
        val += s;
        process.stdout.write('•');
      }
    };
    stdin.on('data', onData);
  });
}

/** Y/N confirm with default. */
export async function confirm(question: string, def: boolean = false): Promise<boolean> {
  const hint = def ? c.dim(' [Y/n]') : c.dim(' [y/N]');
  const ans = await new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    rl.question(c.violet('❯ ') + c.gray(question) + hint + ' ', (a) => {
      rl.close();
      resolve(a.trim().toLowerCase());
    });
  });
  if (ans === '') return def;
  return ans === 'y' || ans === 'yes' || ans === 'o' || ans === 'oui';
}

export interface Choice<T> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

/** Arrow-key select menu. Falls back to numbered list if !process.stdin.isTTY. */
export async function select<T>(question: string, choices: Choice<T>[]): Promise<T | null> {
  const usable = choices.filter((c) => !c.disabled);
  if (usable.length === 0) return null;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    // Fallback: numbered list
    process.stdout.write(c.violet('❯ ') + c.gray(question) + '\n');
    usable.forEach((ch, i) => {
      process.stdout.write(`  ${c.cyan(String(i + 1))}  ${ch.label}${ch.description ? c.gray(' — ' + ch.description) : ''}\n`);
    });
    const ans = await prompt(`(1-${usable.length})`);
    const n = parseInt(ans, 10);
    if (n >= 1 && n <= usable.length) return usable[n - 1].value;
    return null;
  }

  return new Promise((resolve) => {
    let idx = 0;
    const render = () => {
      const lines = [c.violet('❯ ') + c.gray(question), ''];
      usable.forEach((ch, i) => {
        const marker = i === idx ? c.cyan('▸') : ' ';
        const label = i === idx ? c.bold(ch.label) : ch.label;
        const desc = ch.description ? c.gray('  ' + ch.description) : '';
        lines.push(`  ${marker} ${label}${desc}`);
      });
      lines.push('');
      lines.push(c.gray('  ↑/↓ naviguer · Entrée valider · Esc annuler'));
      process.stdout.write('\x1b[?25l'); // hide cursor
      process.stdout.write(lines.join('\n') + '\n');
    };
    const clear = () => {
      // Move cursor up by N lines and clear each
      const n = usable.length + 4;
      process.stdout.write(`\x1b[${n}A`);
      for (let i = 0; i < n; i++) process.stdout.write('\x1b[2K\x1b[1B');
      process.stdout.write(`\x1b[${n}A`);
    };
    render();
    const onData = (buf: Buffer) => {
      const s = buf.toString('utf-8');
      if (s === '\u001b[A' || s === 'k') {
        idx = (idx - 1 + usable.length) % usable.length;
        clear();
        render();
      } else if (s === '\u001b[B' || s === 'j') {
        idx = (idx + 1) % usable.length;
        clear();
        render();
      } else if (s === '\r' || s === '\n') {
        stdin.off('data', onData);
        clear();
        process.stdout.write('\x1b[?25h');
        resolve(usable[idx].value);
      } else if (s === '\u001b' || s === '\u0003' || s === 'q') {
        stdin.off('data', onData);
        clear();
        process.stdout.write('\x1b[?25h');
        resolve(null);
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** Multi-select with space to toggle. */
export async function multiselect<T>(question: string, choices: Choice<T>[]): Promise<T[]> {
  const usable = choices.filter((c) => !c.disabled);
  if (usable.length === 0) return [];

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(c.violet('❯ ') + c.gray(question) + ' (comma-separated indices)\n');
    usable.forEach((ch, i) => {
      process.stdout.write(`  ${c.cyan(String(i + 1))}  ${ch.label}\n`);
    });
    const ans = await prompt(`(ex: 1,3)`);
    return ans
      .split(',')
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((n) => n >= 0 && n < usable.length)
      .map((n) => usable[n].value);
  }

  return new Promise((resolve) => {
    let idx = 0;
    const picked = new Set<number>();
    const render = () => {
      const lines = [c.violet('❯ ') + c.gray(question), ''];
      usable.forEach((ch, i) => {
        const marker = i === idx ? c.cyan('▸') : ' ';
        const check = picked.has(i) ? c.green('◉') : c.gray('◯');
        const label = i === idx ? c.bold(ch.label) : ch.label;
        lines.push(`  ${marker} ${check} ${label}`);
      });
      lines.push('');
      lines.push(c.gray('  ↑/↓ naviguer · Espace basculer · Entrée valider · Esc annuler'));
      process.stdout.write('\x1b[?25l');
      process.stdout.write(lines.join('\n') + '\n');
    };
    const clear = () => {
      const n = usable.length + 4;
      process.stdout.write(`\x1b[${n}A`);
      for (let i = 0; i < n; i++) process.stdout.write('\x1b[2K\x1b[1B');
      process.stdout.write(`\x1b[${n}A`);
    };
    render();
    const onData = (buf: Buffer) => {
      const s = buf.toString('utf-8');
      if (s === '\u001b[A' || s === 'k') {
        idx = (idx - 1 + usable.length) % usable.length;
        clear();
        render();
      } else if (s === '\u001b[B' || s === 'j') {
        idx = (idx + 1) % usable.length;
        clear();
        render();
      } else if (s === ' ') {
        if (picked.has(idx)) picked.delete(idx);
        else picked.add(idx);
        clear();
        render();
      } else if (s === '\r' || s === '\n') {
        stdin.off('data', onData);
        clear();
        process.stdout.write('\x1b[?25h');
        resolve(Array.from(picked).map((i) => usable[i].value));
      } else if (s === '\u001b' || s === '\u0003' || s === 'q') {
        stdin.off('data', onData);
        clear();
        process.stdout.write('\x1b[?25h');
        resolve([]);
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
