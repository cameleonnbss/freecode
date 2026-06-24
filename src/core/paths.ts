/**
 * FreeCode — filesystem paths for user data.
 * Everything lives under ~/.freecode/ so the install stays clean.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const HOME = os.homedir();

export const FREECODE_DIR = path.join(HOME, '.freecode');
export const CONFIG_FILE = path.join(FREECODE_DIR, 'config.json');
export const HISTORY_DIR = path.join(FREECODE_DIR, 'history');
export const MEMORY_DIR = path.join(FREECODE_DIR, 'memory');
export const AGENTS_DIR = path.join(FREECODE_DIR, 'agents');
export const LOG_FILE = path.join(FREECODE_DIR, 'freecode.log');

/** Ensure all the standard directories exist. Safe to call on every boot. */
export function ensureDirs(): void {
  for (const dir of [FREECODE_DIR, HISTORY_DIR, MEMORY_DIR, AGENTS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/** Per-project session dir (so history is scoped to a repo). */
export function projectHistoryDir(cwd: string): string {
  const slug = cwd
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'default';
  const dir = path.join(HISTORY_DIR, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
