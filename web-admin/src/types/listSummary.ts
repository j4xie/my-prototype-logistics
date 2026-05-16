/**
 * Sprint 2 Track I — U-FOOTER-1 Sticky Footer 实时合计.
 * Shared types between Vue <TableFooter>, RN <StickyFooterSummary>, and Java
 * ListSummaryController. Field shape mirrors backend ListSummaryResponse +
 * RN frontend/CretasFoodTrace/src/types/listSummary.ts.
 */

export type SummaryStatFormat = 'currency' | 'number' | 'percent' | 'plain'
export type SummaryTrend = 'up' | 'down' | 'flat'

export interface SummaryStat {
  label: string
  value: string | number
  format?: SummaryStatFormat
  unit?: string
  canViewPrice?: boolean
  trend?: SummaryTrend
  trendDelta?: number
}

export interface ListSummaryPagination {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
}

export interface ListSummaryResponse {
  entityType: string
  stats: SummaryStat[]
  pagination?: ListSummaryPagination
}

export interface ListSummaryRequest {
  filterConditions?: Record<string, unknown>
  fields?: string[]
  dateFrom?: string
  dateTo?: string
}

export type SupportedSummaryEntityType =
  | 'salesOrder'
  | 'purchaseOrder'
  | 'inventory'
  | 'wastage'
  | 'attendance'
