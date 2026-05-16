import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type {
  ListSummaryRequest,
  ListSummaryResponse,
  SupportedSummaryEntityType,
} from '../../types/listSummary';

/**
 * Sprint 2 Track I — U-FOOTER-1.
 * POST /api/mobile/{factoryId}/list-summary/{entityType}
 * Day 2 ships server-side: ListSummaryController + 5 entity implementations
 * (salesOrder / purchaseOrder / inventory / wastage / attendance).
 *
 * Returns the unified envelope `{success, data, message}` per project convention
 * (see returnOrderApiClient for the same pattern). Hooks/callers extract `.data`.
 */
class ListSummaryApiClient {
  private getPath(entityType: SupportedSummaryEntityType | string, factoryId?: string): string {
    const fid = requireFactoryId(factoryId);
    return `/api/mobile/${fid}/list-summary/${entityType}`;
  }

  async getSummary(
    entityType: SupportedSummaryEntityType | string,
    request: ListSummaryRequest = {},
    factoryId?: string,
  ): Promise<{ success: boolean; data: ListSummaryResponse; message?: string }> {
    return apiClient.post(this.getPath(entityType, factoryId), request);
  }
}

export const listSummaryApiClient = new ListSummaryApiClient();
