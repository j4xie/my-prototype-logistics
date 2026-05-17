// U-DESKTOP-MODAL-1 (Sprint 4 Wave 2 — followup to Chat L EnhancedDialog).
//
// Global registry of minimized desktop modals. Each DesktopModal instance
// registers/unregisters its identity here when it transitions to/from the
// minimized window state. A single <ModalDock /> component subscribes to
// the registry and renders the dock chips for *all* currently minimized
// modals — fixes EnhancedDialog's limitation of one-dock-per-modal.
//
// Why a separate registry instead of provide/inject? Multiple modals may
// open from completely unrelated parts of the route tree (e.g. one from
// a customer dialog, one from a smart-bi widget). A module-scoped
// reactive registry survives Teleport boundaries and is parent-agnostic.

import { reactive, computed, type ComputedRef } from 'vue';

export interface MinimizedModalEntry {
  /** Unique id assigned by useDesktopModal (stable for the modal's lifetime). */
  id: string;
  /** Human-friendly title shown on the chip. Must include 防呆 R2 context
   * identity (e.g. "编辑客户 — 上海六腾门 (CUS-001)") for dead-end safety. */
  title: string;
  /** Optional context entity badge (品名 / 单号 / 责任人 — 防呆 R2). */
  contextLabel?: string;
  /** Restore callback — chip click calls this to transition back to normal. */
  restore: () => void;
}

const minimized = reactive<Map<string, MinimizedModalEntry>>(new Map());

let nextId = 0;

/**
 * Generate a stable id for a modal instance. Modals call this once on mount.
 */
export function generateModalId(): string {
  nextId += 1;
  return `desktop-modal-${nextId}`;
}

/**
 * Add a minimized modal to the dock. Called by DesktopModal on minimize.
 */
export function registerMinimized(entry: MinimizedModalEntry): void {
  minimized.set(entry.id, entry);
}

/**
 * Remove a minimized modal from the dock. Called by DesktopModal on restore
 * or unmount.
 */
export function unregisterMinimized(id: string): void {
  minimized.delete(id);
}

/**
 * Subscription for <ModalDock />. Returns reactive list of all currently
 * minimized modals.
 */
export function useModalDock(): {
  entries: ComputedRef<MinimizedModalEntry[]>;
  hasEntries: ComputedRef<boolean>;
} {
  const entries = computed(() => Array.from(minimized.values()));
  const hasEntries = computed(() => minimized.size > 0);
  return { entries, hasEntries };
}
