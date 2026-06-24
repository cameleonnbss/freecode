/**
 * FreeCode — `freecode config` command.
 *
 * Interactive provider/model/lang/theme management.
 */
import { loadConfig, saveConfig, upsertProvider, removeProvider } from '../../core/config.js';
import { PROVIDER_CATALOG } from '../../core/defaults.js';
import { select, prompt, promptSecret, confirm } from '../../ui/prompt.js';
import { c } from '../../ui/theme.js';
import { t, setLang } from '../../i18n/index.js';
import { renderBanner } from '../../ui/banner.js';

export async function cmdConfig(): Promise<void> {
  const cfg = loadConfig();

  const action = await select('What do you want to configure?', [
    { label: 'Language', value: 'lang', description: 'FR / EN / auto' },
    { label: 'Theme', value: 'theme', description: 'neon / minimal / matrix' },
    { label: 'Active provider + model', value: 'active' },
    { label: 'Add a provider', value: 'add' },
    { label: 'Remove a provider', value: 'remove' },
    { label: 'Edit a provider (key, base URL, model)', value: 'edit' },
    { label: 'Test a provider connection', value: 'test' },
    { label: 'Show current config', value: 'show' },
  ]);

  switch (action) {
    case 'lang': {
      const lang = await select(t('config_choose_lang'), [
        { label: 'Français', value: 'fr' as const },
        { label: 'English', value: 'en' as const },
        { label: 'Auto-detect', value: 'auto' as const },
      ]);
      if (lang) {
        cfg.language = lang;
        saveConfig(cfg);
        setLang(lang === 'auto' ? 'en' : lang);
        stdout(c.green('✓ ' + t('config_saved')));
      }
      break;
    }
    case 'theme': {
      const theme = await select(t('config_choose_theme'), [
        { label: 'Neon (violet/cyan)', value: 'neon' as const },
        { label: 'Minimal', value: 'minimal' as const },
        { label: 'Matrix (green)', value: 'matrix' as const },
      ]);
      if (theme) {
        cfg.theme = theme;
        saveConfig(cfg);
        stdout(c.green('✓ ' + t('config_saved')));
      }
      break;
    }
    case 'active': {
      if (cfg.providers.length === 0) {
        stdout(c.yellow('No providers. Add one first.'));
        break;
      }
      const pid = await select(
        t('config_choose_provider'),
        cfg.providers.map((p: typeof cfg.providers[number]) => ({ label: `${p.label} (${p.providerId})`, value: p.id })),
      );
      if (!pid) break;
      cfg.activeProviderId = pid;
      const p = cfg.providers.find((x: typeof cfg.providers[number]) => x.id === pid)!;
      stdout(c.gray('Current model: ' + (cfg.activeModel || '(none)')));
      const m = await prompt(t('config_model_prompt'), p.defaultModel ?? '');
      if (m) {
        p.defaultModel = m;
        cfg.activeModel = m;
      }
      saveConfig(cfg);
      stdout(c.green('✓ ' + t('config_saved')));
      break;
    }
    case 'add': {
      await addProviderFlow(cfg);
      break;
    }
    case 'remove': {
      const id = await select(
        t('config_remove_provider'),
        cfg.providers.map((p: typeof cfg.providers[number]) => ({ label: `${p.label} (${p.providerId})`, value: p.id })),
      );
      if (id) {
        removeProvider(cfg, id);
        saveConfig(cfg);
        stdout(c.green('✓ removed'));
      }
      break;
    }
    case 'edit': {
      const id = await select(
        'Edit which provider?',
        cfg.providers.map((p: typeof cfg.providers[number]) => ({ label: `${p.label} (${p.providerId})`, value: p.id })),
      );
      if (!id) break;
      const p = cfg.providers.find((x: typeof cfg.providers[number]) => x.id === id)!;
      const label = await prompt(t('config_label_prompt'), p.label);
      if (label) p.label = label;
      const cat = PROVIDER_CATALOG.find((e: typeof PROVIDER_CATALOG[number]) => e.providerId === p.providerId);
      if (cat?.requiresApiKey) {
        const key = await promptSecret(t('config_api_key_prompt'));
        if (key) p.apiKey = key;
      }
      if (cat?.requiresBaseUrl || p.providerId.includes('compat') || p.providerId === 'ollama' || p.providerId === 'lmstudio') {
        const url = await prompt(t('config_baseurl_prompt'), p.baseUrl ?? '');
        if (url) p.baseUrl = url;
      }
      const m = await prompt(t('config_model_prompt'), p.defaultModel ?? '');
      if (m) p.defaultModel = m;
      saveConfig(cfg);
      stdout(c.green('✓ ' + t('config_saved')));
      break;
    }
    case 'test': {
      const id = await select(
        'Test which provider?',
        cfg.providers.map((p: typeof cfg.providers[number]) => ({ label: `${p.label} (${p.providerId})`, value: p.id })),
      );
      if (!id) break;
      await testProvider(cfg, id);
      break;
    }
    case 'show': {
      stdout(renderBanner({
        provider: cfg.providers.find((p) => p.id === cfg.activeProviderId)?.label ?? '?',
        model: cfg.activeModel,
        agent: cfg.defaultAgent,
        modelsCount: cfg.providers.length,
      }));
      stdout(c.gray('Config file: ~/.freecode/config.json'));
      stdout(JSON.stringify({ ...cfg, providers: cfg.providers.map((p) => ({ ...p, apiKey: p.apiKey ? '••••' : undefined })) }, null, 2));
      break;
    }
  }
}

async function addProviderFlow(cfg: ReturnType<typeof loadConfig>): Promise<void> {
  const grouped = {
    free: PROVIDER_CATALOG.filter((p) => p.category === 'free'),
    paid: PROVIDER_CATALOG.filter((p) => p.category === 'paid'),
    local: PROVIDER_CATALOG.filter((p) => p.category === 'local'),
    custom: PROVIDER_CATALOG.filter((p) => p.category === 'custom'),
  };
  const cat = await select('Category', [
    { label: t('prov_free') + ` (${grouped.free.length})`, value: 'free' },
    { label: t('prov_paid') + ` (${grouped.paid.length})`, value: 'paid' },
    { label: t('prov_local') + ` (${grouped.local.length})`, value: 'local' },
    { label: t('prov_custom') + ` (${grouped.custom.length})`, value: 'custom' },
  ]);
  if (!cat) return;
  const entry = await select(
    'Pick a provider',
    grouped[cat as keyof typeof grouped].map((e: typeof PROVIDER_CATALOG[number]) => ({
      label: `${e.name} — ${e.description}`,
      value: e.providerId,
    })),
  );
  if (!entry) return;
  const catalog = PROVIDER_CATALOG.find((p) => p.providerId === entry)!;

  const label = await prompt(t('config_label_prompt'), catalog.name);
  let apiKey: string | undefined;
  if (catalog.requiresApiKey) {
    stdout(c.gray(catalog.signupUrl ? `Get a key: ${catalog.signupUrl}` : ''));
    apiKey = await promptSecret('API key');
    if (!apiKey) {
      stdout(c.red('A key is required for this provider.'));
      return;
    }
  }
  let baseUrl: string | undefined;
  if (catalog.requiresBaseUrl) {
    baseUrl = await prompt(t('config_baseurl_prompt'), catalog.defaultBaseUrl ?? '');
    if (!baseUrl) baseUrl = catalog.defaultBaseUrl;
  }
  let defaultModel = catalog.popularModels?.[0]?.id ?? '';
  if (catalog.popularModels && catalog.popularModels.length > 0) {
    stdout(c.gray('Popular models:'));
    catalog.popularModels.forEach((m: NonNullable<typeof catalog.popularModels>[number], i: number) => stdout(`  ${c.cyan(String(i + 1))}  ${m.name} (${m.id})`));
    const m = await prompt('Default model # or id', defaultModel);
    if (m) {
      const n = parseInt(m, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= catalog.popularModels.length) {
        defaultModel = catalog.popularModels[n - 1].id;
      } else {
        defaultModel = m;
      }
    }
  } else {
    const m = await prompt('Default model id', defaultModel);
    if (m) defaultModel = m;
  }

  const id = `${entry}-${Date.now().toString(36)}`;
  upsertProvider(cfg, {
    id,
    providerId: entry,
    label: label || catalog.name,
    apiKey,
    baseUrl,
    defaultModel,
    enabled: true,
  });
  const makeActive = await confirm('Set as active provider?', true);
  if (makeActive) {
    cfg.activeProviderId = id;
    cfg.activeModel = defaultModel;
  }
  saveConfig(cfg);
  stdout(c.green('✓ provider added'));
}

async function testProvider(cfg: ReturnType<typeof loadConfig>, id: string): Promise<void> {
  const p = cfg.providers.find((x) => x.id === id);
  if (!p) return;
  const { buildProvider } = await import('../../providers/registry.js');
  const provider = buildProvider(p);
  const { Spinner } = await import('../../ui/spinner.js');
  const s = new Spinner('Testing connection…').start();
  try {
    const models = provider.listModels ? await provider.listModels() : [];
    if (models.length > 0) {
      s.succeed(`✓ ${t('prov_test_ok')} — ${models.length} models available`);
      models.slice(0, 8).forEach((m) => stdout(`  ${c.cyan(m.id)}  ${c.gray(m.name)}`));
    } else {
      // Try a tiny smoke request.
      const it = provider.stream({
        model: p.defaultModel ?? cfg.activeModel,
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
      });
      let got = '';
      for await (const ev of it) {
        if (ev.type === 'text') got += ev.delta;
        if (ev.type === 'done') break;
      }
      if (got.trim().length > 0) {
        s.succeed(`✓ ${t('prov_test_ok')} — model replied: "${got.slice(0, 60)}"`);
      } else {
        s.fail(t('prov_test_fail') + ' — empty response');
      }
    }
  } catch (e) {
    s.fail(t('prov_test_fail') + ': ' + (e as Error).message);
  }
}

function stdout(s: string): void {
  process.stdout.write(s + '\n');
}
