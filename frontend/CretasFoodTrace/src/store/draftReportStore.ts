import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DraftReport {
  id: string;
  batchId?: number;
  batchNumber?: string;
  productName?: string;
  outputQuantity: number;
  goodQuantity: number;
  defectQuantity: number;
  notes: string;
  createdAt: string;
  factoryId: string;
}

interface DraftReportState {
  drafts: DraftReport[];
  addDraft: (draft: Omit<DraftReport, 'id' | 'createdAt'>) => void;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
  getDraftsByFactory: (factoryId: string) => DraftReport[];
}

export const useDraftReportStore = create<DraftReportState>()(
  persist(
    (set, get) => ({
      drafts: [],

      addDraft: (draft) => {
        const newDraft: DraftReport = {
          ...draft,
          id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ drafts: [...state.drafts, newDraft] }));
      },

      removeDraft: (id) => {
        set(state => ({ drafts: state.drafts.filter(d => d.id !== id) }));
      },

      clearDrafts: () => set({ drafts: [] }),

      getDraftsByFactory: (factoryId) => {
        return get().drafts.filter(d => d.factoryId === factoryId);
      },
    }),
    {
      name: 'draft-reports-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
