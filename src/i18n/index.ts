/**
 * FreeCode — i18n entry. Auto-detects FR/EN from env, fallback EN.
 */
import { fr, type FrKeys } from './fr.js';
import { en, type EnKeys } from './en.js';

export type I18nKey = FrKeys & EnKeys; // same shape, both files share keys

type Dict = Record<I18nKey, string>;

const DICTS: Record<'fr' | 'en', Dict> = { fr: fr as Dict, en: en as Dict };

export type Lang = 'fr' | 'en';

let current: Lang = 'en';

export function detectLang(): Lang {
  const env = (process.env.LANG ?? process.env.LC_ALL ?? process.env.LANGUAGE ?? '').toLowerCase();
  if (env.startsWith('fr')) return 'fr';
  return 'en';
}

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let s: string = (DICTS[current] ?? DICTS.en)[key] ?? (DICTS.en as Dict)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

export function initI18n(pref: 'fr' | 'en' | 'auto'): Lang {
  current = pref === 'auto' ? detectLang() : pref;
  return current;
}
