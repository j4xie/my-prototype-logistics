// @ts-nocheck
import { materialConsumptionApiClient } from '../../../services/api/materialConsumptionApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/processing/material-consumptions`;

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
});

afterEach(() => {
  resetApiMock(mock);
});

describe('materialConsumptionApiClient', () => {
  describe('getConsumptions', () => {
    it('fetches consumptions list', async () => {
      mock.onGet(BASE).reply(200, { success: true, data: { content: [{ id: 'C1' }] } });
      const result = await materialConsumptionApiClient.getConsumptions();
      expect(result.success).toBe(true);
    });

    it('passes query params', async () => {
      mock.onGet(BASE).reply(200, { success: true, data: { content: [] } });
      await materialConsumptionApiClient.getConsumptions({ page: 0, size: 20 });
      expect(mock.history.get[0].params).toEqual(expect.objectContaining({ page: 0, size: 20 }));
    });
  });

  describe('getConsumptionById', () => {
    it('fetches single consumption', async () => {
      mock.onGet(`${BASE}/1`).reply(200, { success: true, data: { id: 1, quantity: 10 } });
      const result = await materialConsumptionApiClient.getConsumptionById(1);
      expect(result.data.id).toBe(1);
    });
  });

  describe('getConsumptionsByBatch', () => {
    it('fetches consumptions by batch id', async () => {
      mock.onGet(`${BASE}/batch/B1`).reply(200, { success: true, data: [{ id: 'C1' }] });
      const result = await materialConsumptionApiClient.getConsumptionsByBatch('B1');
      expect(result.success).toBe(true);
    });
  });

  describe('getConsumptionsByMaterialBatch', () => {
    it('fetches consumptions by material batch', async () => {
      mock.onGet(`${BASE}/material-batch/MB1`).reply(200, { success: true, data: [] });
      const result = await materialConsumptionApiClient.getConsumptionsByMaterialBatch('MB1');
      expect(result.success).toBe(true);
    });
  });

  describe('getConsumptionsByTimeRange', () => {
    it('fetches consumptions by time range', async () => {
      mock.onGet(`${BASE}/time-range`).reply(200, { success: true, data: [] });
      const result = await materialConsumptionApiClient.getConsumptionsByTimeRange('2026-01-01', '2026-01-31');
      expect(result.success).toBe(true);
    });
  });

  describe('getConsumptionStats', () => {
    it('fetches consumption statistics', async () => {
      mock.onGet(`${BASE}/stats`).reply(200, { success: true, data: { totalQuantity: 500, totalCost: 2500, consumptionCount: 10 } });
      const result = await materialConsumptionApiClient.getConsumptionStats();
      expect(result.data.totalQuantity).toBe(500);
      expect(result.data.totalCost).toBe(2500);
      expect(result.data.consumptionCount).toBe(10);
    });
  });

  describe('getBatchConsumptionCost', () => {
    it('fetches batch consumption cost', async () => {
      mock.onGet(`${BASE}/batch/B1/cost`).reply(200, { success: true, data: { totalCost: 1500 } });
      const result = await materialConsumptionApiClient.getBatchConsumptionCost('B1');
      expect(result.data.totalCost).toBe(1500);
    });
  });

  describe('getBatchConsumptionSummary', () => {
    it('transforms summary with correct variance calculation', async () => {
      const rawData = {
        items: [
          { materialTypeName: 'Flour', plannedQty: 100, actualQty: 110 },
          { materialTypeName: 'Sugar', plannedQty: 50, actualQty: 45 },
        ],
        totalPlannedCost: 800,
        totalActualCost: 820,
        overallAchievementRate: 102.5,
      };
      mock.onGet(`${BASE}/batch/B1/summary`).reply(200, { success: true, data: rawData });

      const result = await materialConsumptionApiClient.getBatchConsumptionSummary('B1');
      expect(result.success).toBe(true);
      // variance = actual - planned
      expect(result.data.materials[0].variance).toBe(10);  // 110 - 100
      expect(result.data.materials[1].variance).toBe(-5);   // 45 - 50
    });

    it('calculates achievementRate = (actual/planned)*100', async () => {
      const rawData = {
        items: [
          { materialTypeName: 'Flour', plannedQty: 100, actualQty: 80 },
        ],
        totalPlannedCost: 500,
        totalActualCost: 400,
        overallAchievementRate: 80,
      };
      mock.onGet(`${BASE}/batch/B1/summary`).reply(200, { success: true, data: rawData });

      const result = await materialConsumptionApiClient.getBatchConsumptionSummary('B1');
      // achievementRate = (80/100)*100 = 80
      expect(result.data.materials[0].achievementRate).toBe(80);
    });

    it('returns 0 achievementRate when planned is 0', async () => {
      const rawData = {
        items: [
          { materialTypeName: 'Salt', plannedQty: 0, actualQty: 5 },
        ],
        totalPlannedCost: 0,
        totalActualCost: 25,
        overallAchievementRate: 0,
      };
      mock.onGet(`${BASE}/batch/B1/summary`).reply(200, { success: true, data: rawData });

      const result = await materialConsumptionApiClient.getBatchConsumptionSummary('B1');
      expect(result.data.materials[0].achievementRate).toBe(0);
    });

    it('preserves totalPlannedQuantity, totalActualQuantity and overallAchievementRate', async () => {
      const rawData = {
        items: [
          { materialTypeName: 'A', plannedQty: 600, actualQty: 570 },
          { materialTypeName: 'B', plannedQty: 400, actualQty: 380 },
        ],
        totalPlannedCost: 1000,
        totalActualCost: 950,
        overallAchievementRate: 95,
      };
      mock.onGet(`${BASE}/batch/B1/summary`).reply(200, { success: true, data: rawData });

      const result = await materialConsumptionApiClient.getBatchConsumptionSummary('B1');
      expect(result.data.totalPlannedQuantity).toBe(1000);  // 600+400
      expect(result.data.totalActualQuantity).toBe(950);     // 570+380
      expect(result.data.overallAchievementRate).toBe(95);
    });

    it('handles multiple items with mixed variances', async () => {
      const rawData = {
        items: [
          { materialTypeName: 'A', plannedQty: 200, actualQty: 200 },
          { materialTypeName: 'B', plannedQty: 50, actualQty: 75 },
        ],
        totalPlannedCost: 1250,
        totalActualCost: 1375,
        overallAchievementRate: 110,
      };
      mock.onGet(`${BASE}/batch/B2/summary`).reply(200, { success: true, data: rawData });

      const result = await materialConsumptionApiClient.getBatchConsumptionSummary('B2');
      expect(result.data.materials[0].variance).toBe(0);    // 200-200
      expect(result.data.materials[0].achievementRate).toBe(100); // (200/200)*100
      expect(result.data.materials[1].variance).toBe(25);   // 75-50
      expect(result.data.materials[1].achievementRate).toBe(150); // (75/50)*100
    });
  });

  describe('error handling', () => {
    it('rejects on network error', async () => {
      mock.onGet(BASE).networkError();
      await expect(materialConsumptionApiClient.getConsumptions()).rejects.toThrow();
    });

    it('rejects on 500', async () => {
      mock.onGet(`${BASE}/1`).reply(500, { success: false, message: 'error' });
      await expect(materialConsumptionApiClient.getConsumptionById(1)).rejects.toThrow();
    });

    it('getBatchConsumptionSummary rejects on error', async () => {
      mock.onGet(`${BASE}/batch/B1/summary`).reply(500);
      await expect(materialConsumptionApiClient.getBatchConsumptionSummary('B1')).rejects.toThrow();
    });
  });
});
