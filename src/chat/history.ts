/**
 * FreeCode — persisted chat history.
 *
 * Each session is a JSON file under ~/.freecode/history/<project-slug>/.
 * A session file holds the message list + metadata, so it can be resumed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { projectHistoryDir } from '../core/paths.js';
import type { Message } from '../providers/types.js';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  model: string;
  agent: string;
  messages: Message[];
}

export function newSession(opts: { cwd: string; providerId: string; model: string; agent: string; title?: string }): ChatSession {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  return {
    id,
    title: opts.title ?? 'Untitled',
    createdAt: now,
    updatedAt: now,
    providerId: opts.providerId,
    model: opts.model,
    agent: opts.agent,
    messages: [],
  };
}

export function saveSession(cwd: string, session: ChatSession): void {
  session.updatedAt = new Date().toISOString();
  const dir = projectHistoryDir(cwd);
  const file = path.join(dir, `${session.id}.json`);
  fs.writeFileSync(file, JSON.stringify(session, null, 2), 'utf-8');
}

export function loadSession(cwd: string, id: string): ChatSession | null {
  const dir = projectHistoryDir(cwd);
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ChatSession;
  } catch {
    return null;
  }
}

export function listSessions(cwd: string): ChatSession[] {
  const dir = projectHistoryDir(cwd);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const sessions: ChatSession[] = [];
  for (const f of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as ChatSession;
      sessions.push(s);
    } catch {
      /* skip corrupt */
    }
  }
  return sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function deleteSession(cwd: string, id: string): boolean {
  const dir = projectHistoryDir(cwd);
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

/** Auto-title a session from the first user message. */
export function titleFromFirstMessage(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 60) return clean || 'Untitled';
  return clean.slice(0, 57) + '…';
}
