/**
 * FreeCode — `freecode history` command.
 * Lists previous sessions for the current project, lets the user resume one.
 */
import { listSessions, loadSession, deleteSession } from '../../chat/history.js';
import { select, confirm } from '../../ui/prompt.js';
import { c } from '../../ui/theme.js';
import { t } from '../../i18n/index.js';
import { startChat } from '../../chat/session.js';

export async function cmdHistory(cwd: string, flags: Record<string, string | boolean>): Promise<void> {
  const sessions = listSessions(cwd);
  if (sessions.length === 0) {
    process.stdout.write(c.gray(t('history_empty')) + '\n');
    return;
  }

  const resumeId = typeof flags.resume === 'string' ? flags.resume : undefined;
  if (resumeId) {
    await startChat({ cwd, resumeSessionId: resumeId });
    return;
  }

  const choices = sessions.map((s) => ({
    label: `${s.title} — ${new Date(s.updatedAt).toLocaleString()} (${s.messages.length} msgs, ${s.providerId})`,
    value: s.id,
    description: `model: ${s.model}`,
  }));
  const id = await select(t('history_resume_prompt'), [
    ...choices,
    { label: c.red('Delete a session…'), value: '__delete__' },
  ]);

  if (id === '__delete__') {
    const del = await select('Delete which session?', choices);
    if (del && (await confirm('Delete?', false))) {
      deleteSession(cwd, del);
      process.stdout.write(c.green('✓ deleted') + '\n');
    }
    return;
  }
  if (id) {
    await startChat({ cwd, resumeSessionId: id });
  }
}

/** Just print the list (non-interactive). */
export function cmdHistoryList(cwd: string): void {
  const sessions = listSessions(cwd);
  if (sessions.length === 0) {
    process.stdout.write(c.gray(t('history_empty')) + '\n');
    return;
  }
  process.stdout.write(c.bold('Sessions in ' + cwd + ':\n'));
  for (const s of sessions) {
    process.stdout.write(`  ${c.cyan(s.id)}  ${s.title}  ${c.gray(new Date(s.updatedAt).toLocaleString())}  ${c.gray('(' + s.messages.length + ' msgs)')}\n`);
  }
}
