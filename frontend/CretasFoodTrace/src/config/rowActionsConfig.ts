/**
 * Row-action status machine + RBAC config (RN side).
 *
 * Two pieces of pure data:
 *   - PRICE_VIEW_ROLES: roles allowed to see price-related actions. Mirrors
 *     web-admin/src/store/modules/permission.ts:PRICE_VIEW_ROLES which itself
 *     mirrors backend `PermissionServiceImpl.PRICE_VIEW_ROLES`. Keep all three
 *     in sync when adding/removing a role.
 *   - STATUS_ACTIONS_MAP: per-entity-type → per-status → ordered list of
 *     COMMON_ACTIONS ids that should appear on that row.
 *
 * useRowActions(...) does the actual filter + assembly.
 */

import { COMMON_ACTIONS, type EntityType } from '../types/rowActions';

/** Roles allowed to see priceRelated actions. Keep in sync with web-admin + backend. */
export const PRICE_VIEW_ROLES: ReadonlySet<string> = new Set([
  'factory_super_admin',
  'platform_admin',
  'procurement_manager',
  'finance_manager',
  'sales_manager',
  'dispatcher',
  'production_manager',
  'restaurant_manager',
  'permission_admin',
  'department_admin',
]);

type ActionId = (typeof COMMON_ACTIONS)[keyof typeof COMMON_ACTIONS]['id'];

/**
 * Per-entity status → action-id list. Status strings match the backend
 * enum names (uppercase). Unknown statuses fall back to VIEW_DETAIL only.
 *
 * The lists are intentionally short (4-10 items) so the BottomSheet/Menu
 * doesn't become a wall of buttons. Add new entries here, not at the
 * useRowActions call site.
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

/** Default action list for an unknown status — view only. */
export const DEFAULT_UNKNOWN_STATUS_ACTIONS: readonly ActionId[] = ['view-detail'];

/**
 * Lookup helper. Returns the configured action ids for (entityType, status),
 * falling back to DEFAULT_UNKNOWN_STATUS_ACTIONS for unrecognized statuses.
 */
export function getActionIdsForStatus(entityType: EntityType, status: string): readonly ActionId[] {
  const byStatus = STATUS_ACTIONS_MAP[entityType];
  if (!byStatus) return DEFAULT_UNKNOWN_STATUS_ACTIONS;
  const ids = byStatus[status];
  return ids ?? DEFAULT_UNKNOWN_STATUS_ACTIONS;
}

/** True iff the role may see price-related actions. */
export function roleCanViewPrice(role: string | null | undefined): boolean {
  if (!role) return false;
  return PRICE_VIEW_ROLES.has(role);
}
