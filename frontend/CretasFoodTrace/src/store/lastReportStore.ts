import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LastReportData {
  processCategory?: string;
  productName?: string;
  operationVolume?: string;
  hourEntry?: {
    fullTimeWorkers?: number;
    fullTimeHours?: number;
    hourlyWorkers?: number;
    hourlyHours?: number;
    dailyWorkers?: number;
    dailyHours?: number;
  };
  savedAt: string;
}

interface LastReportState {
  records: Record<string, LastReportData>;
  getLastReport: (reportType: string, factoryId: string, workerId: number) => LastReportData | null;
  saveLastReport: (reportType: string, factoryId: string, workerId: number, data: Omit<LastReportData, 'savedAt'>) => void;
  clearLastReport: (reportType: string, factoryId: string, workerId: number) => void;
}

function makeKey(reportType: string, factoryId: string, workerId: number) {
  return `${reportType}_${factoryId}_${workerId}`;
}

export const useLastReportStore = create<LastReportState>()(
  persist(
    (set, get) => ({
      records: {},

      getLastReport: (reportType, factoryId, workerId) => {
        const key = makeKey(reportType, factoryId, workerId);
        return get().records[key] ?? null;
      },

      saveLastReport: (reportType, factoryId, workerId, data) => {
        const key = makeKey(reportType, factoryId, workerId);
        set((state) => ({
          records: {
            ...state.records,
            [key]: { ...data, savedAt: new Date().toISOString() },
          },
        }));
      },

      clearLastReport: (reportType, factoryId, workerId) => {
        const key = makeKey(reportType, factoryId, workerId);
        set((state) => {
          const next = { ...state.records };
          delete next[key];
          return { records: next };
        });
      },
    }),
    {
      name: 'last-report-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
