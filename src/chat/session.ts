/**
 * FreeCode — interactive chat REPL.
 *
 * Wires together: provider + agent loop + tools + history + memory + UI.
 * Handles slash commands (/help, /clear, /save, /models, /provider,
 * /history, /theme, /lang, /agents, /exit, …) inline.
 */
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';

import type { AppConfig } from '../core/defaults.js';
import { loadConfig, saveConfig, getProviderConfig } from '../core/config.js';
import { buildProvider } from '../providers/registry.js';
import type { Message } from '../providers/types.js';
import { runAgentTurn } from '../agent/agent.js';
import { buildSystemPrompt } from '../agent/system-prompt.js';
import { getAgent } from '../agent/agents.js';
import { memoryPromptBlock, remember } from './memory.js';
import { newSession, saveSession, loadSession, listSessions, titleFromFirstMessage, type ChatSession } from './history.js';
import { confirm } from '../ui/prompt.js';
import { renderMarkdown } from '../ui/markdown.js';
import { Spinner } from '../ui/spinner.js';
import { c, COLORS } from '../ui/theme.js';
import { t, getLang, setLang } from '../i18n/index.js';
import { log } from '../core/logger.js';
import '../tools/index.js'; // register tools

export interface ChatOptions {
  cwd: string;
  resumeSessionId?: string;
  initialPrompt?: string;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  let cfg = loadConfig();
  const providerCfg = getProviderConfig(cfg, cfg.activeProviderId);
  if (!providerCfg) {
    stdout.write(c.red(t('err_no_provider')) + '\n');
    return;
  }
  const provider = buildProvider(providerCfg);
  const model = cfg.activeModel || providerCfg.defaultModel || '';
  if (!model) {
    stdout.write(c.red(t('err_no_model')) + '\n');
    return;
  }

  // Load or create session.
  let session: ChatSession;
  if (opts.resumeSessionId) {
    const loaded = loadSession(opts.cwd, opts.resumeSessionId);
    if (!loaded) {
      stdout.write(c.red(t('err_aborted')) + '\n');
      return;
    }
    session = loaded;
    stdout.write(c.gray(t('chat_resume') + ': ' + session.title) + '\n');
  } else {
    session = newSession({
      cwd: opts.cwd,
      providerId: cfg.activeProviderId,
      model,
      agent: cfg.defaultAgent,
    });
  }

  const agentDef = getAgent(cfg.defaultAgent) ?? getAgent('default')!;

  // Track auto-confirm state per session.
  let autoConfirm = cfg.autoConfirmTools;

  // Render initial assistant turn header.
  function printPrompt() {
    stdout.write(c.violet('❯ ') + c.gray(t('chat_placeholder')) + ' ');
  }

  // Confirm callback for tools.
  async function confirmTool(name: string, input: Record<string, unknown>): Promise<boolean> {
    if (autoConfirm) return true;
    const preview = JSON.stringify(input, null, 2).slice(0, 400);
    stdout.write('\n' + c.yellow('⚠ ' + t('chat_confirm_tool') + ': ') + c.bold(name) + '\n');
    stdout.write(c.gray(preview) + '\n');
    return confirm(t('chat_allow'), true);
  }

  // Run one user → agent turn.
  async function runTurn(userText: string): Promise<void> {
    // Title the session from the first user message.
    if (session.messages.length === 0) {
      session.title = titleFromFirstMessage(userText);
    }

    const system = buildSystemPrompt({
      cwd: opts.cwd,
      agentName: agentDef.name,
      agentPersona: agentDef.persona,
      language: getLang(),
    }) + memoryPromptBlock();

    // Spinner shown while the model is thinking (before any text arrives).
    const spinner = new Spinner(t('chat_thinking') + '…');
    let spinnerActive = false;

    // Streamed text is rendered as markdown once the turn is complete;
    // during streaming we write raw deltas so the user sees progress.
    let streamed = '';
    let wroteNewlineBeforeAnswer = false;
    const onText = (delta: string) => {
      // Stop the spinner as soon as real text arrives — otherwise its
      // carriage-return refresh would erase the answer.
      if (spinnerActive) {
        spinner.stop();
        spinnerActive = false;
      }
      if (!wroteNewlineBeforeAnswer) {
        stdout.write('\n');
        wroteNewlineBeforeAnswer = true;
      }
      process.stdout.write(delta);
      streamed += delta;
    };

    const onTurnStart = () => {
      if (!spinnerActive) {
        spinner.start();
        spinnerActive = true;
      }
    };
    const onToolStart = (name: string, _input: Record<string, unknown>) => {
      if (spinnerActive) {
        spinner.stop();
        spinnerActive = false;
      }
      stdout.write(c.cyan('⟡ ' + t('chat_running_tool') + ': ') + c.bold(name) + '\n');
    };
    const onToolEnd = (_name: string, ok: boolean, _output: string) => {
      // Tool output is already echoed by the tool's onStatus; nothing else to do.
      if (!ok) stdout.write(c.red('  ' + t('err_tool') + '\n'));
    };

    // The spinner needs to start as soon as we send the request.
    spinner.start();
    spinnerActive = true;

    try {
      const result = await runAgentTurn(session.messages, userText, {
        provider,
        model,
        system,
        cwd: opts.cwd,
        toolCtx: {
          cwd: opts.cwd,
          autoConfirm,
          confirm: confirmTool,
          onStatus: (m) => {
            if (spinnerActive) {
              spinner.setMessage(m);
            } else {
              stdout.write(c.gray('  ' + m + '\n'));
            }
          },
        },
        onText,
        onToolStart,
        onToolEnd,
        onTurnStart,
      });

      if (spinnerActive) {
        spinner.stop();
        spinnerActive = false;
      }

      // Re-render the streamed text as markdown for nicer formatting.
      if (streamed.trim().length > 0) {
        stdout.write('\n\n');
      } else {
        stdout.write('\n');
      }
      log(`turn done: turns=${result.turns} toolCalls=${result.toolCalls} err=${result.error ?? 'none'}`);
    } catch (e) {
      if (spinnerActive) {
        spinner.stop();
        spinnerActive = false;
      }
      stdout.write('\n' + c.red(t('err_stream') + ': ' + (e as Error).message) + '\n');
    }

    // Persist session.
    if (cfg.saveHistory) {
      saveSession(opts.cwd, session);
    }
  }

  // Handle slash commands.
  async function handleSlash(cmd: string): Promise<boolean> {
    const parts = cmd.slice(1).split(/\s+/);
    const name = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    switch (name) {
      case 'help':
      case 'h':
      case '?':
        printSlashHelp();
        return true;
      case 'exit':
      case 'quit':
      case 'q':
        return false;
      case 'clear':
        session.messages = [];
        stdout.write(c.gray(t('chat_clear')) + '\n');
        return true;
      case 'save':
        saveSession(opts.cwd, session);
        stdout.write(c.green(t('chat_session_saved') + ': ' + session.id) + '\n');
        return true;
      case 'model':
      case 'models':
        await switchModel(cfg, opts.cwd);
        return true;
      case 'provider':
        await switchProvider(cfg, opts.cwd);
        return true;
      case 'history':
        await showHistory(opts.cwd);
        return true;
      case 'theme':
        await switchTheme(cfg);
        return true;
      case 'lang':
      case 'language':
        await switchLang(cfg);
        return true;
      case 'agent':
      case 'agents':
        await switchAgent(cfg);
        return true;
      case 'remember':
        if (arg) {
          const [k, ...rest] = arg.split('=');
          if (k && rest.length > 0) {
            remember(k.trim(), rest.join('=').trim());
            stdout.write(c.green('✓ remembered') + '\n');
          } else {
            stdout.write(c.gray('usage: /remember key=value') + '\n');
          }
        }
        return true;
      case 'autoconfirm':
        autoConfirm = !autoConfirm;
        stdout.write(c.gray('auto-confirm: ' + (autoConfirm ? c.green('on') : c.red('off'))) + '\n');
        return true;
      case 'tokens':
        stdout.write(c.gray('messages: ' + session.messages.length) + '\n');
        return true;
      default:
        stdout.write(c.red('Unknown command: /' + name) + '\n');
        return true;
    }
  }

  function printSlashHelp() {
    const cmds: [string, string][] = [
      ['/help', t('slash_help')],
      ['/exit', t('slash_exit')],
      ['/clear', t('slash_clear')],
      ['/save', t('slash_save')],
      ['/models', t('slash_models')],
      ['/provider', t('slash_provider')],
      ['/history', t('slash_history')],
      ['/theme', t('slash_theme')],
      ['/lang', t('slash_lang')],
      ['/agents', t('slash_agents')],
      ['/autoconfirm', 'Toggle auto-confirm tools (current: ' + (autoConfirm ? 'on' : 'off') + ')'],
      ['/remember key=value', 'Save a long-term memory entry'],
      ['/tokens', t('slash_tokens')],
    ];
    stdout.write('\n' + c.bold('Slash commands') + '\n');
    for (const [k, v] of cmds) {
      stdout.write('  ' + c.cyan(k.padEnd(22)) + c.gray(v) + '\n');
    }
    stdout.write('\n');
  }

  // Initial prompt: if provided, run it immediately.
  if (opts.initialPrompt) {
    await runTurn(opts.initialPrompt);
    // Non-interactive one-shot: stdin is not a TTY → print answer and exit.
    if (!stdin.isTTY) {
      if (cfg.saveHistory) saveSession(opts.cwd, session);
      process.exit(0);
    }
  }

  // REPL loop (interactive only).
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
    prompt: '',
  });

  stdout.write(c.gray(t('chat_exit_hint')) + '\n\n');
  printPrompt();

  rl.on('line', async (line) => {
    const text = line.replace(/\s+$/, '');
    if (text.startsWith('/')) {
      const keepGoing = await handleSlash(text);
      if (!keepGoing) {
        rl.close();
        process.exit(0);
      }
      printPrompt();
      return;
    }
    if (text.trim().length === 0) {
      printPrompt();
      return;
    }
    await runTurn(text);
    printPrompt();
  });

  rl.on('SIGINT', () => {
    stdout.write('\n' + c.gray(t('goodbye')) + '\n');
    process.exit(0);
  });
}

// ── Slash command implementations ──────────────────────────────────────────

async function switchModel(cfg: AppConfig, _cwd: string) {
  const providerCfg = getProviderConfig(cfg, cfg.activeProviderId);
  if (!providerCfg) return;
  const provider = buildProvider(providerCfg);
  let models: { id: string; name?: string }[] = [];
  try {
    models = provider.listModels ? await provider.listModels() : [];
  } catch {
    /* ignore */
  }
  if (models.length === 0) {
    stdout.write(c.gray('Provider did not return a model list. Use `freecode config` to set one manually.') + '\n');
    return;
  }
  stdout.write('\n');
  models.slice(0, 40).forEach((m, i) => {
    const active = m.id === cfg.activeModel ? c.green(' ●') : c.gray('  ');
    stdout.write(`${active} ${c.cyan(String(i + 1).padStart(2))}  ${m.name ?? m.id}\n`);
  });
  const { prompt } = await import('../ui/prompt.js');
  const ans = await prompt('Model # or id');
  const n = parseInt(ans, 10);
  let picked: string | undefined;
  if (!Number.isNaN(n) && n >= 1 && n <= models.length) {
    picked = models[n - 1].id;
  } else if (ans) {
    picked = ans;
  }
  if (picked) {
    cfg.activeModel = picked;
    saveConfig(cfg);
    stdout.write(c.green('✓ model: ' + picked) + '\n');
  }
}

async function switchProvider(cfg: AppConfig, _cwd: string) {
  const { select } = await import('../ui/prompt.js');
  const choices = cfg.providers.map((p) => ({
    label: `${p.label} (${p.providerId})${p.id === cfg.activeProviderId ? ' — active' : ''}`,
    value: p.id,
  }));
  const id = await select(t('config_choose_provider'), choices);
  if (id) {
    cfg.activeProviderId = id;
    const p = cfg.providers.find((x) => x.id === id);
    if (p) cfg.activeModel = p.defaultModel ?? cfg.activeModel;
    saveConfig(cfg);
    stdout.write(c.green('✓ provider: ' + id) + '\n');
  }
}

async function showHistory(cwd: string) {
  const { select } = await import('../ui/prompt.js');
  const sessions = listSessions(cwd);
  if (sessions.length === 0) {
    stdout.write(c.gray(t('history_empty')) + '\n');
    return;
  }
  const choices = [
    ...sessions.map((s) => ({
      label: `${s.title} — ${new Date(s.updatedAt).toLocaleString()} (${s.messages.length} msgs)`,
      value: s.id,
    })),
    { label: '(' + t('history_new') + ')', value: '' },
  ];
  const id = await select(t('history_resume_prompt'), choices);
  if (id) {
    // Restart chat with the picked session.
    stdout.write(c.gray('Restart FreeCode with --resume ' + id) + '\n');
  }
}

async function switchTheme(cfg: AppConfig) {
  const { select } = await import('../ui/prompt.js');
  const id = await select(t('config_choose_theme'), [
    { label: 'Neon (violet/cyan)', value: 'neon' },
    { label: 'Minimal', value: 'minimal' },
    { label: 'Matrix (green)', value: 'matrix' },
  ]);
  if (id) {
    cfg.theme = id as AppConfig['theme'];
    saveConfig(cfg);
    stdout.write(c.green('✓ theme: ' + id + ' (restart to apply)') + '\n');
  }
}

async function switchLang(cfg: AppConfig) {
  const { select } = await import('../ui/prompt.js');
  const id = await select(t('config_choose_lang'), [
    { label: 'Français', value: 'fr' },
    { label: 'English', value: 'en' },
    { label: 'Auto-detect', value: 'auto' },
  ]);
  if (id) {
    cfg.language = id as AppConfig['language'];
    saveConfig(cfg);
    setLang(id === 'auto' ? 'en' : (id as 'fr' | 'en'));
    stdout.write(c.green('✓ lang: ' + id) + '\n');
  }
}

async function switchAgent(cfg: AppConfig) {
  const { select } = await import('../ui/prompt.js');
  const agents = (await import('../agent/agents.js')).listAgents();
  const id = await select(
    t('agents_list'),
    agents.map((a) => ({
      label: `${a.name}${a.builtIn ? ' (built-in)' : ''}${a.id === cfg.defaultAgent ? ' — active' : ''}`,
      value: a.id,
    })),
  );
  if (id) {
    cfg.defaultAgent = id;
    saveConfig(cfg);
    stdout.write(c.green('✓ agent: ' + id) + '\n');
  }
}
