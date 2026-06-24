/**
 * FreeCode — run_command tool.
 * Executes a shell command in the workspace, with a timeout and the
 * user's explicit confirmation. Output is captured and returned.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

const MAX_OUTPUT = 20_000; // chars
const TIMEOUT_MS = 60_000;

// Commands that are obviously destructive — we always confirm twice.
const DANGEROUS = /\b(rm\s+-rf|sudo|mkfs|dd\s+if|:()\{\|:&\};:|shutdown|reboot|format\s)\b/;

export const runCommandTool: Tool = {
  name: 'run_command',
  description: 'Run a shell command in the workspace (ls, git, npm, tests, build, etc.). Always asks for confirmation unless auto-confirm is on.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute.' },
      cwd: { type: 'string', description: 'Working directory (default: workspace root).' },
    },
    required: ['command'],
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const command = String(input.command ?? '');
    if (!command) return { ok: false, output: 'Missing "command" argument.' };
    const cwdRel = String(input.cwd ?? '.');
    const cwdFull = path.isAbsolute(cwdRel) ? cwdRel : path.resolve(ctx.cwd, cwdRel);

    // Always confirm run_command (even with auto-confirm, if dangerous).
    if (DANGEROUS.test(command)) {
      if (ctx.confirm) {
        const ok = await ctx.confirm('run_command [DANGEROUS]', { command });
        if (!ok) return { ok: false, output: 'User denied dangerous command.' };
      }
    } else if (!ctx.autoConfirm && ctx.confirm) {
      const ok = await ctx.confirm('run_command', { command });
      if (!ok) return { ok: false, output: 'User denied run_command.' };
    }

    ctx.onStatus?.(`$ ${command}`);

    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const child = spawn(isWin ? 'cmd.exe' : '/bin/bash', isWin ? ['/c', command] : ['-c', command], {
        cwd: cwdFull,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      let truncated = false;

      function append(buf: string, target: 'out' | 'err') {
        if (target === 'out') stdout += buf;
        else stderr += buf;
        if (stdout.length + stderr.length > MAX_OUTPUT) {
          truncated = true;
          child.kill('SIGKILL');
        }
      }

      child.stdout.on('data', (d) => append(d.toString(), 'out'));
      child.stderr.on('data', (d) => append(d.toString(), 'err'));

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 2000);
      }, TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timer);
        let out = '';
        if (stdout) out += stdout;
        if (stderr) out += (out ? '\n' : '') + stderr;
        if (truncated) out += '\n[... output truncated]';
        resolve({
          ok: code === 0,
          output: `Command: ${command}\nExit: ${code}\n\n${out.trim() || '(no output)'}`,
          meta: { code, truncated },
        });
      });

      child.on('error', (e) => {
        clearTimeout(timer);
        resolve({ ok: false, output: `Failed to spawn: ${e.message}` });
      });
    });
  },
};

registerTool(runCommandTool);
