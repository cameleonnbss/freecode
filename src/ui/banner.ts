/**
 * FreeCode — animated startup banner.
 *
 * Renders the ASCII wordmark with a sweeping gradient + a subtle
 * "scanning" reveal, then prints provider/model/agent info.
 */
import chalk from 'chalk';
import { COLORS, c, gradientLine, neon } from './theme.js';
import { FREECODE_ASCII, FREECODE_ASCII_COMPACT, pickAscii, BYLINE } from './ascii.js';
import { t } from '../i18n/index.js';

export interface BannerInfo {
  provider: string;
  model: string;
  agent: string;
  modelsCount?: number;
}

/** Render the banner with a one-shot gradient sweep (no animation frames). */
export function renderBanner(info: BannerInfo): string {
  const ascii = pickAscii();
  const lines = ascii.split('\n').filter((l) => l.length > 0);
  const out: string[] = [];
  out.push('');
  for (const line of lines) {
    // Sweep the gradient per line so the whole banner shimmers violet→cyan.
    out.push(gradientLine(line, COLORS.violet, COLORS.cyan));
  }
  out.push('');
  out.push(chalk.gray('   ' + BYLINE));
  out.push('');
  out.push(
    '  ' +
      c.gray('•') +
      ' ' +
      t('banner_provider') +
      ': ' +
      c.cyan(info.provider) +
      '   ' +
      c.gray('•') +
      ' ' +
      t('banner_models') +
      ': ' +
      c.cyan(String(info.modelsCount ?? '?')) +
      '   ' +
      c.gray('•') +
      ' ' +
      t('banner_agent') +
      ': ' +
      c.cyan(info.agent),
  );
  out.push('  ' + c.gray('•') + ' ' + t('banner_model') + ': ' + c.violet(info.model));
  out.push('');
  out.push('  ' + c.gray(t('banner_type_help')));
  out.push('  ' + c.gray(t('banner_type_exit')));
  out.push('');
  return out.join('\n');
}

/** Lightweight banner for non-interactive mode (no metadata). */
export function renderCompactBanner(): string {
  return neon(FREECODE_ASCII_COMPACT.trimEnd());
}
