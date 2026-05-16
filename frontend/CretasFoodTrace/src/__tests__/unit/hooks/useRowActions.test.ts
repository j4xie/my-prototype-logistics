/**
 * Unit tests for `computeRowActions` (the pure core of useRowActions).
 *
 * The React hook layer wraps this function with useMemo + useAuthStore;
 * tests target the pure compute step so no React or store mock is needed.
 *
 * Coverage matrix (Brief Day 3 DoD: 50 状态×角色组合):
 *   - 10 (entityType, status) pairs × 5 roles = 50 cases for RBAC table
 *   - + targeted cases for forceDisabled, canEdit, write-action gating,
 *     handler wiring, and unknown status fallback.
 */

import {
  computeRowActions,
  isWriteAction,
  WRITE_ACTION_IDS,
  type RowContext,
} from '../../../hooks/useRowActions';
import type { EntityType } from '../../../types/rowActions';

const ROLES_WITH_PRICE = [
  'factory_super_admin',
  'procurement_manager',
  'sales_manager',
] as const;
const ROLES_WITHOUT_PRICE = ['warehouse_manager', 'quality_inspector'] as const;
const ALL_ROLES = [...ROLES_WITH_PRICE, ...ROLES_WITHOUT_PRICE] as const;

const STATUS_PAIRS: Array<{ entityType: EntityType; status: string; expectIds: readonly string[] }> = [
  {
    entityType: 'salesOrder',
    status: 'DRAFT',
    expectIds: ['edit', 'submit', 'copy', 'delete', 'view-detail', 'edit-price'],
  },
  {
    entityType: 'salesOrder',
    status: 'APPROVED',
    expectIds: [
      'convert-to-production',
      'convert-to-purchase',
      'print-pdf',
      'undo-approval',
      'cancel',
      'view-detail',
    ],
  },
  {
    entityType: 'purchaseOrder',
    status: 'DRAFT',
    expectIds: ['edit', 'submit', 'copy', 'delete', 'view-detail', 'edit-price'],
  },
  {
    entityType: 'purchaseOrder',
    status: 'APPROVED',
    expectIds: ['print-pdf', 'undo-approval', 'cancel', 'view-detail'],
  },
  {
    entityType: 'productionPlan',
    status: 'IN_PROGRESS',
    expectIds: ['view-detail', 'print-pdf', 'lock'],
  },
  {
    entityType: 'inventory',
    status: 'IN_STOCK',
    expectIds: ['transfer', 'view-detail', 'view-price-history'],
  },
  {
    entityType: 'whInbound',
    status: 'PENDING',
    expectIds: ['edit', 'submit', 'delete', 'view-detail'],
  },
  {
    entityType: 'whOutbound',
    status: 'SHIPPED',
    expectIds: ['print-pdf', 'view-detail', 'return'],
  },
  {
    entityType: 'returnOrder',
    status: 'PENDING_APPROVAL',
    expectIds: ['approve', 'reject', 'view-detail'],
  },
  {
    entityType: 'wastage',
    status: 'DRAFT',
    expectIds: ['edit', 'submit', 'delete', 'view-detail'],
  },
];

describe('computeRowActions', () => {
  describe('50-combo RBAC matrix (10 status × 5 roles)', () => {
    for (const pair of STATUS_PAIRS) {
      for (const role of ALL_ROLES) {
        const canViewPrice = (ROLES_WITH_PRICE as readonly string[]).includes(role);
        const expected = canViewPrice
          ? pair.expectIds
          : pair.expectIds.filter((id) => !id.startsWith('view-price') && id !== 'edit-price');

        it(`${pair.entityType} status=${pair.status} role=${role} → ${expected.length} actions`, () => {
          const actions = computeRowActions(
            pair.entityType,
            { status: pair.status, id: 'X' },
            { role }
          );
          expect(actions.map((a) => a.id)).toEqual(expected);
        });
      }
    }
  });

  describe('RBAC priceRelated filter', () => {
    it('hides edit-price for warehouse_manager (sales DRAFT)', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: 'warehouse_manager' }
      );
      expect(actions.find((a) => a.id === 'edit-price')).toBeUndefined();
    });

    it('shows edit-price for sales_manager (sales DRAFT)', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: 'sales_manager' }
      );
      expect(actions.find((a) => a.id === 'edit-price')).toBeDefined();
    });

    it('hides view-price-history for warehouse_manager (sales PENDING_APPROVAL)', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'PENDING_APPROVAL', id: '1' },
        { role: 'warehouse_manager' }
      );
      expect(actions.find((a) => a.id === 'view-price-history')).toBeUndefined();
    });

    it('null role → no price actions visible', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: null }
      );
      expect(actions.find((a) => a.priceRelated)).toBeUndefined();
    });
  });

  describe('canEdit gate', () => {
    it('canEdit=false disables write actions but keeps them rendered', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1', canEdit: false },
        { role: 'sales_manager' }
      );
      const edit = actions.find((a) => a.id === 'edit');
      expect(edit?.disabled).toBe(true);
      expect(edit?.disabledReason).toMatch(/编辑权限|锁定/);
      const view = actions.find((a) => a.id === 'view-detail');
      expect(view?.disabled).toBeFalsy();
    });

    it('canEdit=true (or omitted) leaves write actions enabled', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: 'sales_manager' }
      );
      const edit = actions.find((a) => a.id === 'edit');
      expect(edit?.disabled).toBeFalsy();
    });
  });

  describe('forceDisabled', () => {
    it('id-disabled with custom reason overrides default', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: 'sales_manager', forceDisabled: { delete: '关联了其他单据' } }
      );
      const del = actions.find((a) => a.id === 'delete');
      expect(del?.disabled).toBe(true);
      expect(del?.disabledReason).toBe('关联了其他单据');
    });
  });

  describe('handler wiring', () => {
    it('handlers map → onPress invoked with entity', () => {
      const onEdit = jest.fn();
      const ctx: RowContext = { status: 'DRAFT', id: 'SO-001' };
      const actions = computeRowActions('salesOrder', ctx, {
        role: 'sales_manager',
        handlers: { edit: onEdit },
      });
      const edit = actions.find((a) => a.id === 'edit');
      edit?.onPress?.();
      expect(onEdit).toHaveBeenCalledWith(ctx);
    });

    it('absent handler → onPress is undefined', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'DRAFT', id: '1' },
        { role: 'sales_manager' }
      );
      const edit = actions.find((a) => a.id === 'edit');
      expect(edit?.onPress).toBeUndefined();
    });
  });

  describe('unknown status fallback', () => {
    it('unknown status → only view-detail', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'WAT_THIS_NEW_STATUS', id: '1' },
        { role: 'sales_manager' }
      );
      expect(actions.map((a) => a.id)).toEqual(['view-detail']);
    });
  });

  describe('action metadata preservation', () => {
    it('danger flag preserved on cancel', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'APPROVED', id: '1' },
        { role: 'sales_manager' }
      );
      const cancel = actions.find((a) => a.id === 'cancel');
      expect(cancel?.danger).toBe(true);
      expect(cancel?.requiresConfirm).toBe(true);
    });

    it('aiHint preserved', () => {
      const actions = computeRowActions(
        'salesOrder',
        { status: 'APPROVED', id: '1' },
        { role: 'sales_manager' }
      );
      const convert = actions.find((a) => a.id === 'convert-to-production');
      expect(convert?.aiHint).toBe('我要把这单转成生产');
    });
  });
});

describe('isWriteAction', () => {
  it('write ids are recognized', () => {
    expect(isWriteAction('edit')).toBe(true);
    expect(isWriteAction('cancel')).toBe(true);
    expect(isWriteAction('convert-to-production')).toBe(true);
  });

  it('read ids are not write', () => {
    expect(isWriteAction('view-detail')).toBe(false);
    expect(isWriteAction('view-price-history')).toBe(false);
    expect(isWriteAction('print-pdf')).toBe(false);
    expect(isWriteAction('copy')).toBe(false);
  });

  it('WRITE_ACTION_IDS export covers expected mutators', () => {
    expect(WRITE_ACTION_IDS.has('approve')).toBe(true);
    expect(WRITE_ACTION_IDS.has('reject')).toBe(true);
    expect(WRITE_ACTION_IDS.has('delete')).toBe(true);
  });
});
