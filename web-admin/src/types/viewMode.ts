// U-VIEW-1 (Sprint 4 Wave 2 Chat L) — list view mode types.
//
// 5 modes:
//   - table:    el-table (existing default)
//   - grid:     card grid (2-4 cards per row, responsive)
//   - kanban:   columns grouped by status
//   - timeline: el-timeline reverse-chronological  (placeholder — Sprint 5)
//   - calendar: el-calendar with rows mapped to dates (placeholder — Sprint 5)
//
// Mode persists per route in localStorage under key `view-mode:<routeName>`.

export type ViewMode = 'table' | 'grid' | 'kanban' | 'timeline' | 'calendar';

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  table: '表格',
  grid: '卡片',
  kanban: '看板',
  timeline: '时间线',
  calendar: '日历',
};

export const VIEW_MODE_ICONS: Record<ViewMode, string> = {
  table: 'Grid',
  grid: 'Files',
  kanban: 'Tickets',
  timeline: 'Clock',
  calendar: 'Calendar',
};

export const DEFAULT_VIEW_MODES: ViewMode[] = ['table', 'grid', 'kanban', 'timeline', 'calendar'];

const STORAGE_PREFIX = 'view-mode:';

export function loadViewMode(routeName: string, fallback: ViewMode = 'table'): ViewMode {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + routeName);
    if (stored && DEFAULT_VIEW_MODES.includes(stored as ViewMode)) {
      return stored as ViewMode;
    }
  } catch {
    // localStorage may be unavailable (SSR / disabled) — fall through.
  }
  return fallback;
}

export function saveViewMode(routeName: string, mode: ViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + routeName, mode);
  } catch {
    // ignore (private mode / quota exceeded)
  }
}
