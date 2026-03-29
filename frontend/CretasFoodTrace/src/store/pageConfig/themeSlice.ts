/**
 * Theme Slice — Theme actions (colors, fonts, layout themes)
 */

import type { StateCreator } from 'zustand';
import type { PageConfigState, PageThemeConfig } from './types';
import { logger } from '../../utils/logger';

const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// Slice Interface
// ============================================

export interface ThemeSlice {
  // State
  draftThemeConfig: PageThemeConfig | null;

  // Actions
  updateTheme: (pageId: string, theme: Partial<PageThemeConfig>) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createThemeSlice: StateCreator<
  PageConfigState,
  [],
  [],
  ThemeSlice
> = (set, get) => ({
  // Initial state
  draftThemeConfig: null,

  updateTheme: (pageId, theme) => {
    const { activePageId, draftThemeConfig } = get();

    if (activePageId !== pageId || !draftThemeConfig) {
      storeLogger.warn('updateTheme: 页面ID不匹配或无草稿配置');
      return;
    }

    set({
      draftThemeConfig: { ...draftThemeConfig, ...theme },
      hasUnsavedChanges: true,
    });
  },
});
