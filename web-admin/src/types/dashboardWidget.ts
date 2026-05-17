// C-WIDGET-1 (Sprint 4 Wave 2 Chat L) — dashboard widget plug system.
//
// Brief calls for 10 widget impls; this PR ships the interface + 3 impls
// (KPI / Chart / List). Remaining 7 (Alert / QuickAction / Calendar / Map /
// News / AIAssistant / CustomHtml) deferred to follow-up. The interface is
// stable enough that follow-up widgets are pure additions.

import type { Component } from 'vue';

/** Stable widget kind. New kinds get added here; old kinds never renamed. */
export type WidgetKind = 'kpi' | 'chart' | 'list' | 'alert' | 'quick-action' | 'calendar' | 'map' | 'news' | 'ai-assistant' | 'custom-html';

/** Persisted layout entry per widget instance. */
export interface DashboardWidget {
  /** UUID per instance; stable across reorder. */
  id: string;
  /** Which kind to render. Drives the registry lookup. */
  kind: WidgetKind;
  /** Position in grid (column index, row index). 12-col grid. */
  x: number;
  y: number;
  /** Span in grid units (default 4 col × 2 row). */
  w: number;
  h: number;
  /** Widget-specific config — typed by each impl. */
  config: Record<string, unknown>;
  /** User-overridable title; falls back to widget's default. */
  title?: string;
}

/** Registry entry. Each kind has 1 Vue component + a default title + factory. */
export interface WidgetRegistration {
  kind: WidgetKind;
  defaultTitle: string;
  /** Component receives `config` + `title` + emits `remove`. */
  component: Component;
  /** Initial config when a fresh widget is added. */
  defaultConfig: () => Record<string, unknown>;
  /** Default grid span (w, h). */
  defaultSize: { w: number; h: number };
  /** "Coming Sprint 5" flag — registered but disabled in palette. */
  comingSoon?: boolean;
}

const STORAGE_KEY = 'dashboard:layout';

export function loadLayout(routeName: string, fallback: DashboardWidget[] = []): DashboardWidget[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${routeName}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((x) => x && typeof x.id === 'string' && typeof x.kind === 'string') as DashboardWidget[];
  } catch {
    return fallback;
  }
}

export function saveLayout(routeName: string, widgets: DashboardWidget[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${routeName}`, JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

export function newWidget(kind: WidgetKind, registry: Map<WidgetKind, WidgetRegistration>): DashboardWidget {
  const reg = registry.get(kind);
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    x: 0,
    y: 0,
    w: reg?.defaultSize.w ?? 4,
    h: reg?.defaultSize.h ?? 2,
    config: reg ? reg.defaultConfig() : {},
    title: reg?.defaultTitle,
  };
}
