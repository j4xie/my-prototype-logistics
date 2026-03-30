/**
 * ECharts __FMT__ / __ANIM__ resolver — shared utility.
 *
 * Python chart builders emit magic strings like "__FMT__thousands_sep" or
 * "__ANIM__stagger_80" in place of callback functions. This module resolves
 * those references from pre-registered safe registries (no eval / new Function).
 */

import { sparklineSVG } from './sparkline';

/** ECharts formatter callback param — covers tooltip/label params for all chart types */
interface EChartsParam {
  name?: string;
  value?: unknown;
  data?: unknown;
  dataType?: string;
  dataIndex?: number;
  seriesName?: string;
  seriesType?: string;
  seriesIndex?: number;
  componentType?: string;
  marker?: string;
  color?: string | { colorStops?: Array<{ offset: number; color: string }> };
  percent?: number;
  axisValueLabel?: string;
  dimensionNames?: string[];
  series?: { data?: unknown[] };
  [key: string]: unknown;
}

// ---- Animation registry ----
const ANIM_REGISTRY: Record<string, (idx: number) => number> = {
  stagger_80: (idx) => idx * 80,
  stagger_60: (idx) => idx * 60,
  stagger_5: (idx) => idx * 5,
};

// ---- Formatter registry ----
const FMT_REGISTRY: Record<string, (...args: unknown[]) => string> = {
  thousands_sep: (v: unknown) => {
    const num = typeof v === 'number' ? v : Number(v);
    if (typeof num !== 'number' || isNaN(num)) return v == null ? '-' : String(v);
    const abs = Math.abs(num);
    if (abs >= 1e8) return (num / 1e8).toFixed(1) + '亿';
    if (abs >= 1e4) return (num / 1e4).toFixed(1) + '万';
    return num.toLocaleString('zh-CN');
  },
  boxplot_tooltip: (p: unknown) => {
    const param = p as EChartsParam;
    const d = param.data as number[];
    return `${param.name}<br/>最小: ${d[0]}<br/>Q1: ${d[1]}<br/>中位数: ${d[2]}<br/>Q3: ${d[3]}<br/>最大: ${d[4]}`;
  },
  correlation_tooltip: (p: unknown) => ((p as EChartsParam).data as number[])[2].toFixed(2),
  correlation_label: (p: unknown) => ((p as EChartsParam).data as number[])[2].toFixed(1),
  quadrant_scatter_tooltip: (p: unknown) => {
    const d = (p as EChartsParam).data as (string | number)[];
    return `${d[2]}<br/>收入: ${Number(d[0]).toLocaleString()}<br/>利润率: ${d[1]}%`;
  },
  quadrant_scatter_label: (p: unknown) => String(((p as EChartsParam).data as unknown[])[2]),
  // Sankey financial chart formatters (unscaled values — auto-detect scale)
  sankey_financial_label: (p: unknown) => {
    const param = p as EChartsParam;
    const name = param.name || '';
    const val = param.value as number;
    if (typeof val !== 'number' || isNaN(val)) return name;
    const abs = Math.abs(val);
    const formatted = abs >= 1e8
      ? (val / 1e8).toFixed(1) + '亿'
      : abs >= 1e4
        ? (val / 1e4).toFixed(1) + '万'
        : val.toLocaleString('zh-CN');
    return `${name}\n${formatted}`;
  },
  sankey_financial_tooltip: (p: unknown) => {
    const param = p as EChartsParam;
    if (param.dataType === 'edge') {
      const d = param.data as Record<string, unknown> | undefined;
      const src = d?.source || '';
      const tgt = d?.target || '';
      const val = (d?.value as number) ?? 0;
      const abs = Math.abs(val);
      const formatted = abs >= 1e8
        ? (val / 1e8).toFixed(2) + '亿'
        : abs >= 1e4
          ? (val / 1e4).toFixed(2) + '万'
          : Number(val).toLocaleString('zh-CN');
      return `<b>${src} → ${tgt}</b><br/>金额: ${formatted}元`;
    }
    const name = param.name || '';
    const val = (param.value as number) ?? 0;
    const abs = Math.abs(val);
    const formatted = abs >= 1e8
      ? (val / 1e8).toFixed(2) + '亿'
      : abs >= 1e4
        ? (val / 1e4).toFixed(2) + '万'
        : Number(val).toLocaleString('zh-CN');
    return `<b>${name}</b><br/>金额: ${formatted}元`;
  },
  // Sankey formatters for pre-scaled values (万)
  'sankey_financial_label_万': (p: unknown) => {
    const param = p as EChartsParam;
    const name = param.name || '';
    const val = param.value as number;
    if (typeof val !== 'number' || isNaN(val)) return name;
    return `${name}\n${val.toFixed(1)}万`;
  },
  'sankey_financial_tooltip_万': (p: unknown) => {
    const param = p as EChartsParam;
    if (param.dataType === 'edge') {
      const d = param.data as Record<string, unknown> | undefined;
      const src = d?.source || '';
      const tgt = d?.target || '';
      const val = (d?.value as number) ?? 0;
      return `<b>${src} → ${tgt}</b><br/>金额: ${Number(val).toFixed(2)}万元`;
    }
    const name = param.name || '';
    const val = (param.value as number) ?? 0;
    return `<b>${name}</b><br/>金额: ${Number(val).toFixed(2)}万元`;
  },
  // Sankey formatters for pre-scaled values (亿)
  'sankey_financial_label_亿': (p: unknown) => {
    const param = p as EChartsParam;
    const name = param.name || '';
    const val = param.value as number;
    if (typeof val !== 'number' || isNaN(val)) return name;
    return `${name}\n${val.toFixed(2)}亿`;
  },
  'sankey_financial_tooltip_亿': (p: unknown) => {
    const param = p as EChartsParam;
    if (param.dataType === 'edge') {
      const d = param.data as Record<string, unknown> | undefined;
      const src = d?.source || '';
      const tgt = d?.target || '';
      const val = (d?.value as number) ?? 0;
      return `<b>${src} → ${tgt}</b><br/>金额: ${Number(val).toFixed(2)}亿元`;
    }
    const name = param.name || '';
    const val = (param.value as number) ?? 0;
    return `<b>${name}</b><br/>金额: ${Number(val).toFixed(2)}亿元`;
  },
  financial_rich_tooltip: (params: unknown) => {
    // Handle both axis and non-axis (pie/radar/gauge) tooltips
    if (!params) return '';
    let items: EChartsParam[];
    // Pie/gauge/radar: single param object, not array
    if (!Array.isArray(params)) {
      const p = params as EChartsParam;
      // Pie chart tooltip
      if (p.componentType === 'series' && (p.seriesType === 'pie' || p.seriesType === 'gauge' || p.seriesType === 'radar')) {
        const colorObj = p.color;
        const color = typeof colorObj === 'string' ? colorObj : ((colorObj as Record<string, unknown>)?.colorStops as Array<{ color: string }> | undefined)?.[1]?.color || '#666';
        const val = typeof p.value === 'number' ? p.value : parseFloat(String(p.value ?? '0'));
        const abs = Math.abs(val);
        const formatted = abs >= 1e8 ? (val / 1e8).toFixed(2) + '亿' : abs >= 1e4 ? (val / 1e4).toFixed(1) + '万' : val.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
        const pctStr = p.percent != null ? ` (${(p.percent as number).toFixed(1)}%)` : '';
        return `<div style="font-weight:600;margin-bottom:4px;font-size:13px;color:#1A2332">${p.seriesName || ''}</div>`
          + `<div style="display:flex;align-items:center;gap:6px">`
          + `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>`
          + `<span style="font-size:12px;color:#666">${p.name || ''}</span>`
          + `<span style="font-weight:600;font-size:12px;color:#333;margin-left:auto">${formatted}${pctStr}</span>`
          + `</div>`;
      }
      items = [p];
    } else {
      items = params as EChartsParam[];
    }
    if (!items.length) return '';
    const title = items[0].axisValueLabel || items[0].name || '';
    let html = `<div style="font-weight:600;margin-bottom:6px;font-size:13px;color:#1A2332">${title}</div>`;
    const fmtVal = (v: number) => {
      if (typeof v !== 'number' || isNaN(v)) return '-';
      const abs = Math.abs(v);
      if (abs >= 1e8) return (v / 1e8).toFixed(2) + '亿';
      if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万';
      return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    };
    const vals = items.map((p: EChartsParam) => {
      const v = Array.isArray(p.value) ? p.value[1] : p.value;
      return typeof v === 'number' ? Math.abs(v) : 0;
    });
    const maxVal = Math.max(...vals, 1);
    for (const p of items) {
      const val = Array.isArray(p.value) ? (p.value as number[])[1] : p.value;
      const numVal = typeof val === 'number' ? val : parseFloat(String(val));
      const sName = (p.seriesName || '') as string;
      const isRateSeries = /同比|增长|达成|环比/.test(sName);
      const formatted = isRateSeries
        ? (isNaN(numVal) ? '-' : numVal.toFixed(1) + '%')
        : fmtVal(numVal);
      const pct = Math.min(Math.abs(numVal) / maxVal * 100, 100);
      const colorObj = p.color;
      const color = colorObj && typeof colorObj === 'object'
        ? ((colorObj as Record<string, unknown>).colorStops as Array<{ color: string }> | undefined)?.[1]?.color || '#666'
        : (colorObj as string || '#666');
      html += `<div style="display:flex;align-items:center;margin:4px 0;gap:6px">`;
      html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>`;
      html += `<span style="flex:1;font-size:12px;color:#666">${p.seriesName || ''}</span>`;
      html += `<span style="font-weight:600;font-size:12px;color:#333;margin-left:12px">${formatted}</span>`;
      html += `</div>`;
      html += `<div style="height:3px;background:#f0f0f0;border-radius:2px;margin:0 0 2px 14px">`;
      html += `<div style="height:100%;width:${pct.toFixed(0)}%;background:${color};border-radius:2px;transition:width 0.3s"></div>`;
      html += `</div>`;
    }

    // --- Delta comparisons between series pairs ---
    const seriesMap: Record<string, number> = {};
    for (const p of items) {
      const name = (p.seriesName || '') as string;
      const v = Array.isArray(p.value) ? (p.value as number[])[1] : p.value;
      seriesMap[name] = typeof v === 'number' ? v : parseFloat(String(v));
    }

    const deltaPairs: { label: string; delta: number; base: number }[] = [];

    // 预算 vs 实际
    const budgetKey = Object.keys(seriesMap).find(k => k.includes('预算'));
    const actualKey = Object.keys(seriesMap).find(k => k.includes('实际'));
    if (budgetKey && actualKey && !isNaN(seriesMap[budgetKey]) && !isNaN(seriesMap[actualKey])) {
      deltaPairs.push({ label: '预算差异', delta: seriesMap[actualKey] - seriesMap[budgetKey], base: seriesMap[budgetKey] });
    }

    // 本年 vs 上年
    const curYearKey = Object.keys(seriesMap).find(k => k.includes('本年') || k.includes('今年') || k.includes('本期'));
    const lastYearKey = Object.keys(seriesMap).find(k => k.includes('上年') || k.includes('去年') || k.includes('上期'));
    if (curYearKey && lastYearKey && !isNaN(seriesMap[curYearKey]) && !isNaN(seriesMap[lastYearKey])) {
      deltaPairs.push({ label: '同比差异', delta: seriesMap[curYearKey] - seriesMap[lastYearKey], base: seriesMap[lastYearKey] });
    }

    if (deltaPairs.length > 0) {
      html += `<div style="border-top:1px dashed #e8e8e8;margin-top:6px;padding-top:6px">`;
      for (const dp of deltaPairs) {
        const isPositive = dp.delta >= 0;
        const arrow = isPositive ? '▲' : '▼';
        const clr = isPositive ? '#52c41a' : '#f5222d';
        const pctChange = dp.base !== 0 ? ((dp.delta / Math.abs(dp.base)) * 100).toFixed(1) : '-';
        const sign = isPositive ? '+' : '';
        html += `<div style="font-size:11px;color:#999;margin:2px 0">`;
        html += `${dp.label}: <span style="color:${clr};font-weight:600">${arrow} Δ = ${fmtVal(dp.delta)} (${sign}${pctChange}%)</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    // --- Summary: total of bar-type series ---
    let barTotal = 0;
    let hasBar = false;
    for (const p of items) {
      const name = (p.seriesName || '') as string;
      const isRateSeries = /同比|增长|达成|环比/.test(name);
      if (p.seriesType === 'bar' && !isRateSeries) {
        const v = Array.isArray(p.value) ? (p.value as number[])[1] : p.value;
        const numV = typeof v === 'number' ? v : parseFloat(String(v));
        if (!isNaN(numV)) { barTotal += numV; hasBar = true; }
      }
    }
    if (hasBar && items.length > 1) {
      html += `<div style="border-top:1px dashed #e8e8e8;margin-top:6px;padding-top:4px;font-size:11px;color:#999">`;
      html += `合计: <b style="color:#333">${fmtVal(barTotal)}</b>`;
      html += `</div>`;
    }

    // Fix 68: Sparkline mini-chart in tooltip (Power BI Tooltip Pages)
    // Show sparkline for the first series that has enough data points
    if (items.length > 0) {
      const firstP = items[0];
      // Try to get full series data from encode or series context
      const dataIdx = firstP.dataIndex as number | undefined;
      // If series has the full data array available via seriesData
      if (Array.isArray(firstP.dimensionNames) || typeof dataIdx === 'number') {
        // Get all values from the series to build sparkline
        const fullData: number[] = [];
        // Access params' series data if available
        if (firstP.series?.data) {
          const sd = firstP.series.data;
          for (const d of sd) {
            const v = typeof d === 'number' ? d : (Array.isArray(d) ? d[1] : (d as Record<string, unknown>)?.value);
            fullData.push(typeof v === 'number' ? v : parseFloat(String(v)) || 0);
          }
        }
        if (fullData.length >= 3) {
          const color = firstP.color && typeof firstP.color === 'string' ? firstP.color : '#2D8B57';
          html += sparklineSVG(fullData, typeof dataIdx === 'number' ? dataIdx : -1, 140, 28, color);
        }
      }
    }

    return html;
  },
  stack_total: (p: unknown) => {
    const param = p as EChartsParam;
    const v = typeof param.value === 'number' ? param.value : parseFloat(String(param.value));
    if (isNaN(v)) return '';
    const abs = Math.abs(v);
    if (abs >= 1e8) return (v / 1e8).toFixed(1) + '亿';
    if (abs >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString('zh-CN');
  },
  // Fix 69: CAGR annotation label formatter
  cagr_annotation: (p: unknown) => {
    const param = p as EChartsParam;
    const val = param.value ?? (param.data as Record<string, unknown> | undefined)?.value;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return `CAGR ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    return '';
  },
  // Fix 70: R² label formatter
  r_squared_label: (p: unknown) => {
    const param = p as EChartsParam;
    const val = param.value ?? (param.data as Record<string, unknown> | undefined)?.value;
    if (typeof val === 'number') return `R²=${val.toFixed(2)}`;
    return String(val ?? '');
  },
};

/**
 * Recursively resolve __ANIM__ / __FMT__ magic strings in an ECharts option tree.
 * Depth-limited to 20 levels to prevent runaway recursion on pathological inputs.
 */
export function processEChartsOptions(opts: Record<string, unknown>): Record<string, unknown> {
  const MAX_DEPTH = 20;
  const processValue = (val: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return val;
    if (typeof val === 'string') {
      if (val.startsWith('__ANIM__')) return ANIM_REGISTRY[val.slice(8)] ?? val;
      if (val.startsWith('__FMT__')) return FMT_REGISTRY[val.slice(7)] ?? val;
      return val;
    }
    if (typeof val === 'number' || typeof val === 'boolean' || val == null) return val;
    if (Array.isArray(val)) return val.map(v => processValue(v, depth + 1));
    if (typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        result[k] = processValue(v, depth + 1);
      }
      return result;
    }
    return val;
  };
  return processValue(opts, 0) as Record<string, unknown>;
}

/** Re-export registries for consumers that need direct access. */
export { ANIM_REGISTRY, FMT_REGISTRY };
