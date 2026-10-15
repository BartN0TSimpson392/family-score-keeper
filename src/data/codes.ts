import * as Crypto from 'expo-crypto';
import type { Lang } from '@/i18n';
import { normalize } from './search';
import { WORDS } from './words';

const LANG_INDEX: Record<Lang, 0 | 1> = { en: 0, pl: 1 };

/** Every word in either language, accents and capitals ignored, mapped to its position in the list. */
const LOOKUP = new Map<string, number>();
WORDS.forEach(([en, pl], i) => {
  LOOKUP.set(normalize(en), i);
  LOOKUP.set(normalize(pl), i);
});

/** A new random code: six positions in the word list, stored as "12-1200-5-77-1330-9". */
export function newCodeKey(): string {
  const picks: number[] = [];
  // Two random bytes per pick. Rejection sampling keeps every word equally likely.
  const limit = WORDS.length * Math.floor(65536 / WORDS.length);
  while (picks.length < 6) {
    const bytes = Crypto.getRandomBytes(24);
    for (let i = 0; i + 1 < bytes.length && picks.length < 6; i += 2) {
      const v = bytes[i] * 256 + bytes[i + 1];
      if (v < limit) picks.push(v % WORDS.length);
    }
  }
  return picks.join('-');
}

/** The six words for a code, in the reader's language. */
export function wordsFor(key: string | undefined, lang: Lang): string[] {
  if (!key) return [];
  return key
    .split('-')
    .map((n) => WORDS[Number(n)]?.[LANG_INDEX[lang]])
    .filter((w): w is string => !!w);
}

/**
 * Turn what someone typed or pasted (English or Polish words, any case or accents) into a code key, or null.
 * Works even when the code is inside a longer message, like the one the Send button writes.
 */
export function parseCode(input: string): string | null {
  const parts = input
    .split(/[^\p{L}]+/u)
    .map((p) => normalize(p))
    .filter(Boolean);
  const idx = parts.map((p) => LOOKUP.get(p));
  for (let start = 0; start + 6 <= idx.length; start++) {
    const window = idx.slice(start, start + 6);
    if (window.every((i) => i !== undefined)) return window.join('-');
  }
  return null;
}
