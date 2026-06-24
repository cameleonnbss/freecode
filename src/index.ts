/**
 * FreeCode — main CLI entry point.
 *
 * Parses argv and dispatches to the right command.
 * Default command (no args) is `chat`.
 */
import process from 'node:process';
import path from 'node:path';

import { parseArgs, flagString, flagBool } from './cli/parser.js';
import { loadConfig } from './core/config.js';
import { initI18n, getLang } from './i18n/index.js';
import { renderBanner, renderCompactBanner } from './ui/banner.js';
import { c } from './ui/theme.js';
import { t } from './i18n/index.js';
import { startChat } from './chat/session.js';
import { cmdConfig } from './cli/commands/config.js';
import { cmdModels } from './cli/commands/models.js';
import { cmdHistory, cmdHistoryList } from './cli/commands/history.js';
import { cmdAgents } from './cli/commands/agents.js';
import { cmdProviders } from './cli/commands/providers.js';
import { ensureDirs } from './core/paths.js';
import { log } from './core/logger.js';
import './tools/index.js'; // register tools

import { VERSION } from './version.js';

const HELP = `FreeCode ${VERSION} — ${'Free terminal AI coding assistant'}

Usage:
  freecode                          Start an interactive chat (default)
  freecode "your question"          One-shot: ask and stream the answer
  freecode chat                     Interactive chat
  freecode chat --resume <id>       Resume a previous session
  freecode config                   Configure providers, model, language, theme
  freecode models                   List / pick a model from the active provider
  freecode providers                Show supported providers + configured ones
  freecode history                  List / resume / delete previous sessions
  freecode agents                   List / create / delete agent personas
  freecode --version                Print version
  freecode --help                   Show this help

Flags:
  -m, --model <id>                  Override the active model for this run
  -p, --provider <id>               Override the active provider for this run
  -r, --resume <id>                 Resume a session by id
  --no-banner                       Skip the animated banner
  --lang <fr|en>                    Force a language for this run

Environment:
  FREECODE_LANG                     fr | en (overrides config)
  FREECODE_PROVIDER                 provider config id (overrides config)
  FREECODE_MODEL                    model id (overrides config)
  HTTP_PROXY / HTTPS_PROXY          Standard proxy env vars

Examples:
  freecode                          # chat interactively
  freecode "read src/index.ts and summarize"   # one-shot
  freecode chat --resume s_xyz       # resume a session
  freecode config                   # add OpenAI / Ollama / etc.

Docs:    https://github.com/cameleonnbss/freecode
Issues:  https://github.com/cameleonnbss/freecode/issues
`;

export async function main(): Promise<void> {
  ensureDirs();
  const argv = process.argv;
  const args = parseArgs(argv);
  const cfg = loadConfig();

  // Init i18n.
  const envLang = process.env.FREECODE_LANG as 'fr' | 'en' | undefined;
  const flagLang = flagString(args.flags, 'lang');
  const langPref = (flagLang ?? envLang ?? cfg.language) as 'fr' | 'en' | 'auto';
  initI18n(langPref);

  // Apply env overrides.
  if (process.env.FREECODE_PROVIDER) cfg.activeProviderId = process.env.FREECODE_PROVIDER;
  if (process.env.FREECODE_MODEL) cfg.activeModel = process.env.FREECODE_MODEL;
  const flagModel = flagString(args.flags, 'model', 'm');
  if (flagModel) cfg.activeModel = flagModel;
  const flagProv = flagString(args.flags, 'provider', 'p');
  if (flagProv) cfg.activeProviderId = flagProv;

  log(`boot: cmd=${args.command} lang=${getLang()} provider=${cfg.activeProviderId} model=${cfg.activeModel}`);

  // Handle --version / --help short-circuits.
  if (flagBool(args.flags, 'version', 'v')) {
    process.stdout.write(`FreeCode ${VERSION}\n`);
    return;
  }
  if (flagBool(args.flags, 'help', 'h') || args.command === 'help') {
    process.stdout.write(HELP);
    return;
  }

  const cwd = process.cwd();
  const noBanner = flagBool(args.flags, 'no-banner');

  switch (args.command) {
    case 'chat': {
      if (!noBanner) {
        const pcfg = cfg.providers.find((p) => p.id === cfg.activeProviderId);
        process.stdout.write(
          renderBanner({
            provider: pcfg?.label ?? '?',
            model: cfg.activeModel,
            agent: cfg.defaultAgent,
            modelsCount: cfg.providers.length,
          }),
        );
      }
      // One-shot mode: a positional argument is the initial prompt.
      const initial = args.positional.join(' ').trim();
      const resumeId = flagString(args.flags, 'resume', 'r');
      await startChat({ cwd, initialPrompt: initial || undefined, resumeSessionId: resumeId });
      return;
    }
    case 'config': {
      await cmdConfig();
      return;
    }
    case 'models': {
      await cmdModels();
      return;
    }
    case 'providers': {
      cmdProviders();
      return;
    }
    case 'history': {
      const resumeId = flagString(args.flags, 'resume', 'r');
      if (resumeId) {
        await startChat({ cwd, resumeSessionId: resumeId });
      } else if (args.flags.list) {
        cmdHistoryList(cwd);
      } else {
        await cmdHistory(cwd, args.flags);
      }
      return;
    }
    case 'agents': {
      await cmdAgents(args.flags);
      return;
    }
    case 'version': {
      process.stdout.write(`FreeCode ${VERSION}\n`);
      return;
    }
    default: {
      // Unknown command — try to interpret as a one-shot prompt.
      if (args.command !== 'chat' && args.raw.length > 0) {
        if (!noBanner) process.stdout.write(renderCompactBanner() + '\n');
        await startChat({ cwd, initialPrompt: args.raw.join(' ') });
        return;
      }
      process.stdout.write(HELP);
      process.exit(1);
    }
  }
}

// Top-level error handling.
main().catch((e) => {
  process.stderr.write(c.red('\n✗ Fatal: ' + (e as Error).message) + '\n');
  log(`fatal: ${(e as Error).stack ?? String(e)}`);
  process.exit(1);
});
