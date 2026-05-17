// U-NEW-1 (Sprint 4 Wave 2 Chat L) — create-mode types.
//
// 4 create modes presented to the user before record creation:
//   - normal:   existing form dialog (current default)
//   - quick:    inline single-row quick-add (1 row, shortest possible)
//   - batch:    el-table 二维表格 for multi-row batch entry
//   - bom:      BOM/recipe expansion — pre-fill items from a BomVersion
//
// Callers wire `@mode-selected` to dispatch to the corresponding flow.

export type CreateMode = 'normal' | 'quick' | 'batch' | 'bom';

export const CREATE_MODE_LABELS: Record<CreateMode, string> = {
  normal: '普通新建',
  quick: '一维快速',
  batch: '二维表格',
  bom: 'BOM 展开',
};

export const CREATE_MODE_DESCRIPTIONS: Record<CreateMode, string> = {
  normal: '完整表单 — 一次创建一个，所有字段可填',
  quick: '极简模式 — 只填必填字段，回车提交',
  batch: '批量录入 — 二维表格一次创建多条',
  bom: '基于 BOM/配方 — 选模板自动展开明细',
};

export const CREATE_MODE_ICONS: Record<CreateMode, string> = {
  normal: 'Edit',
  quick: 'Lightning',
  batch: 'Grid',
  bom: 'Histogram',
};

export const DEFAULT_CREATE_MODES: CreateMode[] = ['normal', 'quick', 'batch', 'bom'];
