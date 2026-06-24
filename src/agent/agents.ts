/**
 * FreeCode — agent personas.
 *
 * An agent is just a name + a persona (system instructions) + an optional
 * model override. Stored as JSON files under ~/.freecode/agents/.
 * The default agent is shipped in-code; user-created ones live on disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AGENTS_DIR, ensureDirs } from '../core/paths.js';

export interface AgentDef {
  id: string;
  name: string;
  persona: string;
  model?: string;
  builtIn?: boolean;
}

const DEFAULT_AGENT: AgentDef = {
  id: 'default',
  name: 'FreeCode',
  persona: 'A pragmatic, concise terminal coding assistant. Inspect before acting, prefer small edits, explain outcomes briefly.',
  builtIn: true,
};

const BUILT_IN_AGENTS: AgentDef[] = [
  DEFAULT_AGENT,
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    persona: 'A meticulous code reviewer. Read the code carefully, point out bugs, security issues, style problems, and suggest concrete improvements with diffs. Be honest about what is wrong.',
    builtIn: true,
  },
  {
    id: 'explainer',
    name: 'Explainer',
    persona: 'A patient teacher. Explain code concepts clearly with examples. Adapt to the user\'s level. Use analogies when helpful. Prefer simple words over jargon.',
    builtIn: true,
  },
  {
    id: 'refactorer',
    name: 'Refactorer',
    persona: 'A senior software engineer focused on clean code. Identify duplication, long functions, poor names, and propose refactors that preserve behavior. Always run tests if available.',
    builtIn: true,
  },
  {
    id: 'bug-hunter',
    name: 'Bug Hunter',
    persona: 'A debugging specialist. Reproduce the issue, form hypotheses, inspect relevant code and logs, narrow down the root cause, propose a minimal fix. Verify the fix actually works.',
    builtIn: true,
  },
];

export function listAgents(): AgentDef[] {
  ensureDirs();
  const custom: AgentDef[] = [];
  if (fs.existsSync(AGENTS_DIR)) {
    for (const f of fs.readdirSync(AGENTS_DIR).filter((x) => x.endsWith('.json'))) {
      try {
        custom.push(JSON.parse(fs.readFileSync(path.join(AGENTS_DIR, f), 'utf-8')) as AgentDef);
      } catch {
        /* skip */
      }
    }
  }
  return [...BUILT_IN_AGENTS, ...custom];
}

export function getAgent(id: string): AgentDef | null {
  return listAgents().find((a) => a.id === id) ?? null;
}

export function saveAgent(a: AgentDef): void {
  ensureDirs();
  const file = path.join(AGENTS_DIR, `${a.id}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...a, builtIn: false }, null, 2), 'utf-8');
}

export function deleteAgent(id: string): boolean {
  if (BUILT_IN_AGENTS.some((a) => a.id === id)) return false; // can't delete built-in
  const file = path.join(AGENTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
