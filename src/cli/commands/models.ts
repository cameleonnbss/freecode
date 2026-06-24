/**
 * FreeCode — `freecode models` command.
 * Lists models from the active provider, lets the user pick one.
 */
import { loadConfig, saveConfig, getProviderConfig } from '../../core/config.js';
import { buildProvider } from '../../providers/registry.js';
import { select, prompt } from '../../ui/prompt.js';
import { c } from '../../ui/theme.js';
import { t } from '../../i18n/index.js';
import { Spinner } from '../../ui/spinner.js';

export async function cmdModels(): Promise<void> {
  const cfg = loadConfig();
  const pcfg = getProviderConfig(cfg, cfg.activeProviderId);
  if (!pcfg) {
    process.stdout.write(c.red(t('err_no_provider')) + '\n');
    return;
  }
  const provider = buildProvider(pcfg);
  if (!provider.listModels) {
    process.stdout.write(c.gray('This provider does not expose a model list. Set one manually via `freecode config`.') + '\n');
    return;
  }
  const s = new Spinner(t('fetching') + ' models…').start();
  let models: { id: string; name?: string; tier?: string }[] = [];
  try {
    models = await provider.listModels();
  } catch (e) {
    s.fail('Failed: ' + (e as Error).message);
    return;
  }
  if (models.length === 0) {
    s.fail('No models returned.');
    return;
  }
  s.succeed(`${models.length} models from ${pcfg.label}`);

  const choice = await select(t('config_choose_model'), [
    ...models.slice(0, 60).map((m) => ({
      label: `${m.name ?? m.id}${m.tier ? c.gray(' [' + m.tier + ']') : ''}${m.id === cfg.activeModel ? c.green(' ●') : ''}`,
      value: m.id,
    })),
  ]);
  if (!choice) return;
  cfg.activeModel = choice;
  pcfg.defaultModel = choice;
  saveConfig(cfg);
  process.stdout.write(c.green('✓ active model: ' + choice) + '\n');
}
