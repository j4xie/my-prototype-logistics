import { useCallback, useEffect, useRef, useState } from 'react';
import { listSummaryApiClient } from '../services/api/listSummaryApiClient';
import type {
  ListSummaryRequest,
  ListSummaryResponse,
  SupportedSummaryEntityType,
} from '../types/listSummary';

interface UseListSummaryResult {
  summary: ListSummaryResponse | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Sprint 2 Track I — fetches list-summary stats for the bottom sticky footer.
 *
 * Refetches whenever `request` reference changes; caller should memoize.
 * Optionally pass `factoryId` for platform admins viewing cross-factory data.
 */
export function useListSummary(
  entityType: SupportedSummaryEntityType | string,
  request: ListSummaryRequest = {},
  factoryId?: string,
): UseListSummaryResult {
  const [summary, setSummary] = useState<ListSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqRef = useRef(request);
  reqRef.current = request;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const envelope = await listSummaryApiClient.getSummary(entityType, reqRef.current, factoryId);
      if (!envelope.success) {
        throw new Error(envelope.message ?? '获取合计失败');
      }
      setSummary(envelope.data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, factoryId]);

  useEffect(() => {
    refresh();
  }, [refresh, request]);

  return { summary, loading, error, refresh };
}
