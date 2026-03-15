/**
 * SmartBI Chart Helpers — shared tooltip/style factories
 */

type TooltipFormatter = string | ((params: unknown) => string);

const RATE_KEYWORDS = /率|Rate|rate|比|percent|Percent|达成|同比|环比|增长率|占比/;

function formatTooltipValue(value: number, seriesName: string): string {
  if (RATE_KEYWORDS.test(seriesName)) {
    return value.toFixed(1) + '%';
  }
  const abs = Math.abs(value);
  if (abs >= 100000000) return (value / 100000000).toFixed(2) + '亿';
  if (abs >= 10000) return (value / 10000).toFixed(2) + '万';
  if (abs >= 1000) return value.toLocaleString('zh-CN');
  return String(value);
}

function smartAxisFormatter(params: unknown): string {
  const items = Array.isArray(params) ? params : [params];
  if (items.length === 0) return '';
  const first = items[0] as Record<string, unknown>;
  const title = first.axisValueLabel || first.name || '';
  const lines = items.map((p: unknown) => {
    const item = p as Record<string, unknown>;
    const val = Number(item.value ?? 0);
    const name = String(item.seriesName || '');
    const color = String(item.color || '#333');
    const formatted = formatTooltipValue(val, name);
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>${name}: <b>${formatted}</b>`;
  });
  return `<div style="font-weight:600;margin-bottom:4px">${title}</div>${lines.join('<br/>')}`;
}

export function defaultTooltip(trigger: 'axis' | 'item' = 'axis', formatter?: TooltipFormatter) {
  return {
    trigger,
    confine: true,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#ebeef5',
    borderWidth: 1,
    textStyle: { color: '#303133' },
    extraCssText: 'box-shadow: 0 2px 12px rgba(0,0,0,0.1); backdrop-filter: blur(4px);',
    formatter: formatter ?? (trigger === 'axis' ? smartAxisFormatter : undefined),
  };
}
