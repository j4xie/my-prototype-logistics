/**
 * Row-action status machine + RBAC config (web-admin side).
 *
 * Mirror of frontend/CretasFoodTrace/src/config/rowActionsConfig.ts. The two
 * projects don't share a package; keep both files in sync when adding new
 * statuses or rebalancing the action lists.
 */

import { COMMON_ACTIONS, type EntityType } from '@/types/rowActions';

type ActionId = (typeof COMMON_ACTIONS)[keyof typeof COMMON_ACTIONS]['id'];

/**
 * Per-entity status → action-id list. Status strings match the backend
 * enum names (uppercase). Unknown statuses fall back to VIEW_DETAIL only.
 */
export const STATUS_ACTIONS_MAP: Readonly<Record<EntityType, Readonly<Record<string, readonly ActionId[]>>>> = {
  salesOrder: {
    DRAFT: ['edit', 'submit', 'copy', 'delete', 'view-detail', 'edit-price'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-price-history', 'view-detail'],
    APPROVED: [
      'convert-to-production',
      'convert-to-purchase',
      'print-pdf',
      'undo-approval',
      'cancel',
      'view-detail',
    ],
    IN_PRODUCTION: ['view-detail', 'print-pdf'],
    SHIPPED: ['view-detail', 'print-pdf', 'return'],
    COMPLETED: ['view-detail', 'print-pdf', 'copy'],
    CANCELLED: ['view-detail', 'copy'],
  },
  purchaseOrder: {
    DRAFT: ['edit', 'submit', 'copy', 'delete', 'view-detail', 'edit-price'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-price-history', 'view-detail'],
    APPROVED: ['print-pdf', 'undo-approval', 'cancel', 'view-detail'],
    RECEIVED: ['view-detail', 'print-pdf'],
    COMPLETED: ['view-detail', 'print-pdf', 'copy'],
    CANCELLED: ['view-detail', 'copy'],
  },
  productionPlan: {
    DRAFT: ['edit', 'submit', 'copy', 'delete', 'view-detail'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-detail'],
    APPROVED: ['print-pdf', 'undo-approval', 'cancel', 'view-detail'],
    IN_PROGRESS: ['view-detail', 'print-pdf', 'lock'],
    COMPLETED: ['view-detail', 'print-pdf', 'copy'],
    CANCELLED: ['view-detail', 'copy'],
  },
  processTask: {
    PENDING: ['view-detail', 'edit'],
    IN_PROGRESS: ['view-detail', 'print-pdf', 'lock'],
    COMPLETED: ['view-detail', 'print-pdf'],
    CANCELLED: ['view-detail'],
  },
  inventory: {
    IN_STOCK: ['transfer', 'view-detail', 'view-price-history'],
    LOW_STOCK: ['transfer', 'view-detail', 'view-price-history'],
    OUT_OF_STOCK: ['view-detail', 'view-price-history'],
    EXPIRED: ['view-detail', 'view-price-history'],
  },
  whInbound: {
    PENDING: ['edit', 'submit', 'delete', 'view-detail'],
    RECEIVED: ['print-pdf', 'view-detail'],
    COMPLETED: ['print-pdf', 'view-detail'],
  },
  whOutbound: {
    PENDING: ['edit', 'submit', 'delete', 'view-detail'],
    SHIPPED: ['print-pdf', 'view-detail', 'return'],
    COMPLETED: ['print-pdf', 'view-detail'],
  },
  returnOrder: {
    DRAFT: ['edit', 'submit', 'delete', 'view-detail'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-detail'],
    APPROVED: ['print-pdf', 'view-detail'],
    COMPLETED: ['view-detail'],
  },
  transfer: {
    DRAFT: ['edit', 'submit', 'delete', 'view-detail'],
    IN_TRANSIT: ['view-detail', 'print-pdf'],
    COMPLETED: ['view-detail', 'print-pdf'],
  },
  wastage: {
    DRAFT: ['edit', 'submit', 'delete', 'view-detail'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-detail'],
    APPROVED: ['view-detail', 'print-pdf'],
  },
  sample: {
    DRAFT: ['edit', 'submit', 'copy', 'delete', 'view-detail'],
    PENDING_APPROVAL: ['approve', 'reject', 'view-detail'],
    APPROVED: ['copy', 'view-detail'],
  },
  sampleBom: {
    DRAFT: ['edit', 'submit', 'copy', 'delete', 'view-detail'],
    APPROVED: ['copy', 'view-detail', 'print-pdf'],
  },
};

export const DEFAULT_UNKNOWN_STATUS_ACTIONS: readonly ActionId[] = ['view-detail'];

export function getActionIdsForStatus(entityType: EntityType, status: string): readonly ActionId[] {
  const byStatus = STATUS_ACTIONS_MAP[entityType];
  if (!byStatus) return DEFAULT_UNKNOWN_STATUS_ACTIONS;
  const ids = byStatus[status];
  return ids ?? DEFAULT_UNKNOWN_STATUS_ACTIONS;
}

/** Action ids that mutate the entity. Used to honor `canEdit=false`. */
export const WRITE_ACTION_IDS: ReadonlySet<string> = new Set([
  'edit',
  'submit',
  'approve',
  'reject',
  'undo-approval',
  'cancel',
  'delete',
  'edit-price',
  'lock',
  'unlock',
  'convert-to-production',
  'convert-to-purchase',
  'convert-to-outsource',
  'transfer',
  'return',
]);

export function isWriteAction(id: string): boolean {
  return WRITE_ACTION_IDS.has(id);
}
