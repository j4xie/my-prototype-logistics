/**
 * Data Binding Slice — Data binding actions (API endpoints, refresh intervals)
 */

import type { StateCreator } from 'zustand';
import type { PageConfigState, DataBinding } from './types';
import { logger } from '../../utils/logger';

const storeLogger = logger.createContextLogger('PageConfigStore');

// ============================================
// Slice Interface
// ============================================

export interface DataBindingSlice {
  // Actions
  updateDataBindings: (pageId: string, bindings: DataBinding[]) => void;
  addDataBinding: (pageId: string, binding: DataBinding) => void;
  removeDataBinding: (pageId: string, bindingId: string) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createDataBindingSlice: StateCreator<
  PageConfigState,
  [],
  [],
  DataBindingSlice
> = (set, get) => ({
  updateDataBindings: (pageId, bindings) => {
    const { configs } = get();

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );

    if (!configKey) {
      storeLogger.warn('updateDataBindings: 配置不存在');
      return;
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) return;

    set({
      configs: {
        ...configs,
        [configKey]: {
          ...currentConfig,
          dataBindings: bindings,
          updatedAt: new Date().toISOString(),
        },
      },
      hasUnsavedChanges: true,
    });
  },

  addDataBinding: (pageId, binding) => {
    const { configs } = get();

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );

    if (!configKey) {
      storeLogger.warn('addDataBinding: 配置不存在');
      return;
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) return;

    set({
      configs: {
        ...configs,
        [configKey]: {
          ...currentConfig,
          dataBindings: [...currentConfig.dataBindings, binding],
          updatedAt: new Date().toISOString(),
        },
      },
      hasUnsavedChanges: true,
    });
  },

  removeDataBinding: (pageId, bindingId) => {
    const { configs } = get();

    const configKey = Object.keys(configs).find((key) =>
      key.endsWith(`_${pageId}`)
    );

    if (!configKey) {
      storeLogger.warn('removeDataBinding: 配置不存在');
      return;
    }

    const currentConfig = configs[configKey];
    if (!currentConfig) return;

    set({
      configs: {
        ...configs,
        [configKey]: {
          ...currentConfig,
          dataBindings: currentConfig.dataBindings.filter(
            (b) => b.bindingId !== bindingId
          ),
          updatedAt: new Date().toISOString(),
        },
      },
      hasUnsavedChanges: true,
    });
  },
});
