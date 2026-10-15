import type { LiveGame } from '@/data/types';
import type { Key } from '@/i18n';

/** Short line describing how a game is won, e.g. "First to 100". */
export function targetLine(g: LiveGame, t: (key: Key, params?: Record<string, string | number>) => string): string {
  if (g.target == null) return t('noTargetUp');
  if (g.penalty && g.mode === 'up') return t('targetPenalty', { n: g.target });
  return g.mode === 'up' ? t('targetUp', { n: g.target }) : t('targetDown', { start: g.start, n: g.target });
}
