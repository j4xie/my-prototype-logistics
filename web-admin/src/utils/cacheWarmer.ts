/**
 * SmartBI Cache Warmer
 *
 * Bulk pre-warms enrichment caches for all uploaded sheets.
 * Run from browser console: window.__warmCache()
 * Or trigger via admin button in SmartBI page.
 */

import { getUploadHistory, enrichSheetAnalysis, getCachedAnalysis } from '@/api/smartbi';
import type { UploadHistoryItem } from '@/api/smartbi';

export interface WarmProgress {
  total: number;
  done: number;
  cached: number;
  enriched: number;
  failed: number;
  current: string;
  startTime: number;
  aborted: boolean;
}

let abortController: AbortController | null = null;

/**
 * Pre-warm enrichment caches for all data sheets.
 * Runs serially with 2s throttle to avoid overloading Python.
 */
export async function warmAllCaches(
  onProgress?: (p: WarmProgress) => void
): Promise<WarmProgress> {
  // Allow aborting
  abortController = new AbortController();

  const response = await getUploadHistory();
  if (!response.success || !response.data?.length) {
    throw new Error('No uploads found');
  }

  const uploads = response.data as UploadHistoryItem[];
  const indexPattern = /^(索引|目录|index|目次|sheet\s*index)$/i;

  // Filter: has data rows, not index sheets
  const dataUploads = uploads.filter(u =>
    u.rowCount > 0 && !indexPattern.test(u.sheetName?.trim() || '')
  );

  const progress: WarmProgress = {
    total: dataUploads.length,
    done: 0,
    cached: 0,
    enriched: 0,
    failed: 0,
    current: '',
    startTime: Date.now(),
    aborted: false,
  };

  console.log(
    `[CacheWarmer] Starting warmup for ${dataUploads.length} data sheets ` +
    `(${uploads.length} total uploads)`
  );

  for (const upload of dataUploads) {
    if (abortController.signal.aborted) {
      progress.aborted = true;
      console.log('[CacheWarmer] Aborted by user');
      break;
    }

    progress.current = `${upload.sheetName} (id=${upload.id})`;
    onProgress?.(progress);

    try {
      // Check if already cached
      const cached = await getCachedAnalysis(upload.id);
      if (cached) {
        progress.cached++;
        progress.done++;
        continue;
      }

      // Not cached — enrich it
      console.log(
        `[CacheWarmer] ${progress.done + 1}/${progress.total} ` +
        `enriching: ${upload.sheetName} (id=${upload.id})...`
      );
      await enrichSheetAnalysis(upload.id);
      progress.enriched++;
      progress.done++;
      console.log(
        `[CacheWarmer] ${progress.done}/${progress.total} enriched: ${upload.sheetName}`
      );

      // Throttle: 2s between enrichments
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      progress.failed++;
      progress.done++;
      console.warn(
        `[CacheWarmer] ${progress.done}/${progress.total} FAILED: ${upload.sheetName}`,
        err
      );
    }

    onProgress?.(progress);

    // Progress report
    const elapsed = (Date.now() - progress.startTime) / 1000;
    const perSheet = elapsed / progress.done;
    const remaining = (progress.total - progress.done) * perSheet;
    console.log(
      `[CacheWarmer] Progress: ${progress.done}/${progress.total}, ` +
      `${progress.cached} cached, ${progress.enriched} enriched, ` +
      `${progress.failed} failed, ~${Math.ceil(remaining / 60)} min remaining`
    );
  }

  const totalTime = Math.round((Date.now() - progress.startTime) / 1000);
  console.log(
    `[CacheWarmer] Done in ${totalTime}s! ` +
    `${progress.cached} cached, ${progress.enriched} enriched, ${progress.failed} failed`
  );

  abortController = null;
  return progress;
}

/** Stop a running warmup */
export function stopWarmup() {
  if (abortController) {
    abortController.abort();
    console.log('[CacheWarmer] Stopping...');
  }
}

// Mount on window for console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__warmCache = warmAllCaches;
  (window as unknown as Record<string, unknown>).__stopWarmCache = stopWarmup;
}
