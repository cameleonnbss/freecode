/**
 * FreeCode — edit_file tool.
 * Replaces a single occurrence of old_text with new_text inside a file.
 * Fails if old_text is not found or appears more than once (ambiguous).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import { registerTool } from './types.js';

export const editFileTool: Tool = {
  name: 'edit_file',
  description: 'Replace a unique snippet of text inside a file. Safer than write_file for small edits.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative or absolute path.' },
      old_text: { type: 'string', description: 'The exact text to find (must be unique in the file).' },
      new_text: { type: 'string', description: 'The replacement text.' },
    },
    required: ['path', 'old_text', 'new_text'],
  },
  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const rel = String(input.path ?? '');
    const oldText = String(input.old_text ?? '');
    const newText = String(input.new_text ?? '');
    if (!rel) return { ok: false, output: 'Missing "path" argument.' };
    if (!oldText) return { ok: false, output: 'Missing "old_text" argument.' };
    const full = path.isAbsolute(rel) ? rel : path.resolve(ctx.cwd, rel);

    if (!ctx.autoConfirm && ctx.confirm) {
      const ok = await ctx.confirm('edit_file', { path: rel, oldText, newText });
      if (!ok) return { ok: false, output: 'User denied edit_file.' };
    }

    try {
      const original = fs.readFileSync(full, 'utf-8');
      const occurrences = original.split(oldText).length - 1;
      if (occurrences === 0) {
        return { ok: false, output: `old_text not found in ${rel}. Make sure it matches exactly (whitespace included).` };
      }
      if (occurrences > 1) {
        return { ok: false, output: `old_text appears ${occurrences} times in ${rel}. Make it more unique.` };
      }
      const updated = original.replace(oldText, newText);
      fs.writeFileSync(full, updated, 'utf-8');
      const relDisplay = path.relative(ctx.cwd, full) || full;
      ctx.onStatus?.(`edited ${relDisplay}`);
      return {
        ok: true,
        output: `Edited ${relDisplay}: replaced ${oldText.length} chars with ${newText.length} chars.`,
        meta: { path: relDisplay },
      };
    } catch (e) {
      return { ok: false, output: `Cannot edit file "${rel}": ${(e as Error).message}` };
    }
  },
};

registerTool(editFileTool);
