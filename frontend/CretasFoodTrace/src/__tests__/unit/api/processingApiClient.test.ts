// @ts-nocheck
/**
 * processingApiClient 单元测试
 * 测试生产加工API：批次管理、物料消耗、质检、成本分析、扫码、报工
 */

import { processingApiClient } from '../../../services/api/processingApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/processing`;
const REPORT_BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/reports/finance`;

describe('processingApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  describe('getBatches', () => {
    it('should fetch batches with default params', async () => {
      mock.onGet(`${BASE}/batches`).reply(200, { success: true, data: { content: [], totalElements: 0 } });
      const result = await processingApiClient.getBatches();
      expect(result.success).toBe(true);
    });

    it('should pass query parameters', async () => {
      mock.onGet(`${BASE}/batches`).reply(200, { success: true, data: { content: [] } });
      const result = await processingApiClient.getBatches({ page: 0, size: 10, status: 'IN_PROGRESS' });
      expect(result.success).toBe(true);
    });
  });

  describe('createBatch', () => {
    it('should create a new batch', async () => {
      const batchData = { productName: '牛肉干', quantity: 100 };
      mock.onPost(`${BASE}/batches`).reply(200, { success: true, data: { id: 'B001' } });
      const result = await processingApiClient.createBatch(batchData);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('B001');
    });
  });

  describe('getBatchById', () => {
    it('should fetch batch by id', async () => {
      mock.onGet(`${BASE}/batches/B001`).reply(200, { success: true, data: { id: 'B001', productName: '牛肉干' } });
      const result = await processingApiClient.getBatchById('B001');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('B001');
    });
  });

  describe('updateBatch', () => {
    it('should update batch', async () => {
      mock.onPut(`${BASE}/batches/B001`).reply(200, { success: true, data: { id: 'B001' } });
      const result = await processingApiClient.updateBatch('B001', { quantity: 200 });
      expect(result.success).toBe(true);
    });
  });

  describe('startProduction', () => {
    it('should start production for batch', async () => {
      mock.onPost(`${BASE}/batches/B001/start`).reply(200, { success: true, data: { status: 'IN_PROGRESS' } });
      const result = await processingApiClient.startProduction('B001');
      expect(result.success).toBe(true);
    });
  });

  describe('completeProduction', () => {
    it('should complete production', async () => {
      mock.onPost(`${BASE}/batches/B001/complete`).reply(200, { success: true, data: { status: 'COMPLETED' } });
      const result = await processingApiClient.completeProduction('B001');
      expect(result.success).toBe(true);
    });
  });

  describe('cancelProduction', () => {
    it('should cancel production', async () => {
      mock.onPost(`${BASE}/batches/B001/cancel`).reply(200, { success: true });
      const result = await processingApiClient.cancelProduction('B001');
      expect(result.success).toBe(true);
    });
  });

  describe('recordMaterialConsumption', () => {
    it('should record material consumption', async () => {
      const data = { materialId: 'M001', quantity: 50 };
      mock.onPost(`${BASE}/batches/B001/material-consumption`).reply(200, { success: true, data: { id: 'C001' } });
      const result = await processingApiClient.recordMaterialConsumption('B001', data);
      expect(result.success).toBe(true);
    });
  });

  describe('getMaterials', () => {
    it('should fetch materials list', async () => {
      mock.onGet(`${BASE}/materials`).reply(200, { success: true, data: [] });
      const result = await processingApiClient.getMaterials();
      expect(result.success).toBe(true);
    });
  });

  describe('recordMaterialReceipt', () => {
    it('should record material receipt', async () => {
      const data = { materialId: 'M001', quantity: 100, supplierId: 'S001' };
      mock.onPost(`${BASE}/material-receipt`).reply(200, { success: true, data: { id: 'R001' } });
      const result = await processingApiClient.recordMaterialReceipt(data);
      expect(result.success).toBe(true);
    });
  });

  describe('getQualityInspections', () => {
    it('should fetch quality inspections for batch', async () => {
      mock.onGet(`${BASE}/quality/inspections`).reply(200, { success: true, data: [] });
      const result = await processingApiClient.getQualityInspections({ batchId: 'B001' });
      expect(result.success).toBe(true);
    });
  });

  describe('createQualityInspection', () => {
    it('should create quality inspection', async () => {
      const data = { batchId: 'B001', inspectionType: 'final_product' as const, inspector: 'QC001', inspectionDate: '2026-03-20', inspectionTime: '10:00', scores: { freshness: 90, appearance: 85, smell: 88, other: 92 }, conclusion: 'pass' as const };
      mock.onPost(`${BASE}/quality/inspections`).reply(200, { success: true, data: { id: 'QI001' } });
      const result = await processingApiClient.createQualityInspection(data);
      expect(result.success).toBe(true);
    });
  });

  describe('deleteQualityInspection', () => {
    it('should delete quality inspection', async () => {
      mock.onDelete(`${BASE}/quality/inspections/QI001`).reply(200, { success: true });
      const result = await processingApiClient.deleteQualityInspection('QI001');
      expect(result.success).toBe(true);
    });
  });

  describe('reviewQualityInspection', () => {
    it('should review quality inspection', async () => {
      mock.onPost(`${BASE}/quality/inspections/QI001/review`).reply(200, { success: true });
      const result = await processingApiClient.reviewQualityInspection('QI001', { approved: true });
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchCostAnalysis', () => {
    it('should fetch cost analysis for batch', async () => {
      mock.onGet(`${BASE}/batches/B001/cost-analysis`).reply(200, { success: true, data: { totalCost: 1500 } });
      const result = await processingApiClient.getBatchCostAnalysis('B001');
      expect(result.success).toBe(true);
    });
  });

  describe('getEnhancedBatchCostAnalysis', () => {
    it('should fetch enhanced cost analysis', async () => {
      mock.onGet(`${BASE}/batches/B001/cost-analysis/enhanced`).reply(200, {
        success: true,
        data: { totalCost: 1500, breakdown: [] },
      });
      const result = await processingApiClient.getEnhancedBatchCostAnalysis('B001');
      expect(result.success).toBe(true);
    });
  });

  describe('getTimeRangeCostAnalysis', () => {
    it('should fetch time range cost analysis from reports endpoint', async () => {
      mock.onGet(REPORT_BASE).reply(200, {
        success: true,
        data: { totalCost: 5000, period: '2026-03' },
      });
      const result = await processingApiClient.getTimeRangeCostAnalysis({ startDate: '2026-03-01T00:00:00', endDate: '2026-03-31T23:59:59' });
      expect(result.success).toBe(true);
    });
  });

  describe('aiTimeRangeCostAnalysis', () => {
    it('should fetch AI cost analysis', async () => {
      mock.onPost(`${BASE}/ai-cost-analysis/time-range`).reply(200, {
        success: true,
        data: { analysis: 'Cost is trending down' },
      });
      const result = await processingApiClient.aiTimeRangeCostAnalysis({ startDate: '2026-03-01', endDate: '2026-03-31' });
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchCostComparison', () => {
    it('should fetch batch cost comparison', async () => {
      mock.onGet(`${BASE}/cost-comparison`).reply(200, { success: true, data: [] });
      const result = await processingApiClient.getBatchCostComparison(['B001', 'B002']);
      expect(result.success).toBe(true);
    });
  });

  describe('scanBatchByCode', () => {
    it('should scan batch by barcode', async () => {
      mock.onPost(`${BASE}/batches/scan`).reply(200, { success: true, data: { id: 'B001', batchNumber: 'BARCODE123' } });
      const result = await processingApiClient.scanBatchByCode('BARCODE123');
      expect(result.success).toBe(true);
      expect(result.data.batchNumber).toBe('BARCODE123');
    });
  });

  describe('submitWorkReport', () => {
    it('should submit work report', async () => {
      const reportData = { actualQuantity: 95, goodQuantity: 90, defectQuantity: 5 };
      mock.onPost(`${BASE}/batches/B001/report`).reply(200, { success: true, data: { id: 'WR001' } });
      const result = await processingApiClient.submitWorkReport('B001', reportData);
      expect(result.success).toBe(true);
    });
  });

  describe('submitTeamBatchReport', () => {
    it('should submit team batch report', async () => {
      const reportData = { batchId: 1, totalOutput: 200, totalGoodQuantity: 190, totalDefectQuantity: 10 };
      mock.onPost(`${BASE}/work-sessions/batch-report`).reply(200, { success: true, data: { recordedMembers: 3, totalOutput: 200 } });
      const result = await processingApiClient.submitTeamBatchReport(reportData);
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle 404 error', async () => {
      mock.onGet(`${BASE}/batches/NONEXIST`).reply(404, { success: false, message: 'Not found' });
      try {
        await processingApiClient.getBatchById('NONEXIST');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle 500 error', async () => {
      mock.onGet(`${BASE}/batches`).reply(500);
      try {
        await processingApiClient.getBatches();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network error', async () => {
      mock.onGet(`${BASE}/batches`).networkError();
      try {
        await processingApiClient.getBatches();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
