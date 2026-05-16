/**
 * Row action types — shared by RowActionBottomSheet (RN), RowActionMenu (Vue),
 * and useRowActions hooks on both sides.
 *
 * UX-A2: 列表行末"操作 ▾" 下拉收纳次要动作 (Sprint 2 Track H).
 */

export type EntityType =
  | 'salesOrder'
  | 'purchaseOrder'
  | 'productionPlan'
  | 'processTask'
  | 'inventory'
  | 'whInbound'
  | 'whOutbound'
  | 'returnOrder'
  | 'transfer'
  | 'wastage'
  | 'sample'
  | 'sampleBom';

export interface RowAction {
  /** Stable id used as `command` for el-dropdown and key in RN list. */
  id: string;
  /** Emoji or icon name. Renderer treats string as emoji. */
  icon: string;
  /** Localized label shown to user. */
  label: string;
  /** RN-only: invoked on tap. Vue side emits `action-click` event with id instead. */
  onPress?: () => void;
  /** Render in destructive style (red text). */
  danger?: boolean;
  /** Render greyed-out, ignore taps. */
  disabled?: boolean;
  /** Shown when user taps/long-presses a disabled action. */
  disabledReason?: string;
  /** Natural-language hint exposed to AIChat as `availableActions[].aiHint`. */
  aiHint?: string;
  /** Caller is expected to show a confirm dialog before invoking onPress. */
  requiresConfirm?: boolean;
  /**
   * Price-related action. Filtered out by useRowActions when current role is
   * not in PRICE_VIEW_ROLES (mirrors backend `procurement:price:view`).
   */
  priceRelated?: boolean;
}

export interface RowActionAIContext {
  entityType: EntityType;
  entityId: string;
  factoryId?: string;
  /** Subset of actions to seed AIChat suggestions. */
  availableActions: Array<Pick<RowAction, 'id' | 'label' | 'aiHint'>>;
}

/**
 * Common action catalog. Concrete entity status-machines pick subsets from here
 * (see hooks/useRowActions.ts). New actions go here, not inline at call site.
 */
export const COMMON_ACTIONS = {
  CONVERT_TO_PRODUCTION: {
    id: 'convert-to-production',
    icon: '📋',
    label: '转生产任务',
    aiHint: '我要把这单转成生产',
  },
  CONVERT_TO_PURCHASE: {
    id: 'convert-to-purchase',
    icon: '🛒',
    label: '转采购单',
    aiHint: '我要采购这些料',
  },
  CONVERT_TO_OUTSOURCE: {
    id: 'convert-to-outsource',
    icon: '📦',
    label: '转外购',
    aiHint: '我要找外购',
  },
  RETURN: {
    id: 'return',
    icon: '↩️',
    label: '退货',
    aiHint: '我要退这单',
  },
  TRANSFER: {
    id: 'transfer',
    icon: '🔄',
    label: '调拨',
    aiHint: '我要调拨',
  },
  PRINT_PDF: {
    id: 'print-pdf',
    icon: '📄',
    label: '打印 PDF',
    aiHint: '打印这单',
  },
  COPY: {
    id: 'copy',
    icon: '📑',
    label: '复制',
    aiHint: '复制这单',
  },
  LOCK: {
    id: 'lock',
    icon: '🔒',
    label: '锁定',
    aiHint: '锁住这单不让人改',
  },
  UNLOCK: {
    id: 'unlock',
    icon: '🔓',
    label: '解锁',
    aiHint: '解锁这单',
  },
  EDIT: {
    id: 'edit',
    icon: '✏️',
    label: '编辑',
    aiHint: '修改这单',
  },
  SUBMIT: {
    id: 'submit',
    icon: '📤',
    label: '提交审核',
    aiHint: '提交审核',
  },
  APPROVE: {
    id: 'approve',
    icon: '✅',
    label: '通过',
    aiHint: '审批通过',
  },
  REJECT: {
    id: 'reject',
    icon: '❌',
    label: '驳回',
    danger: true,
    aiHint: '驳回这单',
  },
  UNDO_APPROVAL: {
    id: 'undo-approval',
    icon: '↩️',
    label: '撤销审批',
    danger: true,
    requiresConfirm: true,
    aiHint: '撤销这单的审批',
  },
  CANCEL: {
    id: 'cancel',
    icon: '🚫',
    label: '取消订单',
    danger: true,
    requiresConfirm: true,
    aiHint: '取消这单',
  },
  DELETE: {
    id: 'delete',
    icon: '🗑️',
    label: '删除',
    danger: true,
    requiresConfirm: true,
    aiHint: '删除这条',
  },
  EDIT_PRICE: {
    id: 'edit-price',
    icon: '💲',
    label: '修改单价',
    priceRelated: true,
    aiHint: '改这单的价格',
  },
  VIEW_PRICE_HISTORY: {
    id: 'view-price-history',
    icon: '📈',
    label: '价格历史',
    priceRelated: true,
    aiHint: '看这单价格历史',
  },
  VIEW_DETAIL: {
    id: 'view-detail',
    icon: '🔍',
    label: '查看详情',
    aiHint: '看这单详情',
  },
} as const satisfies Record<string, Omit<RowAction, 'onPress'>>;

export type CommonActionId = (typeof COMMON_ACTIONS)[keyof typeof COMMON_ACTIONS]['id'];
