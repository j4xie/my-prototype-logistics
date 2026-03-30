// @ts-nocheck
/**
 * qualityCheckItemApiClient 单元测试
 * 测试质检项配置API客户端：CRUD、分类查询、必检/关键项查询、错误处理
 */

import { qualityCheckItemApi } from '../../../services/api/qualityCheckItemApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/quality-check-items`;

describe('qualityCheckItemApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== create ==========
  describe('create', () => {
    it('should POST to base URL and return created item', async () => {
      const request = { itemCode: 'QC001', itemName: '色泽检查', category: 'SENSORY' };
      const created = { id: 'item-1', ...request };

      mock.onPost(BASE).reply(200, { success: true, data: created, message: 'ok' });

      const result = await qualityCheckItemApi.create(DEFAULT_FACTORY_ID, request);
      expect(result).toEqual(created);
    });

    it('should send request body correctly', async () => {
      const request = {
        itemCode: 'QC002',
        itemName: '水分含量',
        category: 'CHEMICAL',
        minValue: 10,
        maxValue: 30,
        unit: '%',
      };

      mock.onPost(BASE).reply(200, { success: true, data: { id: 'item-2' }, message: 'ok' });

      await qualityCheckItemApi.create(DEFAULT_FACTORY_ID, request);
      expect(mock.history.post).toHaveLength(1);
      expect(JSON.parse(mock.history.post[0].data)).toEqual(request);
    });
  });

  // ========== update ==========
  describe('update', () => {
    it('should PUT to /{itemId} and return updated item', async () => {
      const itemId = 'item-1';
      const request = { itemName: '色泽检查(修订)' };
      const updated = { id: itemId, itemName: '色泽检查(修订)', category: 'SENSORY' };

      mock.onPut(`${BASE}/${itemId}`).reply(200, { success: true, data: updated, message: 'ok' });

      const result = await qualityCheckItemApi.update(DEFAULT_FACTORY_ID, itemId, request);
      expect(result).toEqual(updated);
    });

    it('should handle partial update fields', async () => {
      const itemId = 'item-3';
      const request = { severity: 'CRITICAL', isRequired: true };

      mock.onPut(`${BASE}/${itemId}`).reply(200, { success: true, data: { id: itemId, ...request }, message: 'ok' });

      const result = await qualityCheckItemApi.update(DEFAULT_FACTORY_ID, itemId, request);
      expect(result.severity).toBe('CRITICAL');
      expect(result.isRequired).toBe(true);
    });
  });

  // ========== delete ==========
  describe('delete', () => {
    it('should DELETE /{itemId} and return void', async () => {
      const itemId = 'item-1';

      mock.onDelete(`${BASE}/${itemId}`).reply(200, { success: true, data: null, message: 'ok' });

      await expect(qualityCheckItemApi.delete(DEFAULT_FACTORY_ID, itemId)).resolves.toBeUndefined();
    });

    it('should throw on server error', async () => {
      const itemId = 'item-missing';

      mock.onDelete(`${BASE}/${itemId}`).reply(404, { success: false, message: '质检项不存在' });

      await expect(qualityCheckItemApi.delete(DEFAULT_FACTORY_ID, itemId)).rejects.toThrow();
    });
  });

  // ========== getById ==========
  describe('getById', () => {
    it('should GET /{itemId} and return item', async () => {
      const itemId = 'item-1';
      const item = { id: itemId, itemCode: 'QC001', itemName: '色泽检查', category: 'SENSORY' };

      mock.onGet(`${BASE}/${itemId}`).reply(200, { success: true, data: item, message: 'ok' });

      const result = await qualityCheckItemApi.getById(DEFAULT_FACTORY_ID, itemId);
      expect(result).toEqual(item);
      expect(result.id).toBe(itemId);
    });
  });

  // ========== list ==========
  describe('list', () => {
    it('should GET base URL with default pagination params', async () => {
      const pageData = {
        content: [{ id: 'item-1' }, { id: 'item-2' }],
        totalElements: 2,
        totalPages: 1,
        number: 0,
        size: 20,
      };

      mock.onGet(BASE).reply(200, { success: true, data: pageData, message: 'ok' });

      const result = await qualityCheckItemApi.list(DEFAULT_FACTORY_ID);
      expect(result.content).toHaveLength(2);
      expect(result.totalElements).toBe(2);
    });

    it('should pass custom page, size, sort params', async () => {
      mock.onGet(BASE).reply(200, {
        success: true,
        data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
        message: 'ok',
      });

      await qualityCheckItemApi.list(DEFAULT_FACTORY_ID, 2, 10, 'severity,desc');
      expect(mock.history.get[0].params).toEqual({ page: 2, size: 10, sort: 'severity,desc' });
    });

    it('should use default sort "category,sortOrder"', async () => {
      mock.onGet(BASE).reply(200, {
        success: true,
        data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 },
        message: 'ok',
      });

      await qualityCheckItemApi.list(DEFAULT_FACTORY_ID);
      expect(mock.history.get[0].params).toEqual({ page: 1, size: 20, sort: 'category,sortOrder' });
    });
  });

  // ========== getByCategory ==========
  describe('getByCategory', () => {
    it('should GET /category/{category} and return item array', async () => {
      const items = [
        { id: 'item-1', category: 'SENSORY', itemName: '色泽' },
        { id: 'item-2', category: 'SENSORY', itemName: '气味' },
      ];

      mock.onGet(`${BASE}/category/SENSORY`).reply(200, { success: true, data: items, message: 'ok' });

      const result = await qualityCheckItemApi.getByCategory(DEFAULT_FACTORY_ID, 'SENSORY');
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('SENSORY');
    });

    it('should return empty array for category with no items', async () => {
      mock.onGet(`${BASE}/category/PACKAGING`).reply(200, { success: true, data: [], message: 'ok' });

      const result = await qualityCheckItemApi.getByCategory(DEFAULT_FACTORY_ID, 'PACKAGING');
      expect(result).toEqual([]);
    });
  });

  // ========== getRequired ==========
  describe('getRequired', () => {
    it('should GET /required and return required items', async () => {
      const items = [
        { id: 'item-1', isRequired: true, itemName: '微生物检测' },
        { id: 'item-2', isRequired: true, itemName: '重金属检测' },
      ];

      mock.onGet(`${BASE}/required`).reply(200, { success: true, data: items, message: 'ok' });

      const result = await qualityCheckItemApi.getRequired(DEFAULT_FACTORY_ID);
      expect(result).toHaveLength(2);
      expect(result[0].isRequired).toBe(true);
    });
  });

  // ========== getCritical ==========
  describe('getCritical', () => {
    it('should GET /critical and return critical items', async () => {
      const items = [
        { id: 'item-1', severity: 'CRITICAL', itemName: '大肠杆菌' },
      ];

      mock.onGet(`${BASE}/critical`).reply(200, { success: true, data: items, message: 'ok' });

      const result = await qualityCheckItemApi.getCritical(DEFAULT_FACTORY_ID);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('CRITICAL');
    });
  });

  // ========== error handling ==========
  describe('error handling', () => {
    it('should throw on network error for create', async () => {
      mock.onPost(BASE).networkError();

      await expect(
        qualityCheckItemApi.create(DEFAULT_FACTORY_ID, { itemCode: 'QC001', itemName: '测试', category: 'SENSORY' })
      ).rejects.toThrow();
    });

    it('should throw on 500 server error for getById', async () => {
      mock.onGet(`${BASE}/item-99`).reply(500, { success: false, message: '服务器错误' });

      await expect(qualityCheckItemApi.getById(DEFAULT_FACTORY_ID, 'item-99')).rejects.toThrow();
    });

    it('should throw on 401 unauthorized for list', async () => {
      mock.onGet(BASE).reply(401, { success: false, message: '未授权' });

      await expect(qualityCheckItemApi.list(DEFAULT_FACTORY_ID)).rejects.toThrow();
    });
  });
});
