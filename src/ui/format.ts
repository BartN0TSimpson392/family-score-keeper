import type { Lang } from '@/i18n';
import type { SavedGame } from '@/data/types';
import type { Key } from '@/i18n';

export function formatDate(ms: number, lang: Lang): string {
  try {
    return new Date(ms).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return new Date(ms).toDateString();
  }
}

/** How a saved game was played, e.g. "First to 21" or "From 501 down to 0". */
export function rulesLine(g: Pick<SavedGame, 'mode' | 'start' | 'target' | 'penalty' | 'winBy'>, t: (key: Key, params?: Record<string, string | number>) => string): string {
  if (g.target == null) return t('noTargetUp');
  if (g.penalty && g.mode === 'up') return t('targetPenalty', { n: g.target });
  if (g.mode === 'up') return t('targetUp', { n: g.target }) + ((g.winBy ?? 1) > 1 ? t('winByN', { n: g.winBy ?? 2 }) : '');
  return t('targetDown', { start: g.start, n: g.target });
}
