/**
 * History Slice — Undo/redo history stack
 */

import type { StateCreator } from 'zustand';
import type { PageConfigState, HistoryItem, PageModule } from './types';
import { cloneModules } from './defaults';

// ============================================
// Slice Interface
// ============================================

export interface HistorySlice {
  // State
  history: HistoryItem[];
  historyIndex: number;

  // Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// ============================================
// Helper
// ============================================

/**
 * 添加历史记录 — shared helper used by other slices via get()
 */
export function addToHistory(
  state: Pick<PageConfigState, 'draftLayoutConfig' | 'history' | 'historyIndex'>,
  action: HistoryItem['action'],
  description: string,
  moduleId?: string
): { history: HistoryItem[]; historyIndex: number } {
  const currentModules = state.draftLayoutConfig?.modules || [];
  const newHistory = state.history.slice(0, state.historyIndex + 1);

  newHistory.push({
    timestamp: Date.now(),
    action,
    moduleId,
    previousState: cloneModules(currentModules),
    description,
  });

  // 限制历史记录数量
  const maxHistory = 50;
  if (newHistory.length > maxHistory) {
    newHistory.shift();
  }

  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

// ============================================
// Slice Creator
// ============================================

export const createHistorySlice: StateCreator<
  PageConfigState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  // Initial state
  history: [],
  historyIndex: -1,

  undo: () => {
    const { history, historyIndex, draftLayoutConfig } = get();

    if (historyIndex < 0 || !draftLayoutConfig) return;

    const historyItem = history[historyIndex];
    if (!historyItem) return;

    set({
      draftLayoutConfig: {
        ...draftLayoutConfig,
        modules: cloneModules(historyItem.previousState),
      },
      historyIndex: historyIndex - 1,
      hasUnsavedChanges: true,
    });
  },

  redo: () => {
    const { history, historyIndex, draftLayoutConfig } = get();

    if (historyIndex >= history.length - 1 || !draftLayoutConfig) return;

    const nextIndex = historyIndex + 1;
    const nextItem = history[nextIndex + 1];

    if (nextItem) {
      set({
        draftLayoutConfig: {
          ...draftLayoutConfig,
          modules: cloneModules(nextItem.previousState),
        },
        historyIndex: nextIndex,
        hasUnsavedChanges: true,
      });
    }
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex >= 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
});
