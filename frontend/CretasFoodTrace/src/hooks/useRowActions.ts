import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { COMMON_ACTIONS, type RowAction, type EntityType } from '../types/rowActions';
import { getActionIdsForStatus, roleCanViewPrice } from '../config/rowActionsConfig';

/**
 * Row context required to compute the action list for a single row.
 *
 * `canEdit` is optional — when omitted, edit-related actions stay enabled.
 * Set it explicitly when the row is locked (lock=true) or when the user
 * lacks per-row write permission.
 */
export interface RowContext {
  status: string;
  id: string;
  canEdit?: boolean;
}

export interface ComputeRowActionsOptions {
  /** Map of action-id → handler invoked when the user picks that action. */
  handlers?: Partial<Record<string, (entity: RowContext) => void>>;
  /** Force-disable specific action ids regardless of status. id → reason string. */
  forceDisabled?: Partial<Record<string, string>>;
  /** Role used for RBAC filtering of priceRelated actions. */
  role: string | null;
}

export interface UseRowActionsOptions extends Omit<ComputeRowActionsOptions, 'role'> {
  /** Override the role lookup. Production reads from authStore.getUserRole(). */
  roleOverride?: string | null;
}

/** All COMMON_ACTIONS keyed by id, for O(1) lookup. */
const ALL_BY_ID: Record<string, Omit<RowAction, 'onPress'>> = (() => {
  const out: Record<string, Omit<RowAction, 'onPress'>> = {};
  for (const action of Object.values(COMMON_ACTIONS)) {
    out[action.id] = action;
  }
  return out;
})();

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

/**
 * Pure filter+assemble step. Exposed so unit tests can drive it without
 * needing a React render or store mock — pass `role` explicitly.
 *
 * Filtering pipeline:
 *   1. Status machine: pick the configured ids for (entityType, status).
 *   2. RBAC:           drop priceRelated when role is not in PRICE_VIEW_ROLES.
 *   3. forceDisabled:  mark id-disabled with provided reason (still rendered).
 *   4. canEdit gate:   write-class actions become disabled if entity.canEdit===false.
 *   5. Wire onPress    from `handlers[id]` (no-op when not provided).
 */
export function computeRowActions(
  entityType: EntityType,
  entity: RowContext,
  options: ComputeRowActionsOptions
): RowAction[] {
  const ids = getActionIdsForStatus(entityType, entity.status);
  const canSeePrice = roleCanViewPrice(options.role);
  const handlers = options.handlers ?? {};
  const forceDisabled = options.forceDisabled ?? {};

  const result: RowAction[] = [];
  for (const id of ids) {
    const meta = ALL_BY_ID[id];
    if (!meta) continue;

    // RBAC: hide price-related actions for roles outside PRICE_VIEW_ROLES.
    if (meta.priceRelated && !canSeePrice) continue;

    const forced = forceDisabled[id];
    const writeAction = isWriteAction(id);
    const disabledByCanEdit = entity.canEdit === false && writeAction;

    result.push({
      ...meta,
      disabled: meta.disabled || !!forced || disabledByCanEdit,
      disabledReason:
        forced ??
        (disabledByCanEdit ? '当前无编辑权限或单据已锁定' : meta.disabledReason),
      onPress: handlers[id] ? () => handlers[id]?.(entity) : undefined,
    });
  }

  return result;
}

/**
 * React hook wrapper. Reads the current role from authStore (or honors
 * `roleOverride`) and memoizes the computed action list.
 */
export function useRowActions(
  entityType: EntityType,
  entity: RowContext,
  options: UseRowActionsOptions = {}
): RowAction[] {
  const getUserRole = useAuthStore((state) => state.getUserRole);
  const role = options.roleOverride !== undefined ? options.roleOverride : getUserRole();

  return useMemo(
    () =>
      computeRowActions(entityType, entity, {
        role,
        handlers: options.handlers,
        forceDisabled: options.forceDisabled,
      }),
    [entityType, entity.status, entity.id, entity.canEdit, role, options.handlers, options.forceDisabled]
  );
}
