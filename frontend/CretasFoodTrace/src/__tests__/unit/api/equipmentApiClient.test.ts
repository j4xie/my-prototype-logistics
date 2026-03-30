// @ts-nocheck
/**
 * equipmentApiClient unit tests
 * Tests equipment CRUD, status management, maintenance, queries, statistics, alerts
 */

import { equipmentApiClient } from '../../../services/api/equipmentApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../../utils/errorHandler', () => ({
  getErrorMsg: jest.fn((e: any) => e?.message || 'Unknown'),
}));

describe('equipmentApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/equipment`;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== CRUD ==========

  describe('createEquipment', () => {
    it('should POST to /equipment and return created equipment', async () => {
      const newEquipment = { name: 'Fryer-01', code: 'EQ-001', type: 'processing' };
      const mockEquipment = { id: 1, ...newEquipment, status: 'inactive', factoryId: DEFAULT_FACTORY_ID };

      mock.onPost(BASE).reply(200, { data: mockEquipment });

      const result = await equipmentApiClient.createEquipment(newEquipment);
      expect(result).toEqual(mockEquipment);
      expect(result.id).toBe(1);
    });

    it('should use provided factoryId', async () => {
      const customFactory = 'CUSTOM_FACTORY';
      mock.onPost(`/api/mobile/${customFactory}/equipment`).reply(200, { data: { id: 2 } });

      const result = await equipmentApiClient.createEquipment({ name: 'X', code: 'X', type: 'other' }, customFactory);
      expect(result.id).toBe(2);
    });
  });

  describe('getEquipments', () => {
    it('should GET /equipment and return paginated list', async () => {
      const mockPage = {
        content: [{ id: 1, name: 'Fryer' }, { id: 2, name: 'Cooler' }],
        totalElements: 2,
        totalPages: 1,
      };

      mock.onGet(BASE).reply(200, { data: mockPage });

      const result = await equipmentApiClient.getEquipments();
      expect(result.content).toHaveLength(2);
      expect(result.totalElements).toBe(2);
    });

    it('should pass query params (status, type, keyword)', async () => {
      mock.onGet(BASE).reply((config) => {
        expect(config.params).toHaveProperty('status', 'active');
        expect(config.params).toHaveProperty('type', 'processing');
        return [200, { data: { content: [], totalElements: 0, totalPages: 0 } }];
      });

      await equipmentApiClient.getEquipments({ status: 'active', type: 'processing' });
    });

    it('should pass pagination params', async () => {
      mock.onGet(BASE).reply((config) => {
        expect(config.params).toHaveProperty('page', 2);
        expect(config.params).toHaveProperty('size', 10);
        return [200, { data: { content: [], totalElements: 0, totalPages: 0 } }];
      });

      await equipmentApiClient.getEquipments({ page: 2, size: 10 });
    });
  });

  describe('getEquipmentById', () => {
    it('should GET /equipment/{id} and return equipment detail', async () => {
      const mockEquipment = { id: 5, name: 'Mixer-03', status: 'active' };
      mock.onGet(`${BASE}/5`).reply(200, { data: mockEquipment });

      const result = await equipmentApiClient.getEquipmentById(5);
      expect(result).toEqual(mockEquipment);
      expect(result.name).toBe('Mixer-03');
    });
  });

  describe('updateEquipment', () => {
    it('should PUT /equipment/{id} and return updated equipment', async () => {
      const updateData = { name: 'Fryer-01-v2', location: 'Workshop A' };
      const mockUpdated = { id: 3, ...updateData, status: 'active' };

      mock.onPut(`${BASE}/3`).reply(200, { data: mockUpdated });

      const result = await equipmentApiClient.updateEquipment(3, updateData);
      expect(result.name).toBe('Fryer-01-v2');
      expect(result.location).toBe('Workshop A');
    });
  });

  describe('deleteEquipment', () => {
    it('should DELETE /equipment/{id} and return response', async () => {
      mock.onDelete(`${BASE}/7`).reply(200, { success: true, message: '删除成功' });

      const result = await equipmentApiClient.deleteEquipment(7);
      expect(result.success).toBe(true);
    });
  });

  // ========== Status Management ==========

  describe('updateEquipmentStatus', () => {
    it('should PUT /equipment/{id}/status and return updated equipment', async () => {
      const mockEquipment = { id: 1, status: 'maintenance' };
      mock.onPut(`${BASE}/1/status`).reply(200, { data: mockEquipment });

      const result = await equipmentApiClient.updateEquipmentStatus(1, 'maintenance');
      expect(result.status).toBe('maintenance');
    });
  });

  describe('startEquipment', () => {
    it('should POST /equipment/{id}/start and return equipment', async () => {
      const mockEquipment = { id: 1, status: 'active', operatorId: 42 };
      mock.onPost(`${BASE}/1/start`).reply(200, { data: mockEquipment });

      const result = await equipmentApiClient.startEquipment(1, 42);
      expect(result.status).toBe('active');
      expect(result.operatorId).toBe(42);
    });

    it('should work without operatorId', async () => {
      mock.onPost(`${BASE}/2/start`).reply(200, { data: { id: 2, status: 'active' } });

      const result = await equipmentApiClient.startEquipment(2);
      expect(result.status).toBe('active');
    });
  });

  describe('stopEquipment', () => {
    it('should POST /equipment/{id}/stop and return equipment', async () => {
      mock.onPost(`${BASE}/1/stop`).reply(200, { data: { id: 1, status: 'inactive' } });

      const result = await equipmentApiClient.stopEquipment(1);
      expect(result.status).toBe('inactive');
    });
  });

  describe('scrapEquipment', () => {
    it('should POST /equipment/{id}/scrap with reason', async () => {
      mock.onPost(`${BASE}/1/scrap`).reply(200, { data: { id: 1, status: 'scrapped' } });

      const result = await equipmentApiClient.scrapEquipment(1, '设备老化无法修复');
      expect(result.status).toBe('scrapped');
    });
  });

  // ========== Maintenance ==========

  describe('recordMaintenance', () => {
    it('should POST /equipment/{id}/maintenance and return record', async () => {
      const maintenanceData = { maintenanceDate: '2026-03-20', cost: 1500, description: '更换轴承' };
      const mockRecord = { id: 10, equipmentId: 1, ...maintenanceData };

      mock.onPost(`${BASE}/1/maintenance`).reply(200, { data: mockRecord });

      const result = await equipmentApiClient.recordMaintenance(1, maintenanceData);
      expect(result.cost).toBe(1500);
      expect(result.description).toBe('更换轴承');
    });
  });

  describe('getEquipmentNeedingMaintenance', () => {
    it('should GET /equipment/needing-maintenance and return list', async () => {
      const mockList = [{ id: 1, name: 'Fryer-01' }, { id: 2, name: 'Cooler-02' }];
      mock.onGet(`${BASE}/needing-maintenance`).reply(200, { data: mockList });

      const result = await equipmentApiClient.getEquipmentNeedingMaintenance();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when data is null', async () => {
      mock.onGet(`${BASE}/needing-maintenance`).reply(200, { data: null });

      const result = await equipmentApiClient.getEquipmentNeedingMaintenance();
      expect(result).toEqual([]);
    });
  });

  describe('getEquipmentWithExpiringWarranty', () => {
    it('should GET /equipment/expiring-warranty with daysAhead param', async () => {
      mock.onGet(`${BASE}/expiring-warranty`).reply((config) => {
        expect(config.params).toHaveProperty('daysAhead', 60);
        return [200, { data: [{ id: 3 }] }];
      });

      const result = await equipmentApiClient.getEquipmentWithExpiringWarranty(60);
      expect(result).toHaveLength(1);
    });
  });

  // ========== Queries ==========

  describe('getEquipmentsByStatus', () => {
    it('should GET /equipment/status/{status}', async () => {
      mock.onGet(`${BASE}/status/active`).reply(200, { data: [{ id: 1, status: 'active' }] });

      const result = await equipmentApiClient.getEquipmentsByStatus('active');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });
  });

  describe('getEquipmentsByType', () => {
    it('should GET /equipment/type/{type}', async () => {
      mock.onGet(`${BASE}/type/refrigeration`).reply(200, { data: [{ id: 2, type: 'refrigeration' }] });

      const result = await equipmentApiClient.getEquipmentsByType('refrigeration');
      expect(result).toHaveLength(1);
    });
  });

  describe('searchEquipments', () => {
    it('should GET /equipment/search with keyword', async () => {
      mock.onGet(`${BASE}/search`).reply((config) => {
        expect(config.params).toHaveProperty('keyword', '搅拌');
        return [200, { data: [{ id: 1, name: '搅拌机' }] }];
      });

      const result = await equipmentApiClient.searchEquipments('搅拌');
      expect(result).toHaveLength(1);
    });
  });

  // ========== Statistics ==========

  describe('getEquipmentStatistics', () => {
    it('should GET /equipment/{id}/statistics', async () => {
      const mockStats = { totalCount: 50, activeCount: 30, maintenanceCount: 5 };
      mock.onGet(`${BASE}/10/statistics`).reply(200, { data: mockStats });

      const result = await equipmentApiClient.getEquipmentStatistics(10);
      expect(result.totalCount).toBe(50);
      expect(result.activeCount).toBe(30);
    });
  });

  describe('getEquipmentUsageHistory', () => {
    it('should GET /equipment/{id}/usage-history with date params', async () => {
      const mockHistory = [{ id: 1, equipmentId: 5, operatorId: 10, startTime: '2026-03-01' }];
      mock.onGet(`${BASE}/5/usage-history`).reply(200, { data: mockHistory });

      const result = await equipmentApiClient.getEquipmentUsageHistory(5, { startDate: '2026-03-01', endDate: '2026-03-20' });
      expect(result).toHaveLength(1);
    });
  });

  describe('getEquipmentMaintenanceHistory', () => {
    it('should GET /equipment/{id}/maintenance-history', async () => {
      const mockHistory = [{ id: 1, equipmentId: 5, maintenanceDate: '2026-02-15', cost: 500 }];
      mock.onGet(`${BASE}/5/maintenance-history`).reply(200, { data: mockHistory });

      const result = await equipmentApiClient.getEquipmentMaintenanceHistory(5);
      expect(result).toHaveLength(1);
      expect(result[0].cost).toBe(500);
    });
  });

  describe('getOverallStatistics', () => {
    it('should GET /equipment/overall-statistics', async () => {
      const mockStats = { totalCount: 100, activeCount: 70, scrappedCount: 5, totalValue: 500000 };
      mock.onGet(`${BASE}/overall-statistics`).reply(200, { data: mockStats });

      const result = await equipmentApiClient.getOverallStatistics();
      expect(result.totalCount).toBe(100);
      expect(result.totalValue).toBe(500000);
    });
  });

  describe('calculateDepreciatedValue', () => {
    it('should GET /equipment/{id}/depreciated-value and return number', async () => {
      mock.onGet(`${BASE}/1/depreciated-value`).reply(200, { data: 35000.5 });

      const result = await equipmentApiClient.calculateDepreciatedValue(1);
      expect(result).toBe(35000.5);
    });
  });

  describe('calculateOEE', () => {
    it('should GET /equipment/{id}/oee and return number', async () => {
      mock.onGet(`${BASE}/1/oee`).reply(200, { data: 0.85 });

      const result = await equipmentApiClient.calculateOEE(1);
      expect(result).toBe(0.85);
    });
  });

  // ========== Alerts ==========

  describe('acknowledgeAlert', () => {
    it('should POST /equipment/alerts/{id}/acknowledge', async () => {
      const mockAlert = { id: 1, status: 'ACKNOWLEDGED', level: 'WARNING' };
      mock.onPost(`${BASE}/alerts/MAINT_1/acknowledge`).reply(200, { success: true, data: mockAlert, message: 'ok' });

      const result = await equipmentApiClient.acknowledgeAlert('MAINT_1', { notes: '已确认' });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('resolveAlert', () => {
    it('should POST /equipment/alerts/{id}/resolve', async () => {
      const mockAlert = { id: 1, status: 'RESOLVED', level: 'WARNING' };
      mock.onPost(`${BASE}/alerts/MAINT_1/resolve`).reply(200, { success: true, data: mockAlert, message: 'ok' });

      const result = await equipmentApiClient.resolveAlert('MAINT_1', { resolutionNotes: '已修复' });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('RESOLVED');
    });
  });

  describe('getEquipmentAlerts', () => {
    it('should GET /equipment/alerts with params', async () => {
      const mockAlerts = {
        content: [{ id: 1, level: 'CRITICAL', status: 'ACTIVE' }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      };
      mock.onGet(`${BASE}/alerts`).reply(200, { success: true, data: mockAlerts });

      const result = await equipmentApiClient.getEquipmentAlerts({ status: 'ACTIVE', page: 0, size: 20 });
      expect(result.success).toBe(true);
      expect(result.data.content).toHaveLength(1);
      expect(result.data.totalElements).toBe(1);
    });
  });

  describe('getStatistics', () => {
    it('should GET /equipment/statistics', async () => {
      const mockStats = { totalCount: 80, activeCount: 60 };
      mock.onGet(`${BASE}/statistics`).reply(200, { success: true, data: mockStats });

      const result = await equipmentApiClient.getStatistics();
      expect(result.success).toBe(true);
      expect(result.data.totalCount).toBe(80);
    });
  });
});
