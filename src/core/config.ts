/**
 * FreeCode — config load/save.
 * Lives at ~/.freecode/config.json
 */
import fs from 'node:fs';
import { CONFIG_FILE, ensureDirs } from './paths.js';
import { defaultConfig, CONFIG_VERSION, type AppConfig } from './defaults.js';

export function loadConfig(): AppConfig {
  ensureDirs();
  if (!fs.existsSync(CONFIG_FILE)) {
    const fresh = defaultConfig();
    saveConfig(fresh);
    return fresh;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return migrate({ ...defaultConfig(), ...parsed });
  } catch {
    const fresh = defaultConfig();
    saveConfig(fresh);
    return fresh;
  }
}

export function saveConfig(cfg: AppConfig): void {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function migrate(cfg: AppConfig): AppConfig {
  if (cfg.version !== CONFIG_VERSION) {
    cfg.version = CONFIG_VERSION;
  }
  if (!Array.isArray(cfg.providers) || cfg.providers.length === 0) {
    cfg.providers = defaultConfig().providers;
  }
  if (!cfg.activeProviderId) cfg.activeProviderId = cfg.providers[0]?.id ?? 'unlimitedai-default';
  return cfg;
}

/** Find a provider config by id. */
export function getProviderConfig(cfg: AppConfig, id: string) {
  return cfg.providers.find((p) => p.id === id);
}

/** Upsert a provider config. */
export function upsertProvider(cfg: AppConfig, p: AppConfig['providers'][number]): AppConfig {
  const idx = cfg.providers.findIndex((x) => x.id === p.id);
  if (idx >= 0) cfg.providers[idx] = p;
  else cfg.providers.push(p);
  return cfg;
}

/** Remove a provider config by id. */
export function removeProvider(cfg: AppConfig, id: string): AppConfig {
  cfg.providers = cfg.providers.filter((p) => p.id !== id);
  if (cfg.activeProviderId === id && cfg.providers[0]) {
    cfg.activeProviderId = cfg.providers[0].id;
    cfg.activeModel = cfg.providers[0].defaultModel ?? '';
  }
  return cfg;
}
