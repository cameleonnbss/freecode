/**
 * FreeCode — long-term memory.
 *
 * A simple key-value store at ~/.freecode/memory/memory.json. The agent
 * can persist facts about the user, the project, preferences, etc. across
 * sessions. Loaded into the system prompt as "Long-term memory".
 */
import fs from 'node:fs';
import path from 'node:path';
import { MEMORY_DIR, ensureDirs } from '../core/paths.js';

const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.json');

export interface MemoryStore {
  [key: string]: string;
}

export function loadMemory(): MemoryStore {
  ensureDirs();
  if (!fs.existsSync(MEMORY_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')) as MemoryStore;
  } catch {
    return {};
  }
}

export function saveMemory(mem: MemoryStore): void {
  ensureDirs();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), 'utf-8');
}

export function remember(key: string, value: string): void {
  const mem = loadMemory();
  mem[key] = value;
  saveMemory(mem);
}

export function forget(key: string): boolean {
  const mem = loadMemory();
  if (!(key in mem)) return false;
  delete mem[key];
  saveMemory(mem);
  return true;
}

/** Render memory as a system-prompt block. */
export function memoryPromptBlock(): string {
  const mem = loadMemory();
  const keys = Object.keys(mem);
  if (keys.length === 0) return '';
  const lines = keys.map((k) => `- ${k}: ${mem[k]}`);
  return `\n\n# LONG-TERM MEMORY (persisted across sessions)\n${lines.join('\n')}`;
}
