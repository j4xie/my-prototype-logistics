// @ts-nocheck
import { useLastReportStore } from '../../../store/lastReportStore';

beforeEach(() => {
  useLastReportStore.setState({ records: {} });
});

describe('useLastReportStore', () => {
  describe('saveLastReport', () => {
    it('saves data with composite key type_factoryId_workerId', () => {
      const { saveLastReport, records } = useLastReportStore.getState();
      saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      const state = useLastReportStore.getState();
      expect(state.records['daily_F001_W001']).toBeDefined();
      expect(state.records['daily_F001_W001'].hours).toBe(8);
    });

    it('auto-injects savedAt as ISO string', () => {
      const before = new Date().toISOString();
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      const after = new Date().toISOString();
      const saved = useLastReportStore.getState().records['daily_F001_W001'];
      expect(saved.savedAt).toBeDefined();
      expect(typeof saved.savedAt).toBe('string');
      expect(saved.savedAt >= before).toBe(true);
      expect(saved.savedAt <= after).toBe(true);
    });

    it('saves with nested optional fields like hourEntry', () => {
      useLastReportStore.getState().saveLastReport('hourly', 'F001', 'W002', {
        hourEntry: { startTime: '08:00', endTime: '17:00', breakMinutes: 60 },
      });
      const saved = useLastReportStore.getState().records['hourly_F001_W002'];
      expect(saved.hourEntry).toEqual({ startTime: '08:00', endTime: '17:00', breakMinutes: 60 });
    });

    it('overwrites existing data for the same key', () => {
      const store = useLastReportStore.getState();
      store.saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 10 });
      const saved = useLastReportStore.getState().records['daily_F001_W001'];
      expect(saved.hours).toBe(10);
    });

    it('does not affect other keys when saving', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W002', { hours: 6 });
      const state = useLastReportStore.getState();
      expect(state.records['daily_F001_W001'].hours).toBe(8);
      expect(state.records['daily_F001_W002'].hours).toBe(6);
    });

    it('saves empty data object', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', {});
      const saved = useLastReportStore.getState().records['daily_F001_W001'];
      expect(saved).toBeDefined();
      expect(saved.savedAt).toBeDefined();
    });
  });

  describe('getLastReport', () => {
    it('returns data for existing key', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      const result = useLastReportStore.getState().getLastReport('daily', 'F001', 'W001');
      expect(result).toBeDefined();
      expect(result!.hours).toBe(8);
    });

    it('returns null for non-existing key', () => {
      const result = useLastReportStore.getState().getLastReport('daily', 'F001', 'W999');
      expect(result).toBeNull();
    });

    it('returns null when records are empty', () => {
      const result = useLastReportStore.getState().getLastReport('daily', 'F001', 'W001');
      expect(result).toBeNull();
    });

    it('different types are isolated', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('weekly', 'F001', 'W001', { hours: 40 });
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W001')!.hours).toBe(8);
      expect(useLastReportStore.getState().getLastReport('weekly', 'F001', 'W001')!.hours).toBe(40);
    });

    it('different factoryIds are isolated', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('daily', 'F002', 'W001', { hours: 12 });
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W001')!.hours).toBe(8);
      expect(useLastReportStore.getState().getLastReport('daily', 'F002', 'W001')!.hours).toBe(12);
    });

    it('different workerIds are isolated', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W002', { hours: 6 });
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W001')!.hours).toBe(8);
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W002')!.hours).toBe(6);
    });
  });

  describe('clearLastReport', () => {
    it('clears existing record', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().clearLastReport('daily', 'F001', 'W001');
      const result = useLastReportStore.getState().getLastReport('daily', 'F001', 'W001');
      expect(result).toBeNull();
    });

    it('does not throw for non-existing key', () => {
      expect(() => {
        useLastReportStore.getState().clearLastReport('daily', 'F001', 'W999');
      }).not.toThrow();
    });

    it('does not affect other keys', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W002', { hours: 6 });
      useLastReportStore.getState().clearLastReport('daily', 'F001', 'W001');
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W001')).toBeNull();
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W002')!.hours).toBe(6);
    });
  });

  describe('integration', () => {
    it('save then get returns same data', () => {
      const data = { hours: 8, notes: 'test note', items: [1, 2, 3] };
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', data);
      const result = useLastReportStore.getState().getLastReport('daily', 'F001', 'W001');
      expect(result!.hours).toBe(8);
      expect(result!.notes).toBe('test note');
      expect(result!.items).toEqual([1, 2, 3]);
    });

    it('save overwrites previous savedAt', async () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      const first = useLastReportStore.getState().records['daily_F001_W001'].savedAt;
      await new Promise((r) => setTimeout(r, 10));
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 10 });
      const second = useLastReportStore.getState().records['daily_F001_W001'].savedAt;
      expect(second >= first).toBe(true);
    });

    it('clear then get returns null', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().clearLastReport('daily', 'F001', 'W001');
      expect(useLastReportStore.getState().getLastReport('daily', 'F001', 'W001')).toBeNull();
    });
  });

  describe('reset', () => {
    it('setState with empty records clears all', () => {
      useLastReportStore.getState().saveLastReport('daily', 'F001', 'W001', { hours: 8 });
      useLastReportStore.getState().saveLastReport('weekly', 'F002', 'W002', { hours: 40 });
      useLastReportStore.setState({ records: {} });
      expect(Object.keys(useLastReportStore.getState().records)).toHaveLength(0);
    });
  });
});
