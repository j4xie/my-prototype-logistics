// U-ICON-1 (Sprint 4 Wave 2 Chat L) — 7 inline row icons.
//
// Per brief, fixed 7-icon palette shown on row hover:
//   复制 (copy) / 标记 (mark) / 锁定 (lock) / 转发 (forward) / 打印 (print-pdf) /
//   删除 (delete) / 审计 (audit)
//
// 4 ids reuse existing COMMON_ACTIONS so RBAC/status filters compose cleanly:
//   copy / lock / print-pdf / delete  → ids in COMMON_ACTIONS
// 3 ids are inline-specific (no COMMON_ACTIONS equivalent yet):
//   mark / forward / audit            → handled in parent click handler
//
// The component's `computeInlineIconStates()` returns an array of 7 entries
// preserving order, each marked enabled/disabled per existing useRowActions
// catalog (for known ids) or always-enabled (for inline-only ids).

import type { RowAction, EntityType } from './rowActions';

export type InlineIconId = 'copy' | 'mark' | 'lock' | 'forward' | 'print-pdf' | 'delete' | 'audit';

export interface InlineIconDef {
  id: InlineIconId;
  icon: string; // emoji
  label: string;
  /** When true, parent owns the click handler; component doesn't try to map to COMMON_ACTIONS. */
  inlineOnly: boolean;
  danger?: boolean;
  requiresConfirm?: boolean;
}

export const INLINE_ICONS: readonly InlineIconDef[] = [
  { id: 'copy', icon: '📑', label: '复制', inlineOnly: false },
  { id: 'mark', icon: '🏷️', label: '标记', inlineOnly: true },
  { id: 'lock', icon: '🔒', label: '锁定', inlineOnly: false },
  { id: 'forward', icon: '↗️', label: '转发', inlineOnly: true },
  { id: 'print-pdf', icon: '📄', label: '打印', inlineOnly: false },
  { id: 'delete', icon: '🗑️', label: '删除', inlineOnly: false, danger: true, requiresConfirm: true },
  { id: 'audit', icon: '🔎', label: '审计', inlineOnly: true },
];

export interface InlineIconState {
  def: InlineIconDef;
  enabled: boolean;
  /** Reason shown on tooltip when disabled. */
  disabledReason?: string;
}

/**
 * Compose 7 inline-icon states from the existing computed RowAction[] (output of
 * useRowActions.computeRowActions). The 3 inline-only ids (mark/forward/audit)
 * are always enabled (parent decides their semantics).
 *
 * Disabled rule for known ids: id is NOT in the rowActions array OR is flagged
 * disabled in the rowActions entry.
 */
export function computeInlineIconStates(
  rowActions: RowAction[],
  // Reserved for future per-entity overrides (e.g. salesOrder forwarding 不可用).
  _entityType?: EntityType
): InlineIconState[] {
  const byId = new Map(rowActions.map((a) => [a.id, a]));
  return INLINE_ICONS.map((def) => {
    if (def.inlineOnly) {
      return { def, enabled: true };
    }
    const match = byId.get(def.id);
    if (!match) {
      return {
        def,
        enabled: false,
        disabledReason: '当前状态不允许此操作',
      };
    }
    return {
      def,
      enabled: !match.disabled,
      disabledReason: match.disabled ? match.disabledReason : undefined,
    };
  });
}
