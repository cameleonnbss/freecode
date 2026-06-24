/**
 * FreeCode — write_file tool.
 * Creates or overwrites a file in the workspace.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create or overwrite a file with the given content. Creates parent dirs if needed.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative or absolute path.' },
      content: { type: 'string', description: 'Full file content to write.' },
    },
    required: ['path', 'content'],
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const rel = String(input.path ?? '');
    const content = String(input.content ?? '');
    if (!rel) return { ok: false, output: 'Missing "path" argument.' };
    const full = path.isAbsolute(rel) ? rel : path.resolve(ctx.cwd, rel);

    // Confirm with the user (unless auto-confirm is on).
    if (!ctx.autoConfirm && ctx.confirm) {
      const ok = await ctx.confirm('write_file', { path: rel, bytes: content.length });
      if (!ok) return { ok: false, output: 'User denied write_file.' };
    }

    try {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      const existed = fs.existsSync(full);
      const prevSize = existed ? fs.statSync(full).size : 0;
      fs.writeFileSync(full, content, 'utf-8');
      const relDisplay = path.relative(ctx.cwd, full) || full;
      ctx.onStatus?.(`${existed ? 'updated' : 'created'} ${relDisplay} (${content.length} bytes)`);
      return {
        ok: true,
        output: `${existed ? 'Updated' : 'Created'} file ${relDisplay} (${content.length} bytes, was ${prevSize}).`,
        meta: { path: relDisplay, bytes: content.length, existed },
      };
    } catch (e) {
      return { ok: false, output: `Cannot write file "${rel}": ${(e as Error).message}` };
    }
  },
};

registerTool(writeFileTool);
