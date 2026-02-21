/**
 * Demo 数据缓存 — SmartBI 分析结果缓存到 localStorage
 *
 * 投资人演示场景: 首次上传 Excel 需 30-40s 解析，缓存后再次访问 < 1s 渲染
 * 缓存容量限制 5MB，采用 LRU 淘汰策略
 *
 * v3: 按 factoryId 隔离缓存，防止跨工厂数据泄漏
 */

import { getFactoryId } from '@/api/smartbi/common';

const CACHE_VERSION = 3; // v3: factory-scoped cache keys
const MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Get factory-scoped cache key prefix */
function getCacheKeyPrefix(): string {
  try {
    const fid = getFactoryId();
    return `smartbi-demo-cache-v${CACHE_VERSION}-${fid}`;
  } catch {
    return `smartbi-demo-cache-v${CACHE_VERSION}-unknown`;
  }
}

function getCacheKey(): string {
  return getCacheKeyPrefix();
}

function getCacheIndexKey(): string {
  return `${getCacheKeyPrefix()}-index`;
}

/** 缓存条目的元数据 */
interface CacheEntry {
  uploadId: number;
  fileName: string;
  savedAt: string;       // ISO timestamp
  lastAccessedAt: string;
  sizeBytes: number;
}

/** 缓存的完整数据结构 (与 SmartBIAnalysis.vue 中的 SheetResult 对齐) */
export interface DemoCacheData {
  uploadBatch: {
    fileName: string;
    uploadTime: string;
    sheetCount: number;
    totalRows: number;
  };
  sheets: Array<{
    sheetIndex: number;
    sheetName: string;
    success: boolean;
    message: string;
    detectedDataType?: string;
    savedRows?: number;
    uploadId?: number;
    tableType?: string;
    flowResult?: {
      recommendedChartType?: string;
      chartConfig?: any;
      aiAnalysis?: string;
      charts?: Array<{ chartType: string; title: string; config: Record<string, unknown> }>;
      kpiSummary?: { rowCount: number; columnCount: number; columns: any[] };
      structuredAI?: any;
      financialMetrics?: any;
    };
  }>;
  uploadResult: {
    totalSheets: number;
    successCount: number;
    failedCount: number;
    requiresConfirmationCount: number;
    totalSavedRows: number;
    message: string;
  };
  indexMetadata?: {
    hasIndex: boolean;
    indexSheetIndex?: number;
    sheetMappings: Array<{ index: number; reportName: string; sheetName: string; description?: string }>;
  };
}

/** 读取缓存索引 */
function getCacheIndex(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(getCacheIndexKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 保存缓存索引 */
function saveCacheIndex(index: CacheEntry[]) {
  localStorage.setItem(getCacheIndexKey(), JSON.stringify(index));
}

/** 计算字符串占用的字节大小 (UTF-16 估算) */
function estimateSize(str: string): number {
  return new Blob([str]).size;
}

/** 获取当前缓存总大小 */
function getTotalCacheSize(index: CacheEntry[]): number {
  return index.reduce((sum, entry) => sum + entry.sizeBytes, 0);
}

/** LRU 淘汰: 删除最久未访问的缓存直到腾出足够空间 */
function evictUntilFits(index: CacheEntry[], requiredBytes: number): CacheEntry[] {
  let sorted = [...index].sort(
    (a, b) => new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime()
  );
  let totalSize = getTotalCacheSize(sorted);

  while (totalSize + requiredBytes > MAX_CACHE_SIZE_BYTES && sorted.length > 0) {
    const oldest = sorted.shift()!;
    localStorage.removeItem(`${getCacheKey()}-${oldest.uploadId}`);
    totalSize -= oldest.sizeBytes;
  }

  return sorted;
}

/**
 * 保存 demo 缓存
 * @param uploadId  上传批次的第一个 uploadId (作为唯一标识)
 * @param data      完整的分析结果数据
 */
export function saveDemoCache(uploadId: number, data: DemoCacheData): boolean {
  try {
    const json = JSON.stringify(data);
    const sizeBytes = estimateSize(json);

    // 单条超过限制，不缓存
    if (sizeBytes > MAX_CACHE_SIZE_BYTES) {
      console.warn(`[DemoCache] 数据太大 (${(sizeBytes / 1024 / 1024).toFixed(1)}MB), 跳过缓存`);
      return false;
    }

    let index = getCacheIndex();

    // 移除同 uploadId 的旧缓存
    const existingIdx = index.findIndex(e => e.uploadId === uploadId);
    if (existingIdx >= 0) {
      localStorage.removeItem(`${getCacheKey()}-${uploadId}`);
      index.splice(existingIdx, 1);
    }

    // LRU 淘汰
    index = evictUntilFits(index, sizeBytes);

    // 写入数据
    const now = new Date().toISOString();
    localStorage.setItem(`${getCacheKey()}-${uploadId}`, json);
    index.push({
      uploadId,
      fileName: data.uploadBatch.fileName,
      savedAt: now,
      lastAccessedAt: now,
      sizeBytes,
    });
    saveCacheIndex(index);

    console.log(`[DemoCache] 已缓存 uploadId=${uploadId}, 大小=${(sizeBytes / 1024).toFixed(0)}KB`);
    return true;
  } catch (e) {
    // localStorage 配额不足等异常
    console.warn('[DemoCache] 保存失败:', e);
    return false;
  }
}

/**
 * 加载 demo 缓存 (自动返回最近访问的批次)
 * @returns 缓存数据 or null
 */
export function loadDemoCache(): (DemoCacheData & { uploadId: number }) | null {
  try {
    const index = getCacheIndex();
    if (index.length === 0) return null;

    // 取最近保存的 (demo 场景: 总是展示最新一次)
    const sorted = [...index].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    const latest = sorted[0];

    const raw = localStorage.getItem(`${getCacheKey()}-${latest.uploadId}`);
    if (!raw) {
      // 索引存在但数据丢失，清理
      const cleaned = index.filter(e => e.uploadId !== latest.uploadId);
      saveCacheIndex(cleaned);
      return null;
    }

    // 更新访问时间
    latest.lastAccessedAt = new Date().toISOString();
    saveCacheIndex(index);

    const data = JSON.parse(raw) as DemoCacheData;
    return { ...data, uploadId: latest.uploadId };
  } catch {
    return null;
  }
}

/**
 * 清除所有 demo 缓存
 */
export function clearDemoCache() {
  const index = getCacheIndex();
  for (const entry of index) {
    localStorage.removeItem(`${getCacheKey()}-${entry.uploadId}`);
  }
  localStorage.removeItem(getCacheIndexKey());
}

/**
 * 判断是否存在有效缓存
 */
export function hasDemoCache(): boolean {
  const index = getCacheIndex();
  return index.length > 0;
}

/**
 * 获取缓存信息摘要 (用于 UI 提示)
 */
/** 清除旧版本缓存 (版本升级时自动调用) */
function cleanupOldCaches() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('smartbi-demo-cache') && !key.includes(`v${CACHE_VERSION}`)) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* ignore */ }
}

// Auto-cleanup old caches on module load
cleanupOldCaches();

export function getDemoCacheInfo(): { fileName: string; savedAt: string; sheetCount: number } | null {
  const index = getCacheIndex();
  if (index.length === 0) return null;

  const sorted = [...index].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  const latest = sorted[0];

  const raw = localStorage.getItem(`${getCacheKey()}-${latest.uploadId}`);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as DemoCacheData;
    return {
      fileName: data.uploadBatch.fileName,
      savedAt: latest.savedAt,
      sheetCount: data.uploadBatch.sheetCount,
    };
  } catch {
    return null;
  }
}
