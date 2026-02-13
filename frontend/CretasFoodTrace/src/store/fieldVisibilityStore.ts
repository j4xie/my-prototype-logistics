import { create } from 'zustand';
import { apiClient } from '../services/api/apiClient';

interface FieldVisibilityState {
  hiddenFields: Record<string, string[]>;  // entityType -> hidden field keys
  loaded: boolean;
  loading: boolean;

  loadVisibility: (factoryId: string) => Promise<void>;
  isFieldVisible: (entityType: string, fieldKey: string) => boolean;
  reset: () => void;
}

export const useFieldVisibilityStore = create<FieldVisibilityState>((set, get) => ({
  hiddenFields: {},
  loaded: false,
  loading: false,

  loadVisibility: async (factoryId: string) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await apiClient.get(`/api/mobile/${factoryId}/field-visibility`) as { success?: boolean; data?: Record<string, string[]> };
      if (res?.success) {
        set({ hiddenFields: res.data || {}, loaded: true });
      }
    } catch (error) {
      console.error('Load field visibility failed:', error);
    } finally {
      set({ loading: false });
    }
  },

  isFieldVisible: (entityType: string, fieldKey: string) => {
    const { hiddenFields } = get();
    const hidden = hiddenFields[entityType] || [];
    return !hidden.includes(fieldKey);
  },

  reset: () => set({ hiddenFields: {}, loaded: false, loading: false }),
}));
