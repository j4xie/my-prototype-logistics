// @ts-nocheck
/**
 * customerApiClient 单元测试
 * 测试客户API：查询(多格式响应)、创建、更新、删除、搜索、状态切换
 */

import { customerApiClient } from '../../../services/api/customerApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/customers`;

describe('customerApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  describe('getCustomers', () => {
    it('should handle response with data array directly', async () => {
      mock.onGet(`${BASE}`).reply(200, {
        success: true,
        data: [{ id: 'C001', name: '客户A' }],
      });
      const result = await customerApiClient.getCustomers();
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle response with nested content array', async () => {
      mock.onGet(`${BASE}`).reply(200, {
        success: true,
        data: { content: [{ id: 'C001', name: '客户A' }], totalElements: 1 },
      });
      const result = await customerApiClient.getCustomers();
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle response with code+data format', async () => {
      mock.onGet(`${BASE}`).reply(200, {
        code: 200,
        data: [{ id: 'C001', name: '客户A' }],
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.getCustomers();
      expect(result).toBeDefined();
    });

    it('should handle empty response', async () => {
      mock.onGet(`${BASE}`).reply(200, { success: true, data: [] });
      const result = await customerApiClient.getCustomers();
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
    });
  });

  describe('createCustomer', () => {
    it('should create customer', async () => {
      const customerData = { name: '新客户', contactPerson: '张三', phone: '13800138000' };
      mock.onPost(`${BASE}`).reply(200, { success: true, data: { id: 'C002', ...customerData } });
      const result = await customerApiClient.createCustomer(customerData);
      expect(result).toBeDefined();
    });

    it('should handle validation error', async () => {
      mock.onPost(`${BASE}`).reply(400, { success: false, message: '名称不能为空' });
      try {
        await customerApiClient.createCustomer({});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getCustomerById', () => {
    it('should fetch customer by id and extract data', async () => {
      mock.onGet(`${BASE}/C001`).reply(200, {
        code: 200,
        data: { id: 'C001', name: '客户A', contactPerson: '李四' },
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.getCustomerById('C001');
      expect(result).toBeDefined();
      expect(result.id).toBe('C001');
    });

    it('should handle not found', async () => {
      mock.onGet(`${BASE}/NONEXIST`).reply(404, { success: false, message: 'Not found' });
      try {
        await customerApiClient.getCustomerById('NONEXIST');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('updateCustomer', () => {
    it('should update customer', async () => {
      mock.onPut(`${BASE}/C001`).reply(200, { success: true, data: { id: 'C001', name: '更新客户' } });
      const result = await customerApiClient.updateCustomer('C001', { name: '更新客户' });
      expect(result).toBeDefined();
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer', async () => {
      mock.onDelete(`${BASE}/C001`).reply(200, { success: true });
      await customerApiClient.deleteCustomer('C001');
      // deleteCustomer returns void — no assertion on return value
    });

    it('should handle delete failure', async () => {
      mock.onDelete(`${BASE}/C001`).reply(500);
      try {
        await customerApiClient.deleteCustomer('C001');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('getActiveCustomers', () => {
    it('should fetch active customers and extract data', async () => {
      mock.onGet(`${BASE}/active`).reply(200, {
        code: 200,
        data: [{ id: 'C001', name: '活跃客户', status: 'ACTIVE' }],
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.getActiveCustomers();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when data is null', async () => {
      mock.onGet(`${BASE}/active`).reply(200, {
        code: 200,
        data: null,
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.getActiveCustomers();
      expect(result).toEqual([]);
    });
  });

  describe('searchCustomers', () => {
    it('should search customers by keyword', async () => {
      mock.onGet(`${BASE}/search`).reply(200, {
        code: 200,
        data: [{ id: 'C001', name: '张三食品' }],
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.searchCustomers({ keyword: '张三' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for no results', async () => {
      mock.onGet(`${BASE}/search`).reply(200, {
        code: 200,
        data: [],
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.searchCustomers({ keyword: '不存在' });
      expect(result).toEqual([]);
    });
  });

  describe('toggleCustomerStatus', () => {
    it('should toggle customer status', async () => {
      mock.onPut(`${BASE}/C001/status`).reply(200, {
        code: 200,
        data: { id: 'C001', isActive: false },
        success: true,
        message: 'ok',
      });
      const result = await customerApiClient.toggleCustomerStatus('C001', false);
      expect(result).toBeDefined();
    });
  });
});
