/**
 * FreeCode — minimal logger to ~/.freecode/freecode.log
 * Used for debugging when the TUI is misbehaving.
 */
import fs from 'node:fs';
import { LOG_FILE, ensureDirs } from './paths.js';

let initialized = false;
function ensureInit() {
  if (!initialized) {
    ensureDirs();
    initialized = true;
  }
}

export function log(line: string): void {
  try {
    ensureInit();
    const stamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`, 'utf-8');
  } catch {
    // swallow — logging must never break the app
  }
}

export function logError(err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  log(`ERROR: ${msg}`);
}
