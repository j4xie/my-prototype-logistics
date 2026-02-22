/**
 * SmartBI API - Data Utilities
 * Data cleaning, detection, transposition, and subtable handling helpers.
 */
import {
  humanizeColumnName,
  SUBTOTAL_SUMMARY_PATTERN,
} from './common';

// ==================== Column Name Cleaning ====================

/**
 * Clean meaningless column names: remove Column_XX auto-generated columns, clean full-width spaces
 */
export function renameMeaninglessColumns(data: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!data.length) return [];

  const allKeys = Object.keys(data[0]);
  const meaninglessPattern = /^Column_\d+$/i;

  const keyMap = new Map<string, string>();
  const keysToKeep: string[] = [];

  const usedNames = new Set<string>();
  for (const key of allKeys) {
    if (meaninglessPattern.test(key)) continue;
    let cleaned = key.replace(/[\u3000\u00A0]/g, '').replace(/\s+/g, '').trim();
    cleaned = cleaned || key;
    if (usedNames.has(cleaned)) {
      let suffix = 2;
      while (usedNames.has(`${cleaned}_${suffix}`)) suffix++;
      cleaned = `${cleaned}_${suffix}`;
    }
    usedNames.add(cleaned);
    keyMap.set(key, cleaned);
    keysToKeep.push(key);
  }

  if (keysToKeep.length === allKeys.length && [...keyMap.entries()].every(([k, v]) => k === v)) {
    return data;
  }

  return data.map(row => {
    const cleaned: Record<string, unknown> = {};
    for (const key of keysToKeep) {
      cleaned[keyMap.get(key)!] = row[key];
    }
    return cleaned;
  });
}

// ==================== Month Column Detection ====================

/**
 * Extract month sort key from column name (YYYYMM)
 */
function extractMonthSortKey(col: string): number {
  const isoMatch = col.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return parseInt(isoMatch[1]) * 100 + parseInt(isoMatch[2]);
  const cnFullMatch = col.match(/^(\d{4})年(\d{1,2})月$/);
  if (cnFullMatch) return parseInt(cnFullMatch[1]) * 100 + parseInt(cnFullMatch[2]);
  const cnShortMatch = col.match(/^(\d{1,2})月$/);
  if (cnShortMatch) return 9999 * 100 + parseInt(cnShortMatch[1]);
  return 0;
}

/**
 * Detect monthly column names (supports YYYY-MM-DD, YYYY-MM, 1-12月, 2024年1月, etc.)
 */
export function detectMonthlyColumns(keys: string[]): string[] {
  const isoPattern = /^\d{4}-\d{2}(-\d{2})?$/;
  const cnFullPattern = /^\d{4}年\d{1,2}月$/;
  const cnShortPattern = /^\d{1,2}月$/;

  const monthCols = keys.filter(k =>
    isoPattern.test(k) || cnFullPattern.test(k) || cnShortPattern.test(k)
  );

  return monthCols.sort((a, b) => extractMonthSortKey(a) - extractMonthSortKey(b));
}

/**
 * Format month column name for display label
 */
export function formatMonthLabel(col: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(col)) return col.substring(0, 7);
  if (/^\d{4}-\d{2}$/.test(col)) return col;
  return col;
}

// ==================== Numeric Column Detection ====================

/**
 * Frontend numeric column detection (fixes Python mixed-type misclassification)
 */
export function detectNumericColumns(
  data: Record<string, unknown>[],
  pythonNumericCols: string[],
  allKeys: string[]
): string[] {
  if (!data.length || !allKeys.length) return pythonNumericCols;

  const sampleSize = Math.min(data.length, 50);
  const sample = data.slice(0, sampleSize);
  const frontendCols: string[] = [];

  for (const key of allKeys) {
    let numericCount = 0;
    let nonNullCount = 0;
    for (const row of sample) {
      const val = row[key];
      if (val == null) continue;
      nonNullCount++;
      if (typeof val === 'number' && !isNaN(val)) {
        numericCount++;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed !== '' && !isNaN(Number(trimmed))) {
          numericCount++;
        }
      }
    }
    if (nonNullCount > 0 && numericCount / nonNullCount > 0.5) {
      frontendCols.push(key);
    }
  }

  const merged = new Set([...pythonNumericCols, ...frontendCols]);
  return [...merged];
}

// ==================== Label Field Detection ====================

/**
 * Frontend label field (categorical/label column) detection
 */
export function detectLabelField(
  data: Record<string, unknown>[],
  categoricalColumns: string[],
  numericColumns: string[],
  allKeys: string[]
): string {
  if (categoricalColumns.length > 0 && categoricalColumns[0]) {
    const candidate = categoricalColumns[0];
    const numSet = new Set(numericColumns);
    if (!numSet.has(candidate)) {
      const sampleSize = Math.min(data.length, 50);
      let numericCount = 0;
      let nonNullCount = 0;
      for (const row of data.slice(0, sampleSize)) {
        const val = row[candidate];
        if (val == null) continue;
        nonNullCount++;
        if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.trim())))) {
          numericCount++;
        }
      }
      if (nonNullCount > 0 && numericCount / nonNullCount <= 0.5) {
        return candidate;
      }
    }
  }

  if (!data.length || !allKeys.length) return '';

  const numSet = new Set(numericColumns);
  const sampleSize = Math.min(data.length, 50);
  const sample = data.slice(0, sampleSize);

  const labelNamePattern = /项目|名称|类型|区域|部门|客户|产品|科目|摘要|品名|公司|分类|品牌|渠道|城市|省份|地区/;

  let bestCol = '';
  let bestScore = -Infinity;

  for (const key of allKeys) {
    if (numSet.has(key)) continue;

    let stringCount = 0;
    const uniqueVals = new Set<string>();
    for (const row of sample) {
      const val = row[key];
      if (val != null && typeof val === 'string' && val.trim() !== '') {
        stringCount++;
        uniqueVals.add(val.trim());
      }
    }
    const stringRatio = stringCount / sampleSize;
    if (stringRatio <= 0.3) continue;

    let score = stringRatio * 100;

    if (labelNamePattern.test(key)) score += 50;
    if (key === allKeys[0]) score += 10;
    if (key !== allKeys[0] && labelNamePattern.test(key)) score += 15;
    if (uniqueVals.size > 30) score -= 30;
    if (uniqueVals.size < 2) score -= 50;

    if (score > bestScore) {
      bestScore = score;
      bestCol = key;
    }
  }

  if (bestCol) return bestCol;

  const firstKey = allKeys[0];
  if (firstKey) {
    const first10 = data.slice(0, 10);
    let textCount = 0;
    for (const row of first10) {
      const val = row[firstKey];
      if (val != null && typeof val === 'string' && val.trim() !== '' && isNaN(Number(val))) {
        textCount++;
      }
    }
    if (textCount >= 5) return firstKey;
  }

  return '';
}

// ==================== Y-Field Selection ====================

/**
 * Select most meaningful yFields from wide tables
 */
export function selectSummaryYFields(numCols: string[], labelField: string, count: number): string[] {
  const candidates = numCols.filter(c => c !== labelField);
  if (candidates.length <= count) return candidates;

  const scored: Array<{ col: string; score: number }> = candidates.map((col, idx) => {
    let score = 0;
    const lower = col.toLowerCase();

    if (/合计|总计|total|sum|年度|全年|累计/i.test(col)) score += 100;

    const hasMonthSuffix = /[_-]?\d{4,6}$|[_-]?\d{1,2}月/.test(col);
    if (!hasMonthSuffix) score += 30;

    if (/revenue|profit|cost|margin|收入|利润|费用|成本|毛利|净利|销售额|营业/.test(lower)) score += 50;

    const positionFromEnd = candidates.length - 1 - idx;
    if (positionFromEnd < 3) score += 15 - positionFromEnd * 5;

    return { col, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.col);
}

// ==================== Time Series Transposition ====================

/**
 * Transpose wide table to time series: "one column per month" -> "one row per month"
 */
export function transposeForTimeSeries(
  data: Record<string, unknown>[],
  monthCols: string[],
  labelField: string
): Record<string, unknown>[] {
  if (!monthCols.length || !labelField) return [];

  const seriesRows = data.filter(row => row[labelField] != null).slice(0, 10);
  if (!seriesRows.length) return [];

  return monthCols.map(month => {
    const row: Record<string, unknown> = { '月份': formatMonthLabel(month) };
    for (const sr of seriesRows) {
      let label = String(sr[labelField]);
      if (label in row && label !== '月份') {
        let suffix = 2;
        while (`${label}(${suffix})` in row) suffix++;
        label = `${label}(${suffix})`;
      }
      const val = sr[month];
      row[label] = typeof val === 'number' ? val : (parseFloat(String(val)) || 0);
    }
    return row;
  });
}

// ==================== Data Cleaning ====================

/**
 * Clean data: remove all-null columns, replace null/NaN with 0, filter empty rows
 */
export function cleanDataForChart(data: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!data.length) return [];

  const allKeys = Object.keys(data[0]);
  const validKeys = allKeys.filter(key =>
    data.some(row => row[key] != null)
  );

  const expectedNumericCols = new Set<string>();
  for (const key of validKeys) {
    let numCount = 0;
    let total = 0;
    for (const row of data) {
      const val = row[key];
      if (val == null) continue;
      total++;
      if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.trim())))) {
        numCount++;
      }
    }
    if (total > 0 && numCount / total > 0.5) {
      expectedNumericCols.add(key);
    }
  }
  const textCols = validKeys.filter(k => !expectedNumericCols.has(k));

  return data
    .map(row => {
      const cleaned: Record<string, unknown> = {};
      for (const key of validKeys) {
        const val = row[key];
        if (val == null || (typeof val === 'number' && isNaN(val))) {
          cleaned[key] = null;
        } else {
          cleaned[key] = val;
        }
      }
      return cleaned;
    })
    .filter(row => {
      if (!Object.values(row).some(v => v != null && v !== 0 && v !== '')) return false;

      if (expectedNumericCols.size > 0) {
        let textInNumCol = 0;
        let checkedCols = 0;
        for (const col of expectedNumericCols) {
          const val = row[col];
          if (val == null) continue;
          checkedCols++;
          if (typeof val === 'string' && val.trim() !== '' && isNaN(Number(val.trim()))) {
            textInNumCol++;
          }
        }
        if (checkedCols > 0 && textInNumCol === checkedCols) return false;
      }

      if (textCols.length > 0) {
        const remarkPattern = /^(备注|说明|编制|注[：:]|目的|来源|口径|单位|本表|附注|注意)/;
        const isRemarkRow = textCols.some(col => {
          const val = row[col];
          if (typeof val !== 'string') return false;
          const trimmed = val.trim();
          return remarkPattern.test(trimmed);
        });
        if (isRemarkRow) return false;
      }

      if (textCols.length > 0 && expectedNumericCols.size > 0) {
        const hasLongText = textCols.some(col => {
          const val = row[col];
          return typeof val === 'string' && val.trim().length > 30;
        });
        const allNumNull = [...expectedNumericCols].every(col => row[col] == null || row[col] === 0);
        if (hasLongText && allNumNull) return false;
      }

      return true;
    });
}

// ==================== Text Context Extraction ====================

/**
 * Extract text context from raw data (title rows, notes, compilation notes, etc.)
 */
export function extractTextContext(rawData: Record<string, unknown>[], sheetName?: string): string {
  if (!rawData.length) return '';

  const textLines: string[] = [];
  const allKeys = Object.keys(rawData[0]);
  const firstKey = allKeys[0];

  const labelValues: string[] = [];
  for (const row of rawData) {
    const val = row[firstKey];
    if (val != null && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed && isNaN(Number(trimmed))) {
        labelValues.push(trimmed);
      }
    }
  }

  const structureLabels = labelValues.filter(v =>
    /^[一二三四五六七八九十]+[、.]/.test(v) ||
    /^[\(（]\d+[\)）]/.test(v) ||
    /^\d+[、.\s]/.test(v) ||
    /合计|小计|总计|净|毛利/.test(v)
  );
  if (structureLabels.length > 0) {
    textLines.push(`报表结构项: ${structureLabels.slice(0, 20).join('; ')}`);
  }

  const uniqueLabels = [...new Set(labelValues)].slice(0, 30);
  if (uniqueLabels.length > 0) {
    textLines.push(`数据项目: ${uniqueLabels.join(', ')}`);
  }

  const scanRows = rawData;
  for (const row of scanRows) {
    for (const key of allKeys) {
      const val = row[key];
      if (val == null || typeof val !== 'string') continue;
      const text = val.trim();
      if (!text || text.length < 4) continue;
      if (/备注|说明|编制|注[:：]|单位[:：]|口径|来源|统计|含|不含|包含/.test(text)) {
        textLines.push(text);
      }
    }
  }

  if (textLines.length === 0) return '';

  const prefix = sheetName ? `报表: ${sheetName}` : '';
  return [prefix, ...textLines].filter(Boolean).join('\n');
}

// ==================== SubTable Detection ====================

/**
 * SubTable detection and label prefixing
 */
export function detectAndPrefixSubTables(
  rawData: Record<string, unknown>[],
  cleanedData: Record<string, unknown>[],
  labelField: string,
  numericColNames: string[],
  rawIdxMap: number[]
): Record<string, unknown>[] {
  if (cleanedData.length === 0 || !labelField) return cleanedData;

  const labels = cleanedData.map(r => String(r[labelField] ?? '').trim());
  const nonSummaryLabels = labels.filter(l => !SUBTOTAL_SUMMARY_PATTERN.test(l));
  const labelCounts = new Map<string, number>();
  for (const l of nonSummaryLabels) labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
  const hasDuplicates = [...labelCounts.values()].some(c => c > 1);
  if (!hasDuplicates) return cleanedData;

  const sectionHeaderPattern = /^[一二三四五六七八九十]+[、.]/;
  const adjustmentPattern = /^[减加][：:]/;
  const sectionKeywords = ['净利', '利润', '收入', '成本', '费用', '毛利', '销售', '管理', '研发', '财务'];
  const sectionForIdx: string[] = new Array(rawData.length).fill('');
  let currentSection = '';

  for (let ri = 0; ri < rawData.length; ri++) {
    const row = rawData[ri];
    const labelVal = String(row[labelField] ?? '').trim();

    if (sectionHeaderPattern.test(labelVal)) {
      currentSection = labelVal.replace(sectionHeaderPattern, '').trim();
      sectionForIdx[ri] = currentSection;
      continue;
    }

    if (adjustmentPattern.test(labelVal)) {
      currentSection = labelVal.replace(adjustmentPattern, '').trim();
      sectionForIdx[ri] = currentSection;
      continue;
    }

    let textInNum = 0, checked = 0;
    const texts: string[] = [];
    for (const col of numericColNames) {
      const val = row[col];
      if (val == null) continue;
      checked++;
      if (typeof val === 'string' && val.trim() && isNaN(Number(val.trim()))) {
        textInNum++;
        texts.push(val.trim());
      }
    }
    if (checked > 0 && textInNum === checked && texts.length > 0) {
      for (const t of texts) {
        const kw = sectionKeywords.find(k => t.includes(k));
        if (kw) { currentSection = kw; break; }
      }
      if (!currentSection && labelVal) currentSection = labelVal;
      sectionForIdx[ri] = currentSection;
      continue;
    }

    sectionForIdx[ri] = currentSection;
  }

  const pairMap: Record<string, string> = {
    '净利': '收入', '利润': '收入', '收入': '净利',
    '成本': '收入', '费用': '收入', '毛利': '收入',
    '销售': '销售费用', '管理': '管理费用', '研发': '研发费用', '财务': '财务费用',
    '支出': '收入', '资产': '负债', '负债': '资产',
    '应收': '应付', '应付': '应收',
    '期初': '期末', '期末': '期初',
    '本期': '上期', '上期': '本期',
    '预算': '实际', '实际': '预算',
  };
  const distinctSections = [...new Set(sectionForIdx.filter(s => s !== ''))];

  if (distinctSections.length > 0) {
    const firstNamed = distinctSections[0];
    const inferredFirst = pairMap[firstNamed] || '前期';
    for (let ri = 0; ri < rawData.length; ri++) {
      if (sectionForIdx[ri] === '') sectionForIdx[ri] = inferredFirst;
      else break;
    }
  }

  const finalDistinct = [...new Set(sectionForIdx.filter(s => s !== ''))];

  if (finalDistinct.length < 2) {
    const seen = new Set<string>();
    let groupIdx = 0;
    const groupForCleanedIdx: number[] = [];
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i];
      if (SUBTOTAL_SUMMARY_PATTERN.test(l)) {
        groupForCleanedIdx.push(groupIdx);
        continue;
      }
      if (seen.has(l)) {
        groupIdx++;
        seen.clear();
      }
      seen.add(l);
      groupForCleanedIdx.push(groupIdx);
    }
    const totalGroups = groupIdx + 1;
    if (totalGroups < 2) return cleanedData;

    // console.log(`[SubTable] Fallback: ${totalGroups} sequential groups detected`);
    return cleanedData.map((row, i) => {
      const newRow = { ...row };
      const originalLabel = String(row[labelField] ?? '').trim();
      if (SUBTOTAL_SUMMARY_PATTERN.test(originalLabel)) return newRow;
      const groupLabels = ['表A', '表B', '表C', '表D', '表E'];
      const groupName = groupLabels[groupForCleanedIdx[i]] || `表${groupForCleanedIdx[i] + 1}`;
      if (groupName !== originalLabel) {
        newRow[labelField] = `${groupName}-${originalLabel}`;
      }
      return newRow;
    });
  }

  // console.log(`[SubTable] Detected ${finalDistinct.length} sections: ${finalDistinct.join(', ')}`);
  return cleanedData.map((row, i) => {
    const newRow = { ...row };
    const originalLabel = String(row[labelField] ?? '').trim();
    if (SUBTOTAL_SUMMARY_PATTERN.test(originalLabel)) return newRow;
    const ri = rawIdxMap[i];
    const section = (ri != null && sectionForIdx[ri]) ? sectionForIdx[ri] : '';
    if (section && section !== originalLabel) {
      newRow[labelField] = `${section}-${originalLabel}`;
    }
    return newRow;
  });
}
