/**
 * FreeCode — read_file tool.
 * Reads a file from the workspace, returns its content (truncated if huge).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

const MAX_BYTES = 200_000; // ~200KB cap to keep context sane

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the content of a file in the workspace. Use for inspecting source code, configs, docs.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative or absolute path to the file.' },
    },
    required: ['path'],
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const rel = String(input.path ?? '');
    if (!rel) return { ok: false, output: 'Missing "path" argument.' };
    const full = path.isAbsolute(rel) ? rel : path.resolve(ctx.cwd, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        return { ok: false, output: `Path is a directory: ${rel}. Use list_files instead.` };
      }
      const buf = fs.readFileSync(full);
      const truncated = buf.length > MAX_BYTES;
      const text = buf.slice(0, MAX_BYTES).toString('utf-8');
      const note = truncated ? `\n\n[... truncated, ${buf.length - MAX_BYTES} more bytes not shown]` : '';
      const relDisplay = path.relative(ctx.cwd, full) || full;
      ctx.onStatus?.(`read ${relDisplay} (${buf.length} bytes)`);
      return {
        ok: true,
        output: `File: ${relDisplay} (${buf.length} bytes)\n\n\`\`\`\n${text}${note}\n\`\`\``,
        meta: { path: relDisplay, bytes: buf.length, truncated },
      };
    } catch (e) {
      return { ok: false, output: `Cannot read file "${rel}": ${(e as Error).message}` };
    }
  },
};

registerTool(readFileTool);
