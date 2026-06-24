/**
 * FreeCode — `freecode agents` command.
 * List, create, delete agent personas.
 */
import { listAgents, saveAgent, deleteAgent, type AgentDef } from '../../agent/agents.js';
import { select, prompt, confirm } from '../../ui/prompt.js';
import { c } from '../../ui/theme.js';
import { t } from '../../i18n/index.js';
import { loadConfig, saveConfig } from '../../core/config.js';

export async function cmdAgents(flags: Record<string, string | boolean>): Promise<void> {
  const cfg = loadConfig();

  if (flags.create) {
    await createAgent();
    return;
  }

  const agents = listAgents();
  const choices = agents.map((a) => ({
    label: `${a.name}${a.builtIn ? c.gray(' (built-in)') : ''}${a.id === cfg.defaultAgent ? c.green(' ● active') : ''}`,
    value: a.id,
    description: a.persona.slice(0, 80) + (a.persona.length > 80 ? '…' : ''),
  }));

  const id = await select(t('agents_list'), [
    ...choices,
    { label: c.cyan('+ ' + t('agents_create')), value: '__create__' },
    { label: c.red('Delete a custom agent…'), value: '__delete__' },
  ]);

  if (id === '__create__') {
    await createAgent();
    return;
  }
  if (id === '__delete__') {
    const del = await select('Delete which agent?', choices.filter((c) => !c.value.startsWith('__')));
    if (del) {
      const a = agents.find((x) => x.id === del);
      if (a?.builtIn) {
        process.stdout.write(c.red("Can't delete a built-in agent.") + '\n');
        return;
      }
      if (await confirm(t('confirm'), false)) {
        deleteAgent(del);
        process.stdout.write(c.green(t('agents_deleted')) + '\n');
      }
    }
    return;
  }
  if (id) {
    cfg.defaultAgent = id;
    saveConfig(cfg);
    const a = agents.find((x) => x.id === id);
    process.stdout.write(c.green('✓ active agent: ' + (a?.name ?? id)) + '\n');
  }
}

async function createAgent(): Promise<void> {
  const name = await prompt(t('agents_name'));
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  process.stdout.write(c.gray('Write the persona (system instructions). End with an empty line.') + '\n');
  const persona = await readMultiline();
  if (!persona.trim()) {
    process.stdout.write(c.red('Empty persona, aborting.') + '\n');
    return;
  }
  const def: AgentDef = { id, name, persona };
  saveAgent(def);
  process.stdout.write(c.green(t('agents_created') + ': ' + name) + '\n');
}

async function readMultiline(): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let blank = 0;
    process.stdin.setEncoding('utf-8');
    process.stdout.write(c.violet('❯ ') + c.gray('persona (two empty lines to finish)') + '\n');
    const onData = (chunk: string) => {
      const parts = chunk.split('\n');
      for (const p of parts) {
        if (p === '' || p === '\r') {
          blank++;
          if (blank >= 2) {
            process.stdin.off('data', onData);
            resolve(lines.join('\n'));
            return;
          }
        } else {
          blank = 0;
          lines.push(p.replace(/\r$/, ''));
        }
      }
    };
    process.stdin.on('data', onData);
  });
}
