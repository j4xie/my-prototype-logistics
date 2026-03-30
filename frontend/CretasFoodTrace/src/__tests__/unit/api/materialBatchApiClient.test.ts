import { materialBatchApiClient } from '../../../services/api/materialBatchApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/material-batches`;

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
});

afterEach(() => {
  resetApiMock(mock);
});

describe('materialBatchApiClient', () => {
  describe('getMaterialBatches', () => {
    it('fetches batches with default params', async () => {
      const data = { content: [{ id: '1' }], totalElements: 1 };
      mock.onGet(BASE).reply(200, { success: true, data });
      const result = await materialBatchApiClient.getMaterialBatches();
      expect(result).toEqual({ success: true, data });
    });

    it('passes query params', async () => {
      mock.onGet(BASE).reply(200, { success: true, data: { content: [] } });
      await materialBatchApiClient.getMaterialBatches({ page: 1, size: 10 });
      expect(mock.history.get[0]!.params).toEqual(expect.objectContaining({ page: 1, size: 10 }));
    });
  });

  describe('createBatch', () => {
    it('posts new batch', async () => {
      const batch = { materialTypeId: 'MT1', quantity: 100 };
      mock.onPost(BASE).reply(200, { success: true, data: { id: 'B1' } });
      const result = await materialBatchApiClient.createBatch(batch);
      expect(result).toEqual({ success: true, data: { id: 'B1' } });
    });
  });

  describe('batchCreate', () => {
    it('posts multiple batches', async () => {
      const batches = [{ materialTypeId: 'MT1' }, { materialTypeId: 'MT2' }];
      mock.onPost(`${BASE}/batch`).reply(200, { success: true, data: [{ id: 'B1' }, { id: 'B2' }] });
      const result = await materialBatchApiClient.batchCreate(batches);
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchById', () => {
    it('fetches single batch', async () => {
      mock.onGet(`${BASE}/B1`).reply(200, { success: true, data: { id: 'B1', quantity: 50 } });
      const result = await materialBatchApiClient.getBatchById('B1');
      expect(result.data.id).toBe('B1');
    });
  });

  describe('updateBatch', () => {
    it('puts updated batch', async () => {
      mock.onPut(`${BASE}/B1`).reply(200, { success: true, data: { id: 'B1' } });
      const result = await materialBatchApiClient.updateBatch('B1', { quantity: 200 });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteBatch', () => {
    it('deletes batch', async () => {
      mock.onDelete(`${BASE}/B1`).reply(200, { success: true });
      const result = await materialBatchApiClient.deleteBatch('B1');
      expect(result.success).toBe(true);
    });
  });

  describe('reserveBatch', () => {
    it('reserves batch', async () => {
      mock.onPost(`${BASE}/B1/reserve`).reply(200, { success: true, data: { reserved: 10 } });
      const result = await materialBatchApiClient.reserveBatch('B1', 10, 1001);
      expect(result.success).toBe(true);
    });
  });

  describe('releaseBatch', () => {
    it('releases batch reservation', async () => {
      mock.onPost(`${BASE}/B1/release`).reply(200, { success: true });
      const result = await materialBatchApiClient.releaseBatch('B1', 5, 1001);
      expect(result.success).toBe(true);
    });
  });

  describe('consumeBatch', () => {
    it('consumes batch', async () => {
      mock.onPost(`${BASE}/B1/consume`).reply(200, { success: true });
      const result = await materialBatchApiClient.consumeBatch('B1', 20, 1001);
      expect(result.success).toBe(true);
    });
  });

  describe('useBatch', () => {
    it('uses batch', async () => {
      mock.onPost(`${BASE}/B1/use`).reply(200, { success: true });
      const result = await materialBatchApiClient.useBatch('B1', 15);
      expect(result.success).toBe(true);
    });
  });

  describe('adjustBatch', () => {
    it('adjusts batch', async () => {
      mock.onPost(`${BASE}/B1/adjust`).reply(200, { success: true });
      const result = await materialBatchApiClient.adjustBatch('B1', 5, 'correction');
      expect(result.success).toBe(true);
    });
  });

  describe('updateBatchStatus', () => {
    it('updates batch status', async () => {
      mock.onPut(`${BASE}/B1/status`).reply(200, { success: true });
      const result = await materialBatchApiClient.updateBatchStatus('B1', 'EXPIRED');
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchesByMaterialType', () => {
    it('fetches batches by material type', async () => {
      mock.onGet(`${BASE}/material-type/MT1`).reply(200, { success: true, data: [{ id: 'B1' }] });
      const result = await materialBatchApiClient.getBatchesByMaterialType('MT1');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getBatchesByStatus', () => {
    it('converts status to uppercase', async () => {
      mock.onGet(`${BASE}/status/AVAILABLE`).reply(200, { success: true, data: [] });
      await materialBatchApiClient.getBatchesByStatus('available');
      expect(mock.history.get[0]!.url).toContain('AVAILABLE');
    });

    it('fetches batches by status', async () => {
      mock.onGet(`${BASE}/status/EXPIRED`).reply(200, { success: true, data: [{ id: 'B1' }] });
      const result = await materialBatchApiClient.getBatchesByStatus('EXPIRED');
      expect(result.success).toBe(true);
    });
  });

  describe('getFifoBatches', () => {
    it('fetches FIFO ordered batches', async () => {
      mock.onGet(`${BASE}/fifo/MT1`).reply(200, { success: true, data: [] });
      const result = await materialBatchApiClient.getFifoBatches('MT1', 10);
      expect(result.success).toBe(true);
    });
  });

  describe('getFefoBatches', () => {
    it('fetches FEFO ordered batches', async () => {
      mock.onGet(`${BASE}/fefo/MT1`).reply(200, { success: true, data: [] });
      const result = await materialBatchApiClient.getFefoBatches('MT1');
      expect(result.success).toBe(true);
    });
  });

  describe('getExpiringBatches', () => {
    it('fetches expiring batches', async () => {
      mock.onGet(`${BASE}/expiring`).reply(200, { success: true, data: [{ id: 'B1' }] });
      const result = await materialBatchApiClient.getExpiringBatches();
      expect(result.success).toBe(true);
    });

    it('passes days parameter', async () => {
      mock.onGet(`${BASE}/expiring`).reply(200, { success: true, data: [] });
      await materialBatchApiClient.getExpiringBatches(7);
      expect(mock.history.get[0]!.params).toEqual(expect.objectContaining({ days: 7 }));
    });
  });

  describe('getExpiredBatches', () => {
    it('fetches expired batches', async () => {
      mock.onGet(`${BASE}/expired`).reply(200, { success: true, data: [] });
      const result = await materialBatchApiClient.getExpiredBatches();
      expect(result.success).toBe(true);
    });
  });

  describe('handleExpiredBatches', () => {
    it('handles expired batches', async () => {
      mock.onPost(`${BASE}/handle-expired`).reply(200, { success: true, data: { handled: 3 } });
      const result = await materialBatchApiClient.handleExpiredBatches({ action: 'dispose' });
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchUsageHistory', () => {
    it('fetches usage history for batch', async () => {
      mock.onGet(`${BASE}/B1/usage-history`).reply(200, { success: true, data: [] });
      const result = await materialBatchApiClient.getBatchUsageHistory('B1');
      expect(result.success).toBe(true);
    });
  });

  describe('getLowStockBatches', () => {
    it('fetches low stock batches', async () => {
      mock.onGet(`${BASE}/low-stock`).reply(200, { success: true, data: [{ id: 'B1' }] });
      const result = await materialBatchApiClient.getLowStockBatches();
      expect(result.success).toBe(true);
    });
  });

  describe('getInventoryWarnings', () => {
    it('fetches inventory warnings', async () => {
      mock.onGet(`${BASE}/inventory/alerts`).reply(200, { success: true, data: [] });
      const result = await materialBatchApiClient.getInventoryWarnings();
      expect(result.success).toBe(true);
    });
  });

  describe('getInventoryStatistics', () => {
    it('fetches inventory statistics', async () => {
      mock.onGet(`${BASE}/inventory/statistics`).reply(200, { success: true, data: { totalBatches: 100 } });
      const result = await materialBatchApiClient.getInventoryStatistics();
      expect(result.data.totalBatches).toBe(100);
    });
  });

  describe('getInventoryValuation', () => {
    it('fetches inventory valuation', async () => {
      mock.onGet(`${BASE}/inventory/valuation`).reply(200, { success: true, data: { totalValue: 50000 } });
      const result = await materialBatchApiClient.getInventoryValuation();
      expect(result.data.totalValue).toBe(50000);
    });
  });

  describe('exportInventory', () => {
    it('exports inventory data', async () => {
      mock.onGet(`${BASE}/export`).reply(200, { success: true, data: 'csv-content' });
      const result = await materialBatchApiClient.exportInventory();
      expect(result).toBeDefined();
    });
  });

  describe('convertToFrozen', () => {
    it('converts batch to frozen', async () => {
      mock.onPost(`${BASE}/B1/convert-to-frozen`).reply(200, { success: true });
      const result = await materialBatchApiClient.convertToFrozen('B1', {
        convertedBy: 1,
        convertedDate: '2026-03-20',
        storageLocation: 'F-01',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('undoFrozen', () => {
    it('undoes frozen conversion', async () => {
      mock.onPost(`${BASE}/B1/undo-frozen`).reply(200, { success: true });
      const result = await materialBatchApiClient.undoFrozen('B1', {
        operatorId: 1,
        reason: 'mistake',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('rejects on network error', async () => {
      mock.onGet(BASE).networkError();
      await expect(materialBatchApiClient.getMaterialBatches()).rejects.toThrow();
    });

    it('rejects on 500 error', async () => {
      mock.onGet(`${BASE}/B1`).reply(500, { success: false, message: 'Internal error' });
      await expect(materialBatchApiClient.getBatchById('B1')).rejects.toThrow();
    });
  });
});
