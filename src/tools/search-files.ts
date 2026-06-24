/**
 * FreeCode — search_files tool.
 * Recursively greps for a pattern in the workspace.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache', '.venv',
  'venv', '__pycache__', '.pytest_cache', '.idea', '.vscode', 'coverage',
  'target', '.gradle',
]);

const MAX_MATCHES = 100;

export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'Recursively search for a text/regex pattern in files of the workspace. Returns matching lines with file:line.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Substring or regex pattern to search for.' },
      glob: { type: 'string', description: 'File extension filter, e.g. "*.ts" (default: all files).' },
      max_results: { type: 'number', description: 'Max matches to return (default: 100).' },
    },
    required: ['pattern'],
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const pattern = String(input.pattern ?? '');
    if (!pattern) return { ok: false, output: 'Missing "pattern" argument.' };
    const glob = String(input.glob ?? '*');
    const max = Number(input.max_results ?? MAX_MATCHES);
    let re: RegExp;
    try {
      re = new RegExp(pattern, 'i');
    } catch {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const ext = glob.startsWith('*.') ? glob.slice(2) : null;

    const matches: string[] = [];
    const roots = [ctx.cwd];

    function walk(dir: string) {
      if (matches.length >= max) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (matches.length >= max) return;
        if (IGNORE.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (e.isFile()) {
          if (ext && !e.name.endsWith('.' + ext)) continue;
          // Skip huge or binary-looking files
          try {
            const stat = fs.statSync(p);
            if (stat.size > 500_000) continue;
          } catch {
            continue;
          }
          try {
            const content = fs.readFileSync(p, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                const rel = path.relative(ctx.cwd, p) || p;
                const line = lines[i].trim().slice(0, 200);
                matches.push(`${rel}:${i + 1}: ${line}`);
                if (matches.length >= max) break;
              }
            }
          } catch {
            /* binary file — skip */
          }
        }
      }
    }

    for (const r of roots) walk(r);

    ctx.onStatus?.(`searched "${pattern}" → ${matches.length} match(es)`);
    if (matches.length === 0) {
      return { ok: true, output: `No matches for "${pattern}".`, meta: { count: 0 } };
    }
    return {
      ok: true,
      output: `Found ${matches.length} match(es) for "${pattern}":\n\n${matches.join('\n')}`,
      meta: { count: matches.length },
    };
  },
};

registerTool(searchFilesTool);
