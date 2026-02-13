/**
 * SmartBI API - Analysis Module
 * Analysis, chat, drill-down, cross-sheet, YoY, KPI, financial metrics,
 * chart planning, and the main enrichSheetAnalysis orchestrator.
 */
import {
  pythonFetch,
  getFactoryId,
  enrichmentLimiter,
  activeControllers,
  humanizeColumnName,
  formatLargeNumber,
  compressMonthRange,
  SUBTOTAL_SUMMARY_PATTERN,
  KPI_KEYWORD_WEIGHTS,
  type AnalysisResult,
  type DrillDownResult,
  type CrossSheetResult,
  type YoYResult,
  type ChartPlanItem,
  type ColumnSummary,
  type FinancialMetrics,
  type StructuredAIData,
  type EnrichResult,
  type SmartKPI,
  computeSensitivityFallback,
} from './common';

import { getUploadTableData } from './upload';
import {
  buildChart,
  recommendChart,
  smartRecommendChart,
  batchBuildCharts,
  quickSummary,
  generateInsights,
  getForecast,
  getCachedAnalysis,
  saveAnalysisToCache,
} from './python-service';

// Re-export renameMeaninglessColumns so existing imports work
export { renameMeaninglessColumns } from './data-utils';

// ==================== Chat / Analysis Functions ====================

/**
 * Chat analysis (supports tool calling)
 */
export async function chatAnalysis(params: {
  query: string;
  data?: unknown[];
  fields?: Array<{ original: string; standard: string }>;
  table_type?: string;
  uploadId?: string;
}): Promise<AnalysisResult> {
  try {
    return await pythonFetch('/api/chat/general-analysis', {
      method: 'POST',
      body: JSON.stringify({
        query: params.query,
        data: params.data,
        fields: params.fields,
        table_type: params.table_type,
        sheet_id: params.uploadId || undefined,
      })
    }) as AnalysisResult;
  } catch (error) {
    console.error('chatAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Chat 分析请求失败'
    };
  }
}

/**
 * Drill-down analysis
 */
export async function drillDownAnalysis(params: {
  dimension: string;
  measures: string[];
  data: unknown[];
  fields: Array<{ original: string; standard: string }>;
  filterValue?: string;
}): Promise<AnalysisResult> {
  try {
    return await pythonFetch('/api/chat/drill-down', {
      method: 'POST',
      body: JSON.stringify(params)
    }) as AnalysisResult;
  } catch (error) {
    console.error('drillDownAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '下钻分析请求失败'
    };
  }
}

/**
 * Industry benchmark comparison
 */
export async function benchmarkAnalysis(params: {
  metrics: Record<string, number>;
  industry: string;
}): Promise<AnalysisResult> {
  try {
    return await pythonFetch('/api/chat/benchmark', {
      method: 'POST',
      body: JSON.stringify(params)
    }) as AnalysisResult;
  } catch (error) {
    console.error('benchmarkAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '基准对比请求失败'
    };
  }
}

/**
 * Chart drill-down - called after clicking chart data point
 */
export async function chartDrillDown(params: {
  uploadId: number;
  sheetName: string;
  dimension: string;
  filterValue: string;
  measures: string[];
  data: Record<string, unknown>[];
  hierarchyType?: string;
  currentLevel?: number;
  breadcrumb?: Array<{ dimension: string; value: string }>;
}): Promise<DrillDownResult> {
  try {
    const result = await pythonFetch('/api/chat/drill-down', {
      method: 'POST',
      body: JSON.stringify({
        sheet_id: `upload_${params.uploadId}_${params.sheetName}`,
        dimension: params.dimension,
        filter_value: params.filterValue,
        measures: params.measures,
        data: params.data,
        hierarchy_type: params.hierarchyType,
        current_level: params.currentLevel,
        breadcrumb: params.breadcrumb
      })
    }) as Record<string, unknown>;

    // Generate AI insight if drill-down succeeded
    let aiInsight: string | undefined;
    if (result.success && result.result?.data?.length) {
      const insightRes = await generateInsights({
        data: result.result.data,
        analysisContext: `下钻分析: 维度="${params.dimension}", 筛选值="${params.filterValue}", 报表="${params.sheetName}"`,
        maxInsights: 3
      });
      if (insightRes.success && insightRes.insights?.length) {
        aiInsight = insightRes.insights
          .map(i => `**${i.type}**: ${i.text}${i.recommendation ? `\n建议: ${i.recommendation}` : ''}`)
          .join('\n\n');
      }
    }

    return {
      success: result.success,
      result: result.result,
      chartConfig: result.chartConfig,
      aiInsight,
      error: result.error,
      available_dimensions: result.availableDimensions,
      hierarchy: result.hierarchy,
      breadcrumb: result.breadcrumb,
      current_level: result.currentLevel,
      max_level: result.maxLevel,
    };
  } catch (error) {
    console.error('chartDrillDown 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '下钻分析请求失败'
    };
  }
}

/**
 * Cross-sheet comprehensive analysis
 */
export async function crossSheetAnalysis(params: {
  uploadIds: number[];
  sheetNames: string[];
}): Promise<CrossSheetResult> {
  try {
    return await pythonFetch('/api/smartbi/cross-sheet-analysis', {
      method: 'POST',
      body: JSON.stringify({
        upload_ids: params.uploadIds,
        sheet_names: params.sheetNames
      })
    }) as CrossSheetResult;
  } catch (error) {
    console.error('crossSheetAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '综合分析请求失败'
    };
  }
}

/**
 * YoY comparison analysis
 */
export async function yoyComparison(params: {
  uploadId: number;
  compareUploadId?: number;
}): Promise<YoYResult> {
  try {
    return await pythonFetch('/api/smartbi/yoy-comparison', {
      method: 'POST',
      body: JSON.stringify({
        upload_id: params.uploadId,
        compare_upload_id: params.compareUploadId
      })
    }) as YoYResult;
  } catch (error) {
    console.error('yoyComparison failed:', error);
    return {
      success: false,
      current_upload_id: params.uploadId,
      comparison: [],
      error: error instanceof Error ? error.message : 'YoY comparison failed'
    };
  }
}

// ==================== Smart Chart Title + KPI Selection ====================

/**
 * Generate semantic chart title based on chart type and field names
 */
export function generateChartTitle(chartType: string, xField: string, yFields: string[]): string {
  const xLabel = humanizeColumnName(xField);

  const isDateY = yFields.length > 0 && yFields.every(f => /^\d{4}-\d{2}/.test(f) || /^\d{1,2}月$/.test(f));

  // Fix 5: Compact yLabel — collapse 3+ fields into "N项指标"
  let yLabel: string;
  if (isDateY) {
    yLabel = compressMonthRange(yFields);
  } else if (yFields.length === 1) {
    yLabel = humanizeColumnName(yFields[0]);
  } else if (yFields.length <= 2) {
    yLabel = yFields.map(humanizeColumnName).join('\u3001');
  } else {
    yLabel = `${yFields.length}项指标`;
  }

  const typeVerb: Record<string, string> = {
    'line': '趋势', 'bar': '对比', 'pie': '构成占比', 'waterfall': '增减分析',
    'scatter': '相关性', 'area': '趋势', 'combination': '综合对比',
    'radar': '多维对比', 'bar_horizontal': '排行',
    'pareto': '帕累托分析', 'dual_axis': '双指标对比',
    'sunburst': '层级构成',
  };

  const verb = typeVerb[chartType] || '分析';

  let title: string;
  switch (chartType) {
    case 'line':
      if (xLabel === '月份' || xField === '月份') title = `${yLabel} 月度趋势`;
      else title = isDateY ? `各${xLabel}${yLabel}趋势` : `${yLabel} 变化趋势`;
      break;
    case 'bar':
      if (xLabel === '月份' || xField === '月份') title = `${yLabel} 月度对比`;
      else title = isDateY ? `各${xLabel}${yLabel}对比` : (xLabel ? `各${xLabel}${yLabel}对比` : `${yLabel} 对比分析`);
      break;
    case 'pie':
      title = `${yLabel} 构成占比`;
      break;
    case 'waterfall':
      title = `${yLabel} 增减分析`;
      break;
    case 'scatter':
      title = yFields.length >= 1 && xField
        ? `${xLabel} vs ${humanizeColumnName(yFields[0])} 相关性`
        : '散点分布';
      break;
    case 'area':
      title = xField === '月份' ? `${yLabel} 累计趋势` : `${yLabel} 面积分布`;
      break;
    case 'combination':
      title = `${yLabel} 综合对比`;
      break;
    case 'radar':
      title = '多维度对比分析';
      break;
    case 'bar_horizontal':
      title = `${yLabel} 排行`;
      break;
    case 'pareto':
      title = `${yLabel} 帕累托分析`;
      break;
    case 'dual_axis':
      title = `${yLabel} 双指标对比`;
      break;
    case 'sunburst':
      title = `${yLabel} 层级构成`;
      break;
    default:
      title = `${yLabel} ${verb}`;
  }

  // Fix 5: Hard limit 30 characters
  if (title.length > 30) {
    title = title.slice(0, 27) + '...';
  }
  return title;
}

/**
 * Smart KPI extraction
 */
export function getSmartKPIs(
  kpiSummary: { rowCount: number; columnCount: number; columns: ColumnSummary[] },
  financialMetrics?: FinancialMetrics | null
): SmartKPI[] {
  const numericTypes = ['int64', 'float64', 'numeric', 'number', 'int32', 'float32'];
  const numericCols = (kpiSummary.columns || []).filter(
    c => numericTypes.includes(c.type) && c.sum != null
  );

  if (numericCols.length === 0) {
    return [{
      title: '数据行数',
      value: kpiSummary.rowCount,
      unit: '行',
      status: 'info',
      displayMode: 'default',
      sparklineData: []
    }];
  }

  // ========== Phase 1: Financial ratio KPIs from computed metrics ==========
  const ratioKPIs: SmartKPI[] = [];

  if (financialMetrics) {
    if (financialMetrics.revenue) {
      const rev = financialMetrics.revenue.total;
      const { displayValue, unit } = formatLargeNumber(rev);
      const lastMom = financialMetrics.mom?.filter(m => m.change !== null).slice(-1)[0];
      ratioKPIs.push({
        title: '营业收入',
        value: displayValue,
        unit,
        trend: lastMom?.change != null ? (lastMom.change > 0 ? 'up' : lastMom.change < 0 ? 'down' : 'flat') : undefined,
        trendValue: lastMom?.change != null ? `环比${lastMom.change > 0 ? '+' : ''}${lastMom.change.toFixed(1)}%` : undefined,
        changeRate: lastMom?.change ?? undefined,
        status: 'success',
        displayMode: financialMetrics.monthlyRevenue && financialMetrics.monthlyRevenue.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyRevenue || [],
      });
    }

    if (financialMetrics.grossMargin != null) {
      const gap = financialMetrics.gaps['grossMargin'] ?? 0;
      const isHealthy = gap >= 0;
      ratioKPIs.push({
        title: '毛利率',
        value: (financialMetrics.grossMargin * 100).toFixed(1),
        unit: '%',
        trendValue: `行业${(financialMetrics.industryBenchmark.grossMargin * 100).toFixed(0)}%`,
        status: isHealthy ? 'success' : gap > -0.05 ? 'warning' : 'danger',
        displayMode: 'default',
        sparklineData: [],
        benchmarkLabel: `行业均值${(financialMetrics.industryBenchmark.grossMargin * 100).toFixed(0)}%`,
        benchmarkGap: gap * 100,
      });
    }

    if (financialMetrics.netMargin != null) {
      const gap = financialMetrics.gaps['netMargin'] ?? 0;
      const isHealthy = gap >= 0;
      ratioKPIs.push({
        title: '净利率',
        value: (financialMetrics.netMargin * 100).toFixed(1),
        unit: '%',
        trendValue: `行业${(financialMetrics.industryBenchmark.netMargin * 100).toFixed(0)}%`,
        status: isHealthy ? 'success' : financialMetrics.netMargin >= 0 ? 'warning' : 'danger',
        displayMode: financialMetrics.monthlyNetProfit && financialMetrics.monthlyNetProfit.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyNetProfit || [],
        benchmarkLabel: `行业均值${(financialMetrics.industryBenchmark.netMargin * 100).toFixed(0)}%`,
        benchmarkGap: gap * 100,
      });
    }

    if (financialMetrics.netProfit && ratioKPIs.length < 4) {
      const np = financialMetrics.netProfit.total;
      const { displayValue, unit } = formatLargeNumber(np);
      ratioKPIs.push({
        title: '净利润',
        value: displayValue,
        unit,
        status: np >= 0 ? 'success' : 'danger',
        displayMode: financialMetrics.monthlyNetProfit && financialMetrics.monthlyNetProfit.length >= 2 ? 'sparkline' : 'default',
        sparklineData: financialMetrics.monthlyNetProfit || [],
      });
    }

    if (financialMetrics.expenseRatio != null && ratioKPIs.length < 4) {
      ratioKPIs.push({
        title: '费用率',
        value: (financialMetrics.expenseRatio * 100).toFixed(1),
        unit: '%',
        trendValue: `基准${(financialMetrics.industryBenchmark.expenseRatio * 100).toFixed(0)}%`,
        status: financialMetrics.expenseRatio <= financialMetrics.industryBenchmark.expenseRatio ? 'success' : 'warning',
        displayMode: 'default',
        sparklineData: [],
      });
    }
  }

  if (ratioKPIs.length >= 3) {
    return ratioKPIs.slice(0, 4);
  }

  // ========== Phase 2: Column-based KPIs ==========
  interface ScoredCol {
    col: ColumnSummary;
    score: number;
    matchedKeyword: string;
    status: 'success' | 'warning' | 'danger' | 'info' | 'default';
  }
  const scored: ScoredCol[] = numericCols.map(col => {
    const extCol = col;
    let score = 0;
    let matchedKeyword = '';
    let status: 'success' | 'warning' | 'danger' | 'info' | 'default' = 'default';

    for (const [keyword, config] of Object.entries(KPI_KEYWORD_WEIGHTS)) {
      if (col.name.includes(keyword)) {
        score += config.weight;
        matchedKeyword = keyword;
        status = config.status;
        break;
      }
    }

    const absSum = Math.abs(col.sum || 0);
    if (absSum > 0) score += Math.min(Math.log10(absSum + 1) * 5, 30);
    if (extCol.trend) score += 10;

    return { col: extCol, score, matchedKeyword, status };
  });

  scored.sort((a, b) => b.score - a.score);

  const coveredNames = new Set(ratioKPIs.map(k => k.title));
  const remaining = scored.filter(s => !coveredNames.has(s.col.name));

  const slotsNeeded = 4 - ratioKPIs.length;
  const topN = remaining.slice(0, slotsNeeded);

  // Helper: compute sparkline-based MoM trend, skipping trailing zeros
  function computeSparklineTrend(sparkline: number[]): number | null {
    if (!sparkline || sparkline.length < 2) return null;
    const spark = sparkline;
    // Skip trailing zeros to find last meaningful data point
    let lastIdx = spark.length - 1;
    while (lastIdx > 0 && spark[lastIdx] === 0) lastIdx--;
    if (lastIdx >= 1) {
      const last = spark[lastIdx];
      const prev = spark[lastIdx - 1];
      if (prev !== 0) {
        return Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10;
      } else {
        return last !== 0 ? 100 : 0;
      }
    }
    return 0;
  }

  const columnKPIs: SmartKPI[] = topN.map(({ col, status }) => {
    const val = col.sum || 0;
    const extCol = col;

    const { displayValue, unit } = formatLargeNumber(val);

    let trendPct = extCol.trendPercent;

    // If trendPercent from Python is null/undefined but sparkline exists, compute from sparkline
    if (trendPct == null && extCol.sparkline && extCol.sparkline.length >= 2) {
      trendPct = computeSparklineTrend(extCol.sparkline);
    }
    // If sparkline exists, always prefer sparkline-based MoM over Python's first-vs-last
    else if (extCol.sparkline && extCol.sparkline.length >= 2) {
      trendPct = computeSparklineTrend(extCol.sparkline);
    }

    // Guard: extreme values (abs >= 80%) are likely data artifacts (e.g., row-based financial
    // data where first_val=revenue and last_val=net_profit, not a real time trend)
    if (trendPct != null && Math.abs(trendPct) >= 80) {
      trendPct = null;
    }

    const trend: 'up' | 'down' | 'flat' | undefined =
      trendPct != null ? (trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat') : undefined;
    const trendValue = trendPct != null ? `${trendPct > 0 ? '+' : ''}${trendPct}%` : undefined;

    let finalStatus = status;
    if (finalStatus === 'default' && trend) {
      finalStatus = trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'info';
    }

    return {
      title: humanizeColumnName(col.name),
      value: displayValue,
      unit,
      trend,
      trendValue,
      changeRate: trendPct != null ? trendPct : undefined,
      status: finalStatus,
      displayMode: (extCol.sparkline && extCol.sparkline.length >= 2 ? 'sparkline' : 'default') as 'sparkline' | 'default',
      sparklineData: extCol.sparkline || []
    };
  });

  // Safety check: if ALL column KPIs ended up with no trend (all nulled out), that's fine.
  // If ALL have exactly the same extreme negative trend, it's a mapping bug — clear them.
  const withTrend = columnKPIs.filter(k => k.changeRate != null);
  if (withTrend.length >= 2) {
    const allSame = withTrend.every(k => k.changeRate === withTrend[0].changeRate);
    if (allSame && Math.abs(withTrend[0].changeRate!) >= 50) {
      // All identical extreme trend = data artifact, clear all trends
      for (const kpi of columnKPIs) {
        kpi.changeRate = undefined;
        kpi.trend = undefined;
        kpi.trendValue = undefined;
      }
    }
  }

  return [...ratioKPIs, ...columnKPIs].slice(0, 4);
}

// ==================== Financial Metrics Pre-computation ====================

/**
 * Pre-compute financial metrics from profit/loss statement data
 */
export function computeFinancialMetrics(
  data: Record<string, unknown>[],
  monthlyColumns: string[],
  labelField: string
): FinancialMetrics | null {
  if (!data.length) return null;

  const keywordMap: Array<{ keywords: string[]; field: keyof Pick<FinancialMetrics, 'revenue' | 'cost' | 'grossProfit' | 'netProfit'> }> = [
    { keywords: ['营业收入', '主营业务收入'], field: 'revenue' },
    { keywords: ['营业成本', '主营业务成本'], field: 'cost' },
    { keywords: ['毛利润', '毛利'], field: 'grossProfit' },
    { keywords: ['净利润'], field: 'netProfit' },
  ];
  const expenseKeywords = ['销售费用', '管理费用', '财务费用', '研发费用'];
  const allFinancialKeywords = [
    ...keywordMap.flatMap(m => m.keywords),
    ...expenseKeywords,
  ];

  let effectiveLabelField = labelField;
  const sample = data;

  if (effectiveLabelField) {
    let labelFieldMatches = 0;
    for (const row of sample) {
      const val = String(row[effectiveLabelField] ?? '').replace(/[\s\u3000]+/g, '');
      if (val && allFinancialKeywords.some(kw => val.includes(kw))) {
        labelFieldMatches++;
      }
    }
    if (labelFieldMatches < 1) {
      // console.warn(`[computeFinancialMetrics] labelField "${effectiveLabelField}" has ${labelFieldMatches} keyword matches, forcing auto-detection`);
      effectiveLabelField = '';
    }
  }

  if (!effectiveLabelField) {
    const allKeys = Object.keys(data[0] || {});
    let bestCol = '';
    let bestMatches = 0;
    for (const key of allKeys) {
      let matchCount = 0;
      for (const row of sample) {
        const val = String(row[key] ?? '').replace(/[\s\u3000]+/g, '');
        if (val && allFinancialKeywords.some(kw => val.includes(kw))) {
          matchCount++;
        }
      }
      if (matchCount > bestMatches) {
        bestMatches = matchCount;
        bestCol = key;
      }
    }
    if (bestMatches >= 1) {
      effectiveLabelField = bestCol;
    }
  }

  if (!effectiveLabelField) {
    const firstCol = Object.keys(data[0] || {})[0];
    if (firstCol) {
      let firstColMatches = 0;
      for (const row of sample) {
        const val = String(row[firstCol] ?? '').replace(/[\s\u3000]+/g, '');
        if (val && allFinancialKeywords.some(kw => val.includes(kw))) {
          firstColMatches++;
        }
      }
      if (firstColMatches >= 1) {
        // console.warn(`[computeFinancialMetrics] first-column fallback: "${firstCol}" has ${firstColMatches} keyword matches`);
        effectiveLabelField = firstCol;
      }
    }
  }

  if (!effectiveLabelField) return null;

  const result: FinancialMetrics = {
    expenses: [],
    industryBenchmark: { grossMargin: 0.30, netMargin: 0.05, expenseRatio: 0.20 },
    gaps: {},
  };

  for (const row of data) {
    const rawLabel = String(row[effectiveLabelField] ?? '');
    const label = rawLabel.replace(/[\s\u3000]+/g, '').trim();
    if (!label) continue;

    const values: Record<string, number> = {};
    let total = 0;
    for (const [key, val] of Object.entries(row)) {
      if (key === effectiveLabelField) continue;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num)) {
        values[key] = num;
        total += num;
      }
    }
    if (Object.keys(values).length === 0) continue;

    const finRow = { label, values, total };

    for (const { keywords, field } of keywordMap) {
      if (keywords.some(kw => label.includes(kw)) && !result[field]) {
        (result as Record<string, unknown>)[field] = finRow;
        break;
      }
    }

    if (expenseKeywords.some(kw => label.includes(kw))) {
      result.expenses.push(finRow);
    }
  }

  if (result.revenue && result.revenue.total !== 0) {
    const rev = Math.abs(result.revenue.total);

    if (result.cost) {
      result.grossMargin = (result.revenue.total - result.cost.total) / rev;
      result.gaps['grossMargin'] = result.grossMargin - result.industryBenchmark.grossMargin;
    }

    if (result.netProfit) {
      result.netMargin = result.netProfit.total / rev;
      result.gaps['netMargin'] = result.netMargin - result.industryBenchmark.netMargin;
    }

    if (result.expenses.length > 0) {
      const totalExpense = result.expenses.reduce((sum, e) => sum + e.total, 0);
      result.expenseRatio = totalExpense / rev;
      result.gaps['expenseRatio'] = result.expenseRatio - result.industryBenchmark.expenseRatio;
    }

    if (monthlyColumns.length >= 2 && result.revenue) {
      result.monthlyRevenue = monthlyColumns.map(m => result.revenue!.values[m] ?? 0);
      result.mom = monthlyColumns.map((m, i) => {
        if (i === 0 || !result.monthlyRevenue) return { month: humanizeColumnName(m), change: null };
        const prev = result.monthlyRevenue[i - 1];
        const curr = result.monthlyRevenue[i];
        return {
          month: humanizeColumnName(m),
          change: prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null,
        };
      });
    }

    if (monthlyColumns.length >= 2 && result.netProfit) {
      result.monthlyNetProfit = monthlyColumns.map(m => result.netProfit!.values[m] ?? 0);
    }
  }

  if (!result.revenue && !result.netProfit && result.expenses.length === 0) return null;
  return result;
}

/**
 * Format financial metrics as LLM-readable context text
 */
function formatFinancialContext(metrics: FinancialMetrics): string {
  const parts: string[] = ['预计算财务指标:'];

  const fmt = (val: number) => {
    if (Math.abs(val) >= 1e8) return `${(val / 1e8).toFixed(2)}亿`;
    if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(2)}万`;
    return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  if (metrics.revenue) parts.push(`- 营业收入: ${fmt(metrics.revenue.total)}`);
  if (metrics.cost) parts.push(`- 营业成本: ${fmt(metrics.cost.total)}`);
  if (metrics.grossProfit) parts.push(`- 毛利: ${fmt(metrics.grossProfit.total)}`);
  if (metrics.netProfit) parts.push(`- 净利润: ${fmt(metrics.netProfit.total)}`);
  for (const exp of metrics.expenses) {
    parts.push(`- ${exp.label}: ${fmt(exp.total)}`);
  }

  if (metrics.grossMargin != null) {
    const gap = metrics.gaps['grossMargin'];
    parts.push(`- 毛利率: ${(metrics.grossMargin * 100).toFixed(1)}% (行业参考30%, ${gap && gap >= 0 ? '高于' : '低于'}行业${Math.abs((gap ?? 0) * 100).toFixed(1)}pp)`);
  }
  if (metrics.netMargin != null) {
    const gap = metrics.gaps['netMargin'];
    parts.push(`- 净利率: ${(metrics.netMargin * 100).toFixed(1)}% (行业参考5%, ${gap && gap >= 0 ? '高于' : '低于'}行业${Math.abs((gap ?? 0) * 100).toFixed(1)}pp)`);
  }
  if (metrics.expenseRatio != null) {
    parts.push(`- 费用率: ${(metrics.expenseRatio * 100).toFixed(1)}% (行业参考20%)`);
  }

  if (metrics.mom && metrics.mom.length > 0) {
    const momParts = metrics.mom
      .filter(m => m.change !== null)
      .map(m => `${m.month}:${m.change! > 0 ? '+' : ''}${m.change!.toFixed(1)}%`);
    if (momParts.length > 0) {
      parts.push(`- 收入环比: ${momParts.join(', ')}`);
    }
  }

  return parts.join('\n');
}

// ==================== Data Utilities (imported from data-utils) ====================
import {
  cleanDataForChart,
  detectMonthlyColumns,
  detectNumericColumns,
  detectLabelField,
  selectSummaryYFields,
  transposeForTimeSeries,
  formatMonthLabel,
  extractTextContext,
  detectAndPrefixSubTables,
} from './data-utils';

// ==================== Chart Plan Builder ====================

/**
 * Build multi-chart plan (3-5 diverse charts)
 */
function buildChartPlan(
  cleanedData: Record<string, unknown>[],
  recommendations: Array<{ chartType: string; xField?: string; yFields?: string[]; priority: number }>,
  dataInfo: { numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[] },
  monthlyColumns: string[],
  labelField: string,
  sheetIndex?: number
): ChartPlanItem[] {
  const plans: ChartPlanItem[] = [];
  const usedTypes = new Set<string>();

  const cleanLabel = (label: string): string => {
    const gm = label.match(/^(第\d+组)-.+$/);
    if (gm) return gm[1];
    return label.replace(/-\d+$/, '').replace(/\.0$/, '');
  };

  const numCols = dataInfo.numericColumns || [];

  // ========== Phase 1: Core strategies requiring labelField ==========

  // Strategy 1: Monthly columns -> time series line chart
  if (monthlyColumns.length >= 2 && labelField) {
    const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
    if (tsData.length > 0) {
      const seriesKeys = Object.keys(tsData[0]).filter(k => k !== '月份');
      if (seriesKeys.length > 0) {
        plans.push({
          chartType: 'line',
          data: tsData,
          xField: '月份',
          yFields: seriesKeys.slice(0, 5),
          title: generateChartTitle('line', '月份', seriesKeys.slice(0, 5))
        });
        usedTypes.add('line');
      }
    }
  }

  // Strategy 2: Categorical bar chart
  if (labelField && numCols.length > 0 && !usedTypes.has('bar')) {
    const yFields = selectSummaryYFields(numCols, labelField, 3);
    if (yFields.length > 0) {
      const seenLabels = new Set<string>();
      const filteredData = cleanedData.filter(row => {
        const label = row[labelField];
        if (label == null) return false;
        const key = String(label).trim();
        if (SUBTOTAL_SUMMARY_PATTERN.test(key)) return false;
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      });
      const primaryY = yFields[0];
      const sortedData = [...filteredData].sort((a, b) => {
        const va = Number(a[primaryY]) || 0;
        const vb = Number(b[primaryY]) || 0;
        return vb - va;
      });
      const chartData = sortedData.slice(0, 20).map(row => {
        const label = String(row[labelField] || '');
        const cleaned = cleanLabel(label);
        return { ...row, [labelField]: cleaned.length > 15 ? cleaned.substring(0, 15) + '...' : cleaned };
      });
      if (chartData.length > 0) {
        const barTitle = filteredData.length > 20
          ? generateChartTitle('bar', labelField, yFields) + ' (前20项)'
          : generateChartTitle('bar', labelField, yFields);
        plans.push({
          chartType: 'bar', data: chartData, xField: labelField,
          yFields, title: barTitle
        });
        usedTypes.add('bar');
      }
    }
  }

  // Strategy 3: Pie chart
  if (labelField && numCols.length > 0 && !usedTypes.has('pie')) {
    let valueField = numCols.find(c => /合计|总计|sum|total/i.test(c));
    if (!valueField) {
      valueField = monthlyColumns.length > 0
        ? monthlyColumns[monthlyColumns.length - 1]
        : numCols[0];
    }
    if (valueField) {
      const pieData = cleanedData
        .filter(row => row[labelField] != null && row[valueField!] != null)
        .filter(row => !SUBTOTAL_SUMMARY_PATTERN.test(String(row[labelField]).trim()))
        .filter(row => { const v = Number(row[valueField!]); return !isNaN(v) && v > 0; })
        .slice(0, 10)
        .map(row => ({ ...row, [labelField]: cleanLabel(String(row[labelField] || '')) }));
      if (pieData.length >= 2) {
        plans.push({
          chartType: 'pie', data: pieData, xField: labelField,
          yFields: [valueField],
          title: generateChartTitle('pie', labelField, [valueField]) + (pieData.length < cleanedData.filter(r => r[labelField] != null && r[valueField!] != null).filter(r => Number(r[valueField!]) > 0).length ? ` (前${pieData.length}项)` : '')
        });
        usedTypes.add('pie');
      }
    }
  }

  // Strategy 4: From Python recommendations
  for (const rec of recommendations) {
    if (plans.length >= 6) break; // Reserve 1-2 slots for Phase 2 diversification
    if (usedTypes.has(rec.chartType)) continue;
    if (!rec.xField || !rec.yFields?.length) continue;

    if (rec.chartType === 'line' && !monthlyColumns.includes(rec.xField)) {
      continue;
    }

    let chartData = cleanedData.filter(row => row[rec.xField!] != null);
    if (rec.chartType === 'bar' && rec.yFields.length > 0) {
      const py = rec.yFields[0];
      chartData = [...chartData].sort((a, b) => (Number(b[py]) || 0) - (Number(a[py]) || 0));
    }
    chartData = chartData.slice(0, 30);
    if (chartData.length < 2) continue;

    if (rec.xField && labelField) {
      chartData = chartData.map(row => ({ ...row, [rec.xField!]: cleanLabel(String(row[rec.xField!] || '')) }));
    }

    plans.push({
      chartType: rec.chartType, data: chartData, xField: rec.xField,
      yFields: rec.yFields, title: generateChartTitle(rec.chartType, rec.xField!, rec.yFields!)
    });
    usedTypes.add(rec.chartType);
  }

  // Strategy 5: Horizontal bar (monthly ranking)
  if (plans.length < 4 && monthlyColumns.length > 0 && labelField && !usedTypes.has('bar_horizontal')) {
    const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
    if (tsData.length > 0) {
      const firstSeries = Object.keys(tsData[0]).find(k => k !== '月份');
      if (firstSeries) {
        const sorted = [...tsData].sort((a, b) => Number(b[firstSeries] || 0) - Number(a[firstSeries] || 0));
        plans.push({
          chartType: 'bar_horizontal', data: sorted, xField: '月份',
          yFields: [firstSeries], title: generateChartTitle('bar_horizontal', '月份', [firstSeries])
        });
        usedTypes.add('bar_horizontal');
      }
    }
  }

  // ========== Phase 2: Diversification ==========
  const phase2Strategies: Array<{ type: string; tryAdd: () => void }> = [
    { type: 'waterfall', tryAdd: () => {
      if (!labelField || numCols.length === 0 || usedTypes.has('waterfall')) return;
      const seenWfLabels = new Set<string>();
      const wfDataRaw = cleanedData.filter(row => {
        const label = row[labelField];
        if (label == null) return false;
        const key = String(label).trim();
        if (SUBTOTAL_SUMMARY_PATTERN.test(key)) return false;
        if (seenWfLabels.has(key)) return false;
        seenWfLabels.add(key);
        return true;
      });
      if (wfDataRaw.length < 3) return;
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (!yField) return;
      let wfData = wfDataRaw;
      if (wfData.length > 30) {
        wfData = [...wfDataRaw]
          .sort((a, b) => Math.abs(Number(b[yField] || 0)) - Math.abs(Number(a[yField] || 0)))
          .slice(0, 25);
      }
      wfData = wfData.map(row => ({ ...row, [labelField]: cleanLabel(String(row[labelField] || '')) }));
      plans.push({
        chartType: 'waterfall', data: wfData, xField: labelField,
        yFields: [yField], title: generateChartTitle('waterfall', labelField, [yField])
      });
      usedTypes.add('waterfall');
    }},
    { type: 'area', tryAdd: () => {
      if (monthlyColumns.length < 2 || !labelField || usedTypes.has('area')) return;
      const tsData = transposeForTimeSeries(cleanedData, monthlyColumns, labelField);
      if (tsData.length === 0) return;
      const seriesKeys = Object.keys(tsData[0]).filter(k => k !== '月份');
      if (seriesKeys.length === 0) return;
      plans.push({
        chartType: 'area', data: tsData, xField: '月份',
        yFields: seriesKeys.slice(0, 3), title: generateChartTitle('area', '月份', seriesKeys.slice(0, 3))
      });
      usedTypes.add('area');
    }},
    { type: 'combination', tryAdd: () => {
      if (!labelField || numCols.length < 2 || usedTypes.has('combination')) return;
      const yFields = selectSummaryYFields(numCols, labelField, 2);
      if (yFields.length < 2) return;
      const chartData = cleanedData.filter(row => row[labelField] != null).slice(0, 15)
        .map(row => ({ ...row, [labelField]: cleanLabel(String(row[labelField] || '')) }));
      if (chartData.length < 2) return;
      plans.push({
        chartType: 'combination', data: chartData, xField: labelField,
        yFields, title: generateChartTitle('combination', labelField, yFields)
      });
      usedTypes.add('combination');
    }},
    { type: 'pareto', tryAdd: () => {
      if (!labelField || numCols.length === 0 || usedTypes.has('pareto')) return;
      const seenLabels = new Set<string>();
      const paretoData = cleanedData.filter(row => {
        const label = row[labelField];
        if (label == null) return false;
        const key = String(label).trim();
        if (SUBTOTAL_SUMMARY_PATTERN.test(key)) return false;
        if (seenLabels.has(key)) return false;
        seenLabels.add(key);
        return true;
      });
      if (paretoData.length < 3 || paretoData.length > 30) return;
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (!yField) return;
      const sorted = [...paretoData].sort((a, b) => Math.abs(Number(b[yField] || 0)) - Math.abs(Number(a[yField] || 0)));
      const chartData = sorted.slice(0, 20).map(row => ({
        ...row, [labelField]: cleanLabel(String(row[labelField] || ''))
      }));
      plans.push({
        chartType: 'pareto', data: chartData, xField: labelField,
        yFields: [yField], title: generateChartTitle('pareto', labelField, [yField])
      });
      usedTypes.add('pareto');
    }},
    { type: 'dual_axis', tryAdd: () => {
      if (!labelField || numCols.length < 2 || usedTypes.has('dual_axis')) return;
      const yFields = selectSummaryYFields(numCols, labelField, 2);
      if (yFields.length < 2) return;
      // Check if fields have different scales (ratio > 10 or < 0.1 suggests different units)
      const vals0 = cleanedData.map(r => Math.abs(Number(r[yFields[0]]) || 0)).filter(v => v > 0);
      const vals1 = cleanedData.map(r => Math.abs(Number(r[yFields[1]]) || 0)).filter(v => v > 0);
      if (vals0.length === 0 || vals1.length === 0) return;
      const avg0 = vals0.reduce((a, b) => a + b, 0) / vals0.length;
      const avg1 = vals1.reduce((a, b) => a + b, 0) / vals1.length;
      const ratio = avg0 / avg1;
      if (ratio > 0.1 && ratio < 10) return; // similar scale, skip dual_axis
      const chartData = cleanedData.filter(row => row[labelField] != null).slice(0, 20)
        .map(row => ({ ...row, [labelField]: cleanLabel(String(row[labelField] || '')) }));
      if (chartData.length < 2) return;
      plans.push({
        chartType: 'dual_axis', data: chartData, xField: labelField,
        yFields, title: generateChartTitle('dual_axis', labelField, yFields)
      });
      usedTypes.add('dual_axis');
    }},
    { type: 'bar_horizontal', tryAdd: () => {
      if (!labelField || numCols.length === 0 || usedTypes.has('bar_horizontal')) return;
      // Use horizontal bar when many categories (>8) or labels are long
      const uniqueLabels = new Set(cleanedData.map(r => String(r[labelField] ?? '')).filter(Boolean));
      if (uniqueLabels.size < 8) return;
      const yField = numCols.find(c => c !== labelField) || numCols[0];
      if (!yField) return;
      const sorted = [...cleanedData].filter(row => row[labelField] != null)
        .sort((a, b) => (Number(b[yField] || 0)) - (Number(a[yField] || 0)))
        .slice(0, 15)
        .map(row => ({ ...row, [labelField]: cleanLabel(String(row[labelField] || '')) }));
      if (sorted.length < 3) return;
      plans.push({
        chartType: 'bar_horizontal', data: sorted, xField: labelField,
        yFields: [yField], title: generateChartTitle('bar_horizontal', labelField, [yField])
      });
      usedTypes.add('bar_horizontal');
    }},
    { type: 'sunburst', tryAdd: () => {
      if (numCols.length === 0 || usedTypes.has('sunburst')) return;
      // Sunburst needs hierarchical data: at least 2 categorical-like columns + 1 numeric
      const catCols = Object.keys(cleanedData[0] || {}).filter(k => {
        if (numCols.includes(k)) return false;
        const uniqueVals = new Set(cleanedData.map(r => String(r[k] ?? '')).filter(Boolean));
        return uniqueVals.size >= 2 && uniqueVals.size <= 30;
      });
      if (catCols.length < 2) return;
      const yField = numCols.find(c => /合计|总计|sum|total|金额|收入|amount/i.test(c)) || numCols[0];
      if (!yField) return;
      const chartData = cleanedData.filter(row => row[catCols[0]] != null && Number(row[yField]) > 0).slice(0, 50);
      if (chartData.length < 3) return;
      plans.push({
        chartType: 'sunburst', data: chartData, xField: catCols[0],
        yFields: [yField], seriesField: catCols[1],
        title: generateChartTitle('sunburst', catCols[0], [yField])
      });
      usedTypes.add('sunburst');
    }},
  ];

  const offset = (sheetIndex ?? 0) % phase2Strategies.length;
  const rotatedPhase2 = [...phase2Strategies.slice(offset), ...phase2Strategies.slice(0, offset)];
  for (const strategy of rotatedPhase2) {
    if (plans.length >= 7) break;
    strategy.tryAdd();
  }

  // ========== Phase 3: Fallback strategies (no labelField needed) ==========
  if (plans.length === 0 && numCols.length > 0) {
    const indexedData = cleanedData.slice(0, 20).map((row, i) => ({
      ...row,
      __rowIndex: `#${i + 1}`
    }));
    const yFields = numCols.slice(0, 3);
    plans.push({
      chartType: 'bar', data: indexedData, xField: '__rowIndex',
      yFields, title: generateChartTitle('bar', '#行号', yFields)
    });
    usedTypes.add('bar');

    if (numCols.length >= 2) {
      plans.push({
        chartType: 'scatter', data: cleanedData.slice(0, 50), xField: numCols[0],
        yFields: [numCols[1]], title: generateChartTitle('scatter', numCols[0], [numCols[1]])
      });
      usedTypes.add('scatter');
    }

    if (numCols.length >= 3) {
      const radarData = cleanedData.slice(0, 5).map((row, i) => ({
        ...row,
        __rowIndex: `#${i + 1}`
      }));
      plans.push({
        chartType: 'radar', data: radarData, xField: '__rowIndex',
        yFields: numCols.slice(0, 6), title: generateChartTitle('radar', '__rowIndex', numCols.slice(0, 6))
      });
      usedTypes.add('radar');
    }
  }

  return plans.slice(0, 7);
}

// ==================== Main Enrichment Orchestrator ====================

/**
 * Sheet data enrichment - multi-chart dashboard version
 * Orchestration: clean -> recommend + quickSummary (parallel) -> buildChartPlan -> batchBuild -> forecast -> insights
 */
export async function enrichSheetAnalysis(uploadId: number, forceRefresh = false): Promise<EnrichResult> {
  // Cache-first
  if (!forceRefresh) {
    try {
      const cached = await getCachedAnalysis(uploadId);
      if (cached && cached.success) {
        // console.log(`[Cache] Hit for uploadId=${uploadId}, skipping enrichment`);
        return cached as EnrichResult;
      }
    } catch (e) {
      // console.warn('[Cache] Error checking cache, proceeding with enrichment:', e);
    }
  }

  await enrichmentLimiter.acquire();
  const timings: Record<string, number> = {};
  const tick = (label: string, t0: number) => { timings[label] = Math.round(performance.now() - t0); };
  const abortController = new AbortController();
  const prevController = activeControllers.get(`enrich-${uploadId}`);
  if (prevController) prevController.abort();
  activeControllers.set(`enrich-${uploadId}`, abortController);
  try {
    // 1. Get persisted table data
    let t0 = performance.now();
    const tableRes = await getUploadTableData(uploadId, 0, 2000);
    if (!tableRes.success || !tableRes.data?.data?.length) {
      return { success: false, error: '无法获取上传数据' };
    }
    const rawData = tableRes.data.data as Record<string, unknown>[];
    tick('getUploadTableData', t0);

    // 2. Clean column names
    t0 = performance.now();
    const { renameMeaninglessColumns } = await import('./data-utils');
    const renamedData = renameMeaninglessColumns(rawData);
    tick('rename', t0);

    // 3. Extract text context
    t0 = performance.now();
    const textContext = extractTextContext(renamedData);
    tick('extractTextContext', t0);

    // 4. Clean data
    t0 = performance.now();
    const indexedData = renamedData.map((row, i) => ({ ...row, __rawIdx: i }));
    const cleanedWithIdx = cleanDataForChart(indexedData);
    tick('cleanData', t0);
    if (!cleanedWithIdx.length) {
      return { success: false, error: '清洗后无有效数据' };
    }

    const rawIdxArray = cleanedWithIdx.map(r => r.__rawIdx as number);
    let cleanedData = cleanedWithIdx.map(({ __rawIdx, ...rest }) => rest);

    // 5. Parallel: smart-recommend (LLM) + summary; fallback to basic recommend
    t0 = performance.now();
    const [smartRecRes, summaryRes] = await Promise.all([
      smartRecommendChart(
        { data: cleanedData.slice(0, 100), maxRecommendations: 7 },
        abortController.signal
      ).catch(() => ({ success: false } as { success: false })),
      quickSummary(cleanedData, abortController.signal)
    ]);
    let recRes: Awaited<ReturnType<typeof recommendChart>>;
    if (smartRecRes.success && 'recommendations' in smartRecRes && smartRecRes.recommendations?.length) {
      // console.log(`[SmartRecommend] LLM returned ${smartRecRes.recommendations.length} recommendations (method=${(smartRecRes as { method?: string }).method})`);
      recRes = {
        success: true,
        recommendations: smartRecRes.recommendations,
        dataInfo: 'dataInfo' in smartRecRes ? smartRecRes.dataInfo : undefined
      };
    } else {
      // console.log('[SmartRecommend] LLM unavailable, falling back to basic recommend');
      recRes = await recommendChart(cleanedData, abortController.signal);
    }
    tick('recommend+summary', t0);

    const recommendations = recRes.success && recRes.recommendations?.length
      ? recRes.recommendations
      : [{ chartType: 'bar', xField: undefined, yFields: undefined, priority: 1 }];

    const dataInfo = recRes.dataInfo || { numericColumns: [], categoricalColumns: [], dateColumns: [] };

    // 6. Detect columns + build chart plan
    t0 = performance.now();
    const allKeys = Object.keys(cleanedData[0]);
    const monthlyColumns = detectMonthlyColumns(allKeys);
    const enhancedNumericCols = detectNumericColumns(cleanedData, dataInfo.numericColumns, allKeys);
    const enhancedDataInfo = { ...dataInfo, numericColumns: enhancedNumericCols };
    const labelField = detectLabelField(cleanedData, dataInfo.categoricalColumns, enhancedNumericCols, allKeys);
    cleanedData = detectAndPrefixSubTables(renamedData, cleanedData, labelField, enhancedNumericCols, rawIdxArray);
    if (labelField) {
      cleanedData = cleanedData.filter(row => {
        const label = String(row[labelField] ?? '').trim();
        return !SUBTOTAL_SUMMARY_PATTERN.test(label);
      });
    }
    const plans = buildChartPlan(cleanedData, recommendations, enhancedDataInfo, monthlyColumns, labelField, uploadId);
    tick('detect+buildPlan', t0);

    // 7. Batch build charts
    t0 = performance.now();
    let charts: Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string; anomalies?: Record<string, unknown> }> = [];
    if (plans.length > 0) {
      const batchRes = await batchBuildCharts(plans, abortController.signal);
      if (batchRes.success && batchRes.charts?.length) {
        charts = batchRes.charts
          .map((c, i) => ({
            chartType: c.chartType,
            title: plans[i]?.title || '数据分析',
            config: c.config,
            xField: plans[i]?.xField || '',
            anomalies: c.anomalies
          }))
          .filter(c => c.config);
      }

      if (charts.length === 0) {
        for (const plan of plans) {
          const res = await buildChart({
            chartType: plan.chartType,
            data: plan.data,
            xField: plan.xField,
            yFields: plan.yFields,
            title: plan.title
          });
          if (res.success && res.option) {
            charts.push({ chartType: plan.chartType, title: plan.title, config: res.option, xField: plan.xField });
          }
        }
      }
    }
    tick('batchBuildCharts', t0);

    // 7.5 Forecast trend lines for line charts
    t0 = performance.now();
    for (const chart of charts) {
      if (chart.chartType !== 'line') continue;
      const config = chart.config as any;
      const series = config?.series;
      if (!Array.isArray(series)) continue;

      const firstSeries = series.find((s: any) => s.type === 'line' && Array.isArray(s.data));
      if (!firstSeries) continue;
      const numericData = firstSeries.data.filter((v: unknown) => typeof v === 'number' && !isNaN(v as number));
      if (numericData.length < 5) continue;

      try {
        const forecastRes = await getForecast(numericData, 3);
        if (forecastRes.success && forecastRes.predictions?.length) {
          const xData = config.xAxis?.data;
          if (Array.isArray(xData)) {
            for (let i = 0; i < forecastRes.predictions.length; i++) {
              xData.push(`预测${i + 1}`);
            }
          }

          const padded = new Array(numericData.length).fill(null);
          padded[padded.length - 1] = numericData[numericData.length - 1];
          series.push({
            name: `${firstSeries.name}(预测)`,
            type: 'line',
            data: [...padded, ...forecastRes.predictions.map((v: number) => Math.round(v * 100) / 100)],
            lineStyle: { type: 'dashed', width: 2 },
            symbol: 'diamond',
            symbolSize: 6,
            itemStyle: { color: '#9ca3af' }
          });

          if (forecastRes.lowerBound?.length && forecastRes.upperBound?.length) {
            const basePad = new Array(numericData.length).fill(null);
            series.push({
              name: '置信下界',
              type: 'line',
              data: [...basePad, ...forecastRes.lowerBound.map((v: number) => Math.round(v * 100) / 100)],
              lineStyle: { opacity: 0 },
              symbol: 'none',
              silent: true,
              z: -1
            });
            series.push({
              name: '置信区间',
              type: 'line',
              data: [...basePad, ...forecastRes.upperBound.map((v: number) => Math.round(v * 100) / 100)],
              lineStyle: { opacity: 0 },
              symbol: 'none',
              areaStyle: { color: 'rgba(156,163,175,0.18)', origin: 'auto' },
              silent: true,
              z: -1
            });
          }
        }
      } catch {
        // Forecast is optional
      }
    }
    tick('forecast', t0);

    // 7.6 Pre-compute financial metrics
    t0 = performance.now();
    const financialMetrics = computeFinancialMetrics(cleanedData, monthlyColumns, labelField);
    tick('computeFinancialMetrics', t0);

    // 8. Generate AI insights
    t0 = performance.now();
    let aiAnalysis = '';
    let structuredAI: StructuredAIData | undefined;
    const insightData = cleanedData.slice(0, 100);
    const columnNames = allKeys.map(humanizeColumnName).join(', ');
    const contextParts = [`数据列: ${columnNames}`];
    if (textContext) {
      contextParts.push(textContext);
    }
    if (financialMetrics) {
      contextParts.push(formatFinancialContext(financialMetrics));
    }
    const insightRes = await generateInsights({
      data: insightData,
      analysisContext: contextParts.join('\n'),
      maxInsights: 5
    });
    if (insightRes.success && insightRes.insights?.length) {
      const metaInsight = insightRes.insights.find(i => i.type === '_meta');
      const normalInsights = insightRes.insights.filter(i => i.type !== '_meta');

      if (metaInsight) {
        const meta = metaInsight as Record<string, unknown>;
        structuredAI = {
          executiveSummary: (meta.executive_summary as string) || (meta.text as string) || '',
          riskAlerts: (meta.risk_alerts as StructuredAIData['riskAlerts']) || [],
          opportunities: (meta.opportunities as StructuredAIData['opportunities']) || [],
          sensitivityAnalysis: (meta.sensitivity_analysis as StructuredAIData['sensitivityAnalysis']) || []
        };
      }

      // Fallback: compute sensitivity analysis from financial metrics if LLM didn't return it
      if (structuredAI && (!structuredAI.sensitivityAnalysis || structuredAI.sensitivityAnalysis.length === 0) && financialMetrics) {
        structuredAI.sensitivityAnalysis = computeSensitivityFallback(financialMetrics);
      }

      const typeLabels: Record<string, string> = {
        trend: '趋势分析', anomaly: '异常检测', comparison: '对比分析',
        kpi: '关键指标', recommendation: '改进建议', forecast: '预测',
      };
      aiAnalysis = normalInsights
        .map(i => {
          const label = typeLabels[i.type] || i.type;
          let line = `${label}: ${i.text}`;
          if (i.recommendation) line += ` 建议: ${i.recommendation}`;
          return line;
        })
        .join('\n\n');
    }
    tick('generateInsights', t0);

    // 9. Assemble KPI summary
    const kpiSummary = summaryRes.success
      ? { rowCount: summaryRes.rowCount, columnCount: summaryRes.columnCount, columns: summaryRes.columns }
      : undefined;
    if (kpiSummary && enhancedNumericCols.length > 0) {
      const numericSet = new Set(enhancedNumericCols);
      kpiSummary.columns = kpiSummary.columns.map(col => {
        if (!numericSet.has(col.name) || ['int64', 'float64', 'number', 'int32', 'float32'].includes(col.type)) {
          return col;
        }
        let sum = 0;
        for (const row of cleanedData) {
          const v = row[col.name];
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          if (!isNaN(n)) sum += n;
        }
        return { ...col, type: 'float64', sum };
      });
    }

    if (import.meta.env.DEV) console.table(timings);

    const hasContent = !!(charts.length || aiAnalysis);
    const enrichResult: EnrichResult = {
      success: hasContent,
      charts: charts.length ? charts : undefined,
      kpiSummary,
      financialMetrics,
      aiAnalysis: aiAnalysis || undefined,
      structuredAI,
      chartConfig: charts.length ? charts[0].config : undefined,
      error: hasContent ? undefined : '未能生成图表或 AI 洞察',
      timings
    };

    if (hasContent) {
      saveAnalysisToCache(uploadId, getFactoryId(), enrichResult).catch(() => {});
    }

    return enrichResult;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: '分析已取消' };
    }
    console.error('enrichSheetAnalysis 失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sheet 数据增强失败'
    };
  } finally {
    activeControllers.delete(`enrich-${uploadId}`);
    enrichmentLimiter.release();
  }
}
