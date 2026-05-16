/**
 * Sprint 2 Track I — U-FOOTER-1 list summary API.
 * Backend: POST /api/mobile/{factoryId}/list-summary/{entityType}
 */
import { post } from './request'
import type {
  ListSummaryRequest,
  ListSummaryResponse,
  SupportedSummaryEntityType,
} from '@/types/listSummary'

export function fetchListSummary(
  factoryId: string,
  entityType: SupportedSummaryEntityType | string,
  request: ListSummaryRequest = {},
) {
  return post<ListSummaryResponse>(
    `/${factoryId}/list-summary/${entityType}`,
    request,
  )
}
