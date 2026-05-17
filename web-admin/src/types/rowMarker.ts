// U-MARKER-1 (Sprint 4 Wave 2 Chat L) — 5-color row marker types.

export type RowMarkerColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

export const MARKER_COLORS: readonly RowMarkerColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
];

export const MARKER_COLOR_HEX: Record<RowMarkerColor, string> = {
  red: '#f56c6c',
  orange: '#e6a23c',
  yellow: '#dcb83a',
  green: '#67c23a',
  blue: '#409eff',
};

export const MARKER_COLOR_LABELS: Record<RowMarkerColor, string> = {
  red: '红色 — 紧急',
  orange: '橙色 — 警示',
  yellow: '黄色 — 关注',
  green: '绿色 — 已完成',
  blue: '蓝色 — 备注',
};

/** Whether a string is a valid marker color. */
export function isMarkerColor(v: unknown): v is RowMarkerColor {
  return typeof v === 'string' && (MARKER_COLORS as readonly string[]).includes(v);
}
