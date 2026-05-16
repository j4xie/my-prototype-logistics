import type { SummaryStat, ListSummaryResponse } from '../types/listSummary';

/**
 * Sprint 2 Track I Day 7 — U-FOOTER-1 AI deep-link helper.
 *
 * Formats sticky-footer summary stats into a human-readable string that can be
 * appended to AIChat's initialMessage. Lets the LLM see the actual aggregate
 * numbers the user is staring at when they tap 📊, enabling contextual
 * analysis ("销售较上周 +15%, SO-007 超均值 3 倍, 建议复核客户信用") instead
 * of generic responses.
 *
 * Usage (RN list screen):
 *   const ctx = formatSummaryForAI(summary, { filter: { status: 'APPROVED' } });
 *   navigation.dispatch(CommonActions.navigate('FAAITab', {
 *     screen: 'AIChat',
 *     params: {
 *       entityType: 'SALES_ORDER',
 *       initialMessage: `分析当前销售单列表${ctx}`,
 *     },
 *   }));
 *
 * No AIChat code change needed — auto-send picks up the richer initialMessage,
 * LLM sees the stats embedded, response is grounded in real numbers.
 */
export interface AISummaryContextOptions {
  /** Filter values to surface in context (e.g. `{ status: 'APPROVED' }`) */
  filter?: Record<string, string | number | undefined>;
  /** Extra freeform note appended at the end */
  note?: string;
}

function formatStatValue(stat: SummaryStat): string {
  const { value, format, unit } = stat;
  if (value == null || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  switch (format) {
    case 'currency':
      return `${unit ?? '¥'}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${num.toFixed(1)}${unit ?? '%'}`;
    case 'number':
      return `${num.toLocaleString()}${unit ?? ''}`;
    default:
      return `${num}${unit ?? ''}`;
  }
}

export function formatSummaryForAI(
  summary: ListSummaryResponse | null | undefined,
  opts: AISummaryContextOptions = {},
): string {
  const parts: string[] = [];

  if (opts.filter) {
    const filterParts = Object.entries(opts.filter)
      .filter(([_, v]) => v != null && v !== '' && v !== 'all')
      .map(([k, v]) => `${k}=${v}`);
    if (filterParts.length > 0) {
      parts.push(`筛选: ${filterParts.join(', ')}`);
    }
  }

  if (summary?.stats && summary.stats.length > 0) {
    const statParts = summary.stats.map((s) => `${s.label} ${formatStatValue(s)}`);
    parts.push(`当前统计: ${statParts.join(' | ')}`);
  }

  if (opts.note) parts.push(opts.note);

  return parts.length > 0 ? ` (${parts.join('; ')})` : '';
}
