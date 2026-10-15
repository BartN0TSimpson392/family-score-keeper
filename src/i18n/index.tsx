import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en, { type Dict } from './en';
import pl from './pl';

export type Lang = 'en' | 'pl';
export type Key = keyof Dict;

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
];

const dicts: Record<Lang, Record<string, string>> = { en, pl };
const STORAGE_KEY = 'fsk.lang';

/** Polish has four plural forms; English has two. */
export function pluralForm(lang: Lang, n: number): 'one' | 'few' | 'many' | 'other' {
  if (lang === 'pl') {
    if (n === 1) return 'one';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
    return 'many';
  }
  return n === 1 ? 'one' : 'other';
}

function interpolate(text: string, params?: Record<string, string | number>) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

function detectLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'pl' ? 'pl' : 'en';
  } catch {
    return 'en';
  }
}

type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
  /** Pick the plural form of `base` (e.g. "steps" -> steps_one / steps_few ...). */
  plural: (base: string, count: number, params?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'en' || v === 'pl') setLangState(v);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => {
    const d = dicts[lang];
    const t: I18n['t'] = (key, params) => interpolate(d[key] ?? en[key] ?? key, params);
    const plural: I18n['plural'] = (base, count, params) => {
      const form = pluralForm(lang, count);
      const text = d[`${base}_${form}`] ?? d[`${base}_other`] ?? en[`${base}_other` as Key] ?? base;
      return interpolate(text, { count, ...params });
    };
    return { lang, setLang, t, plural };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
