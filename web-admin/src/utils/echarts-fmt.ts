/**
 * ECharts __FMT__ / __ANIM__ resolver — shared utility.
 *
 * Python chart builders emit magic strings like "__FMT__thousands_sep" or
 * "__ANIM__stagger_80" in place of callback functions. This module resolves
 * those references from pre-registered safe registries (no eval / new Function).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- Animation registry ----
const ANIM_REGISTRY: Record<string, (idx: number) => number> = {
  stagger_80: (idx) => idx * 80,
  stagger_60: (idx) => idx * 60,
  stagger_5: (idx) => idx * 5,
};

// ---- Formatter registry ----
const FMT_REGISTRY: Record<string, (...args: any[]) => string> = {
  thousands_sep: (v: any) => {
    if (typeof v !== 'number' || isNaN(v)) return v == null || isNaN(v) ? '-' : String(v);
    const abs = Math.abs(v);
    if (abs >= 1e8) return (v / 1e8).toFixed(1) + '亿';
    if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString('zh-CN');
  },
  boxplot_tooltip: (p: any) => {
    const d = p.data;
    return `${p.name}<br/>最小: ${d[0]}<br/>Q1: ${d[1]}<br/>中位数: ${d[2]}<br/>Q3: ${d[3]}<br/>最大: ${d[4]}`;
  },
  correlation_tooltip: (p: any) => p.data[2].toFixed(2),
  correlation_label: (p: any) => p.data[2].toFixed(1),
  quadrant_scatter_tooltip: (p: any) =>
    `${p.data[2]}<br/>收入: ${Number(p.data[0]).toLocaleString()}<br/>利润率: ${p.data[1]}%`,
  quadrant_scatter_label: (p: any) => p.data[2],
  // Sankey financial chart formatters (unscaled values — auto-detect scale)
  sankey_financial_label: (p: any) => {
    const name = p.name || '';
    const val = p.value;
    if (typeof val !== 'number' || isNaN(val)) return name;
    const abs = Math.abs(val);
    const formatted = abs >= 1e8
      ? (val / 1e8).toFixed(1) + '亿'
      : abs >= 1e4
        ? (val / 1e4).toFixed(1) + '万'
        : val.toLocaleString('zh-CN');
    return `${name}\n${formatted}`;
  },
  sankey_financial_tooltip: (p: any) => {
    if (p.dataType === 'edge') {
      const src = p.data?.source || '';
      const tgt = p.data?.target || '';
      const val = p.data?.value ?? 0;
      const abs = Math.abs(val);
      const formatted = abs >= 1e8
        ? (val / 1e8).toFixed(2) + '亿'
        : abs >= 1e4
          ? (val / 1e4).toFixed(2) + '万'
          : Number(val).toLocaleString('zh-CN');
      return `<b>${src} → ${tgt}</b><br/>金额: ${formatted}元`;
    }
    const name = p.name || '';
    const val = p.value ?? 0;
    const abs = Math.abs(val);
    const formatted = abs >= 1e8
      ? (val / 1e8).toFixed(2) + '亿'
      : abs >= 1e4
        ? (val / 1e4).toFixed(2) + '万'
        : Number(val).toLocaleString('zh-CN');
    return `<b>${name}</b><br/>金额: ${formatted}元`;
  },
  // Sankey formatters for pre-scaled values (万)
  'sankey_financial_label_万': (p: any) => {
    const name = p.name || '';
    const val = p.value;
    if (typeof val !== 'number' || isNaN(val)) return name;
    return `${name}\n${val.toFixed(1)}万`;
  },
  'sankey_financial_tooltip_万': (p: any) => {
    if (p.dataType === 'edge') {
      const src = p.data?.source || '';
      const tgt = p.data?.target || '';
      const val = p.data?.value ?? 0;
      return `<b>${src} → ${tgt}</b><br/>金额: ${Number(val).toFixed(2)}万元`;
    }
    const name = p.name || '';
    const val = p.value ?? 0;
    return `<b>${name}</b><br/>金额: ${Number(val).toFixed(2)}万元`;
  },
  // Sankey formatters for pre-scaled values (亿)
  'sankey_financial_label_亿': (p: any) => {
    const name = p.name || '';
    const val = p.value;
    if (typeof val !== 'number' || isNaN(val)) return name;
    return `${name}\n${val.toFixed(2)}亿`;
  },
  'sankey_financial_tooltip_亿': (p: any) => {
    if (p.dataType === 'edge') {
      const src = p.data?.source || '';
      const tgt = p.data?.target || '';
      const val = p.data?.value ?? 0;
      return `<b>${src} → ${tgt}</b><br/>金额: ${Number(val).toFixed(2)}亿元`;
    }
    const name = p.name || '';
    const val = p.value ?? 0;
    return `<b>${name}</b><br/>金额: ${Number(val).toFixed(2)}亿元`;
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Recursively resolve __ANIM__ / __FMT__ magic strings in an ECharts option tree.
 */
export function processEChartsOptions(opts: Record<string, unknown>): Record<string, unknown> {
  const processValue = (val: unknown): unknown => {
    if (typeof val === 'string') {
      if (val.startsWith('__ANIM__')) return ANIM_REGISTRY[val.slice(8)] ?? val;
      if (val.startsWith('__FMT__')) return FMT_REGISTRY[val.slice(7)] ?? val;
    }
    if (Array.isArray(val)) return val.map(processValue);
    if (val && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        result[k] = processValue(v);
      }
      return result;
    }
    return val;
  };
  return processValue(opts) as Record<string, unknown>;
}

/** Re-export registries for consumers that need direct access. */
export { ANIM_REGISTRY, FMT_REGISTRY };
