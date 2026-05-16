/**
 * Sprint 2 Track I — U-FOOTER-1 Sticky Footer 实时合计.
 * Shared types between RN <StickyFooterSummary>, Vue <TableFooter>, and Java
 * ListSummaryController. Field shape mirrors backend ListSummaryResponse.
 */

export type SummaryStatFormat = 'currency' | 'number' | 'percent' | 'plain';
export type SummaryTrend = 'up' | 'down' | 'flat';

export interface SummaryStat {
  /** Display label, e.g. "共" / "总金额" / "损耗率" */
  label: string;
  /** Numeric or pre-formatted string; combined with `format` for display */
  value: string | number;
  /** Formatting hint — currency adds ¥ prefix + 2-decimal grouping, percent adds % */
  format?: SummaryStatFormat;
  /** Unit suffix (e.g. "条", "%", "¥") — usually injected by formatter, but allow override */
  unit?: string;
  /**
   * If true, this stat is price-related and hidden for roles outside PRICE_VIEW_ROLES.
   * Backend should also set this flag; frontend gate is defense-in-depth.
   */
  canViewPrice?: boolean;
  /** Optional trend indicator vs prior period */
  trend?: SummaryTrend;
  /** Optional delta value paired with `trend` (e.g. +15 means +15%) */
  trendDelta?: number;
}

export interface ListSummaryPagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export interface ListSummaryResponse {
  entityType: string;
  stats: SummaryStat[];
  pagination?: ListSummaryPagination;
}

export interface ListSummaryRequest {
  filterConditions?: Record<string, unknown>;
  fields?: string[];
  dateFrom?: string; // ISO 8601
  dateTo?: string;
}

/**
 * Supported entity types for /api/mobile/{factoryId}/list-summary/{entityType}.
 * Day 2 ships 5 entities; Sprint 3+ extends.
 */
export type SupportedSummaryEntityType =
  | 'salesOrder'
  | 'purchaseOrder'
  | 'inventory'
  | 'wastage'
  | 'attendance'
  | 'returnOrder'
  | 'internalTransfer'
  | 'qualityInspection'
  | 'productionPlan'
  | 'shipment';
