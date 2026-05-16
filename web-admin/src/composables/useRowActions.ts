import { computed, type ComputedRef } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
import { COMMON_ACTIONS, type RowAction, type EntityType } from '@/types/rowActions';
import { getActionIdsForStatus, isWriteAction } from '@/config/rowActionsConfig';

export interface RowContext {
  status: string;
  id: string;
  canEdit?: boolean;
}

export interface ComputeRowActionsOptions {
  /** True iff the current role may see price-related actions. */
  canViewPrice: boolean;
  /** Force-disable specific action ids regardless of status. id → reason on hover. */
  forceDisabled?: Partial<Record<string, string>>;
}

export interface UseRowActionsOptions extends Omit<ComputeRowActionsOptions, 'canViewPrice'> {
  /** Override the canViewPrice derivation (defaults to permission store). */
  canViewPriceOverride?: boolean;
}

const ALL_BY_ID: Record<string, Omit<RowAction, never>> = (() => {
  const out: Record<string, Omit<RowAction, never>> = {};
  for (const action of Object.values(COMMON_ACTIONS)) {
    out[action.id] = action;
  }
  return out;
})();

/**
 * Pure filter+assemble step. Exposed so unit tests can drive it without a
 * Vue/Pinia render — pass `canViewPrice` explicitly.
 *
 * Filtering pipeline:
 *   1. Status machine: pick the configured ids for (entityType, status).
 *   2. RBAC:           drop priceRelated when canViewPrice is false.
 *   3. forceDisabled:  mark id-disabled with provided reason.
 *   4. canEdit gate:   write-class actions become disabled when canEdit===false.
 */
export function computeRowActions(
  entityType: EntityType,
  entity: RowContext,
  options: ComputeRowActionsOptions
): RowAction[] {
  const ids = getActionIdsForStatus(entityType, entity.status);
  const forceDisabled = options.forceDisabled ?? {};

  const result: RowAction[] = [];
  for (const id of ids) {
    const meta = ALL_BY_ID[id];
    if (!meta) continue;
    if (meta.priceRelated && !options.canViewPrice) continue;

    const forced = forceDisabled[id];
    const writeAction = isWriteAction(id);
    const disabledByCanEdit = entity.canEdit === false && writeAction;

    result.push({
      ...meta,
      disabled: meta.disabled || !!forced || disabledByCanEdit,
      disabledReason:
        forced ??
        (disabledByCanEdit ? '当前无编辑权限或单据已锁定' : meta.disabledReason),
    });
  }

  return result;
}

/**
 * Vue composable. Returns a ComputedRef so the template re-renders when the
 * row status or role changes. Caller wires @action-click on RowActionMenu
 * and dispatches by id.
 */
export function useRowActions(
  entityType: EntityType,
  entity: () => RowContext,
  options: UseRowActionsOptions = {}
): ComputedRef<RowAction[]> {
  const permissionStore = usePermissionStore();

  return computed(() => {
    const ctx = entity();
    const canViewPrice =
      options.canViewPriceOverride !== undefined
        ? options.canViewPriceOverride
        : permissionStore.canViewPrice;

    return computeRowActions(entityType, ctx, {
      canViewPrice,
      forceDisabled: options.forceDisabled,
    });
  });
}
