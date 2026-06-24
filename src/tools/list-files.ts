/**
 * FreeCode — list_files tool.
 * Lists files in a directory, respecting common ignore patterns.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache', '.venv',
  'venv', '__pycache__', '.pytest_cache', '.idea', '.vscode', 'coverage',
  '.DS_Store', 'target', '.gradle', '.mvn',
]);

export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List files and directories in the workspace (respects common ignore patterns).',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to list (default: workspace root).' },
      recursive: { type: 'boolean', description: 'Recurse into subdirectories (default: false).' },
    },
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const rel = String(input.path ?? '.');
    const recursive = Boolean(input.recursive);
    const full = path.isAbsolute(rel) ? rel : path.resolve(ctx.cwd, rel);
    try {
      const stat = fs.statSync(full);
      if (!stat.isDirectory()) {
        return { ok: false, output: `Not a directory: ${rel}` };
      }
      const lines: string[] = [];
      const cap = 500;
      let count = 0;
      function walk(dir: string, depth: number) {
        if (count >= cap) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.sort((a, b) => (a.name < b.name ? -1 : 1));
        for (const e of entries) {
          if (IGNORE.has(e.name)) continue;
          if (count >= cap) {
            lines.push('... (truncated)');
            return;
          }
          const indent = '  '.repeat(depth);
          const suffix = e.isDirectory() ? '/' : '';
          lines.push(`${indent}${e.name}${suffix}`);
          count++;
          if (recursive && e.isDirectory()) {
            walk(path.join(dir, e.name), depth + 1);
          }
        }
      }
      walk(full, 0);
      const relDisplay = path.relative(ctx.cwd, full) || full;
      ctx.onStatus?.(`listed ${relDisplay} (${count} entries)`);
      return {
        ok: true,
        output: `Directory: ${relDisplay}\n\n${lines.join('\n')}`,
        meta: { count },
      };
    } catch (e) {
      return { ok: false, output: `Cannot list "${rel}": ${(e as Error).message}` };
    }
  },
};

registerTool(listFilesTool);
