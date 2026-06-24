/**
 * FreeCode — CLI argument parser.
 *
 * Minimal hand-rolled parser: subcommand + flags + positional args.
 * No external dependency (keep the install footprint tiny).
 */
export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
  /** Original argv (without node + script). */
  raw: string[];
}

const ALIASES: Record<string, string> = {
  '-v': '--version',
  '-h': '--help',
  '-m': '--model',
  '-p': '--provider',
  '-r': '--resume',
};

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command = 'chat'; // default

  let i = 0;
  // First positional that isn't a flag becomes the command.
  if (args.length > 0 && !args[0].startsWith('-')) {
    command = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    let a = args[i];
    a = ALIASES[a] ?? a;

    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        flags[a.slice(2)] = a.slice(eq + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[a.slice(2)] = args[++i];
      } else {
        flags[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }

  return { command, positional, flags, raw: args };
}

export function flagString(flags: Record<string, string | boolean>, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags[n];
    if (typeof v === 'string') return v;
    if (v === true) return '';
  }
  return undefined;
}

export function flagBool(flags: Record<string, string | boolean>, ...names: string[]): boolean {
  for (const n of names) {
    if (flags[n] !== undefined) return true;
  }
  return false;
}
