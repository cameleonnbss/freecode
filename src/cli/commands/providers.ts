/**
 * FreeCode — `freecode providers` command.
 * Lists all known providers (catalog) + user-configured ones.
 */
import { loadConfig } from '../../core/config.js';
import { PROVIDER_CATALOG } from '../../core/defaults.js';
import { c, COLORS } from '../../ui/theme.js';
import { t } from '../../i18n/index.js';

export function cmdProviders(): void {
  const cfg = loadConfig();

  process.stdout.write('\n' + c.bold('Configured providers') + '\n');
  if (cfg.providers.length === 0) {
    process.stdout.write(c.gray('  (none — run `freecode config` to add one)') + '\n');
  } else {
    for (const p of cfg.providers) {
      const active = p.id === cfg.activeProviderId ? c.green(' ●') : '  ';
      const key = p.apiKey ? c.green('key') : c.gray('no key');
      const url = p.baseUrl ? c.gray(p.baseUrl) : '';
      process.stdout.write(`${active} ${c.cyan(p.id.padEnd(28))} ${p.label.padEnd(28)} ${key}  ${url}\n`);
    }
  }

  process.stdout.write('\n' + c.bold('Catalog (supported provider types)') + '\n');
  const byCat = {
    free: PROVIDER_CATALOG.filter((p) => p.category === 'free'),
    paid: PROVIDER_CATALOG.filter((p) => p.category === 'paid'),
    local: PROVIDER_CATALOG.filter((p) => p.category === 'local'),
    custom: PROVIDER_CATALOG.filter((p) => p.category === 'custom'),
  };
  const labels: Record<string, string> = { free: t('prov_free'), paid: t('prov_paid'), local: t('prov_local'), custom: t('prov_custom') };
  for (const [cat, items] of Object.entries(byCat)) {
    process.stdout.write(c.violet('\n' + labels[cat] + ':') + '\n');
    for (const e of items) {
      const keyReq = e.requiresApiKey ? c.yellow(' key') : c.green(' free');
      const url = e.requiresBaseUrl ? c.gray(' +baseURL') : '';
      process.stdout.write(`  ${c.cyan(e.providerId.padEnd(20))} ${e.name.padEnd(24)} ${keyReq}${url}\n`);
      process.stdout.write(c.gray('    ' + e.description.slice(0, 90)) + '\n');
    }
  }
  process.stdout.write('\n' + c.gray('Run `freecode config` → "Add a provider" to configure one.') + '\n\n');
}
