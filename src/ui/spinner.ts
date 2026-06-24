/**
 * FreeCode — animated spinner (neon frames).
 *
 * Minimal hand-rolled spinner so we don't pull a dependency.
 * Always cleans up its line on stop.
 */
import { COLORS, c } from './theme.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private timer: NodeJS.Timeout | null = null;
  private frame = 0;
  private msg: string;
  private readonly color: string;

  constructor(msg: string, color: string = COLORS.cyan) {
    this.msg = msg;
    this.color = color;
  }

  start(): this {
    if (this.timer) return this;
    process.stdout.write('\x1b[?25l'); // hide cursor
    this.timer = setInterval(() => {
      const f = FRAMES[this.frame % FRAMES.length];
      process.stdout.write(`\r\x1b[2K${c.cyan(f)}  ${this.msg}`);
      this.frame++;
    }, 80);
    return this;
  }

  setMessage(msg: string): this {
    this.msg = msg;
    return this;
  }

  stop(finalMessage?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    process.stdout.write('\r\x1b[2K');
    process.stdout.write('\x1b[?25h'); // show cursor
    if (finalMessage) {
      process.stdout.write(finalMessage + '\n');
    }
  }

  succeed(msg?: string): void {
    this.stop(`${c.green('✓')} ${msg ?? this.msg}`);
  }

  fail(msg?: string): void {
    this.stop(`${c.red('✗')} ${msg ?? this.msg}`);
  }
}

export function spin<T>(msg: string, fn: () => Promise<T>): Promise<T> {
  const s = new Spinner(msg).start();
  return fn().then(
    (v) => {
      s.succeed();
      return v;
    },
    (e) => {
      s.fail();
      throw e;
    },
  );
}
