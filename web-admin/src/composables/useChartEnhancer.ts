/**
 * useChartEnhancer — shared chart option enhancements
 *
 * Extracts common enhancement logic from SmartBIAnalysis.vue's enhanceChartOption()
 * so DynamicChartRenderer and other chart consumers can reuse it.
 */

export interface SeriesStats {
  max: number;
  min: number;
  count: number;
  nonZeroMin: number;
  zeroCount: number;
  median: number;
}

/** Collect numeric stats from all series data arrays */
export function getSeriesStats(series: Array<Record<string, unknown>> | undefined): SeriesStats {
  if (!Array.isArray(series)) return { max: 0, min: 0, count: 0, nonZeroMin: Infinity, zeroCount: 0, median: 0 };
  let maxVal = 0, minVal = Infinity, count = 0, nonZeroMin = Infinity, zeroCount = 0;
  const allValues: number[] = [];
  for (const s of series) {
    const data = s?.data;
    if (!Array.isArray(data)) continue;
    for (const d of data as unknown[]) {
      const v = typeof d === 'number' ? d : (Array.isArray(d) ? Number(d[1]) || 0 : Number((d as Record<string, unknown>)?.value) || 0);
      const abs = Math.abs(v);
      allValues.push(abs);
      if (abs > maxVal) maxVal = abs;
      if (abs < minVal) minVal = abs;
      if (abs > 0 && abs < nonZeroMin) nonZeroMin = abs;
      if (v === 0) zeroCount++;
      count++;
    }
  }
  allValues.sort((a, b) => a - b);
  const median = allValues.length > 0 ? allValues[Math.floor(allValues.length / 2)] : 0;
  return { max: maxVal, min: minVal, count, nonZeroMin, zeroCount, median };
}

/**万/亿 compact number formatter for axis labels */
export function compactAxisFormatter(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}亿`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return String(value);
}

/** 万/亿 compact formatter for tooltip values */
export function compactTooltipFormatter(value: number | string): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (Math.abs(num) >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (Math.abs(num) >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

/** 万/亿 compact formatter for data labels */
export function compactLabelFormatter(params: unknown): string {
  const p = params as { value: unknown };
  const v = typeof p.value === 'number' ? p.value :
            (Array.isArray(p.value) ? Number(p.value[1]) : Number(p.value));
  if (isNaN(v)) return '';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}

/** Food industry semantic coloring for series */
const SEMANTIC_COLOR_MAP: Array<{ pattern: RegExp; colors: string[] }> = [
  { pattern: /收入|营收|销售额|revenue/i, colors: ['#52c41a', '#73d13d'] },
  { pattern: /成本|费用|支出|cost|expense/i, colors: ['#ff4d4f', '#ff7875'] },
  { pattern: /利润|净利|毛利|profit/i, colors: ['#1890ff', '#40a9ff'] },
  { pattern: /率|比例|占比|ratio|margin|rate/i, colors: ['#722ed1', '#9254de'] },
];

/**
 * Apply shared enhancements to an ECharts option object.
 * Safe to call on any chart option — checks for existence of each property.
 */
export function enhanceChartDefaults(opts: Record<string, unknown>): void {
  const series = opts.series as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(series)) return;

  const stats = getSeriesStats(series);
  const chartType = (series[0]?.type as string) || '';
  const xAxis = opts.xAxis as Record<string, unknown> | undefined;
  const yAxis = opts.yAxis;

  // --- Tooltip compact valueFormatter ---
  {
    const tip = (opts.tooltip || {}) as Record<string, unknown>;
    if (!tip.valueFormatter) {
      tip.valueFormatter = compactTooltipFormatter;
    }
    opts.tooltip = tip;
  }

  // --- Auto 万/亿 axis formatter (handles dual-axis arrays + horizontal bars) ---
  if (chartType !== 'pie' && stats.max >= 10000) {
    const yAxesList = Array.isArray(yAxis) ? yAxis : (yAxis ? [yAxis] : []);
    for (const ax of yAxesList as Array<Record<string, unknown>>) {
      if (ax && ax.type !== 'category' && !(ax.axisLabel as Record<string, unknown>)?.formatter) {
        ax.axisLabel = (ax.axisLabel || {}) as Record<string, unknown>;
        (ax.axisLabel as Record<string, unknown>).formatter = compactAxisFormatter;
      }
    }
    if (xAxis && xAxis.type === 'value' && !(xAxis.axisLabel as Record<string, unknown>)?.formatter) {
      xAxis.axisLabel = (xAxis.axisLabel || {}) as Record<string, unknown>;
      (xAxis.axisLabel as Record<string, unknown>).formatter = compactAxisFormatter;
    }
  }

  // --- Compact data labels for series with label.show ---
  if (stats.max >= 10000) {
    for (const s of series) {
      const label = s.label as Record<string, unknown> | undefined;
      if (label?.show && !label.formatter) {
        label.formatter = compactLabelFormatter;
      }
    }
  }

  // --- Semantic coloring (food industry) ---
  if (chartType !== 'pie') {
    for (const s of series) {
      if (!s.name || typeof s.name !== 'string') continue;
      const itemStyle = s.itemStyle as Record<string, unknown> | undefined;
      if (itemStyle?.color) continue;
      for (const rule of SEMANTIC_COLOR_MAP) {
        if (rule.pattern.test(s.name)) {
          s.itemStyle = (s.itemStyle || {}) as Record<string, unknown>;
          (s.itemStyle as Record<string, unknown>).color = rule.colors[0];
          if (s.lineStyle) (s.lineStyle as Record<string, unknown>).color = rule.colors[0];
          break;
        }
      }
    }
  }

  // --- Gradient area fill for line series ---
  for (const s of series) {
    if (s.type !== 'line' || s.areaStyle) continue;
    const baseColor = (s.itemStyle as Record<string, unknown>)?.color || (s.lineStyle as Record<string, unknown>)?.color;
    if (!baseColor || typeof baseColor !== 'string') continue;
    s.areaStyle = {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: baseColor + '30' },
          { offset: 1, color: baseColor + '05' },
        ],
      },
    };
  }

  // --- Legend scroll mode when many series ---
  const legend = opts.legend as Record<string, unknown> | undefined;
  if (legend && series.length > 5) {
    legend.type = 'scroll';
    legend.pageIconSize = 12;
    legend.pageTextStyle = { fontSize: 11 };
  }

  // --- DataZoom for category axes with many data points ---
  if (xAxis && xAxis.type === 'category' && Array.isArray(xAxis.data)) {
    const dataLen = (xAxis.data as unknown[]).length;
    if (dataLen > 15 && !opts.dataZoom) {
      const endPercent = Math.min(100, Math.round((15 / dataLen) * 100));
      opts.dataZoom = [
        { type: 'slider', show: true, xAxisIndex: 0, start: 0, end: endPercent, height: 20, bottom: 8 },
        { type: 'inside', xAxisIndex: 0, start: 0, end: endPercent },
      ];
      const grid = (opts.grid || {}) as Record<string, unknown>;
      const curBottom = typeof grid.bottom === 'number' ? grid.bottom : 50;
      grid.bottom = Math.max(curBottom as number, 60);
      opts.grid = grid;
    }
    // X-axis label rotation for crowded labels
    const maxLabelLen = Math.max(...(xAxis.data as unknown[]).map((d: unknown) => String(d).length));
    const axisLabel = (xAxis.axisLabel || {}) as Record<string, unknown>;
    let optRotate = 0;
    if (dataLen > 50) optRotate = 60;
    else if (dataLen > 30) optRotate = 50;
    else if (dataLen > 15) optRotate = 45;
    else if (maxLabelLen > 4 && dataLen > 4) optRotate = 40;
    else if (maxLabelLen > 6 && dataLen > 2) optRotate = 35;
    if (optRotate > ((axisLabel.rotate as number) || 0)) {
      axisLabel.rotate = optRotate;
    }
    axisLabel.hideOverlap = true;
    xAxis.axisLabel = axisLabel;
    // Adjust grid bottom for rotated labels
    if (optRotate >= 30) {
      const grid = (opts.grid || {}) as Record<string, unknown>;
      const curBottom = typeof grid.bottom === 'number' ? grid.bottom : 50;
      const neededBottom = optRotate >= 45 ? 85 : 70;
      if ((curBottom as number) < neededBottom) {
        grid.bottom = neededBottom;
        opts.grid = grid;
      }
    }
    // Label truncation
    if (!axisLabel.formatter && maxLabelLen > 10) {
      axisLabel.formatter = (v: string) => v.length > 10 ? v.substring(0, 9) + '…' : v;
    }
  }

  // --- Pie chart label overlap prevention ---
  if (chartType === 'pie') {
    for (const s of series) {
      s.avoidLabelOverlap = true;
      const pieData = s.data as Array<Record<string, unknown>> | undefined;
      const dataCount = pieData?.length || 0;
      if (dataCount > 8) {
        // Too many slices — show labels only for top items, hide small ones
        s.label = { show: true, formatter: '{b}: {d}%', fontSize: 11 };
        s.labelLine = { show: true, length: 10, length2: 8 };
        s.labelLayout = { hideOverlap: true };
      } else if (dataCount > 0) {
        // Moderate slices — ensure labels are visible
        if (!s.label || (s.label as Record<string, unknown>).show === false) {
          s.label = { show: true, formatter: '{b}: {d}%', fontSize: 11 };
          s.labelLine = { show: true };
        }
      }
    }
  }

  // --- Outlier detection hint in tooltip ---
  if (chartType === 'bar' && stats.median > 0 && stats.max > stats.median * 10) {
    const tip = (opts.tooltip || {}) as Record<string, unknown>;
    if (!tip.formatter) {
      tip.formatter = (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as Record<string, unknown>;
        const val = typeof p.value === 'number' ? p.value : (Array.isArray(p.value) ? (p.value as number[])[1] : p.value);
        const numVal = Number(val);
        const base = `${p.marker || ''}${p.seriesName}: <b>${numVal.toLocaleString()}</b>`;
        if (Math.abs(numVal) > stats.median * 10) {
          return `${p.name}<br/>${base}<br/><span style="color:#ff6b35;font-size:11px">⚠ 离群值 (${(numVal / stats.median).toFixed(0)}x 中位数)</span>`;
        }
        return `${p.name}<br/>${base}`;
      };
      opts.tooltip = tip;
    }
  }
}
