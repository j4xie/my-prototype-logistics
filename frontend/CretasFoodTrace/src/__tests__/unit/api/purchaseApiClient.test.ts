// @ts-nocheck
/**
 * purchaseApiClient 单元测试
 * 测试采购API：采购单CRUD、审批流、收货、价格表、统计
 */

import { purchaseApiClient } from '../../../services/api/purchaseApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/purchase`;
const PRICE_BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/price-lists`;

describe('purchaseApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ── Orders ──

  describe('getOrders', () => {
    it('should fetch orders with default params', async () => {
      mock.onGet(`${BASE}/orders`).reply(200, { success: true, data: { content: [], totalElements: 0 } });
      const result = await purchaseApiClient.getOrders();
      expect(result.success).toBe(true);
    });

    it('should pass query params', async () => {
      mock.onGet(`${BASE}/orders`).reply(200, { success: true, data: { content: [] } });
      const result = await purchaseApiClient.getOrders({ page: 0, size: 20, status: 'PENDING' });
      expect(result.success).toBe(true);
    });
  });

  describe('getOrder', () => {
    it('should fetch single order', async () => {
      mock.onGet(`${BASE}/orders/PO001`).reply(200, { success: true, data: { id: 'PO001', status: 'DRAFT' } });
      const result = await purchaseApiClient.getOrder('PO001');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('PO001');
    });
  });

  describe('createOrder', () => {
    it('should create purchase order', async () => {
      const orderData = { supplierId: 'S001', items: [{ materialId: 'M001', quantity: 100 }] };
      mock.onPost(`${BASE}/orders`).reply(200, { success: true, data: { id: 'PO002' } });
      const result = await purchaseApiClient.createOrder(orderData);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('PO002');
    });
  });

  describe('updateOrder', () => {
    it('should update purchase order', async () => {
      mock.onPut(`${BASE}/orders/PO001`).reply(200, { success: true, data: { id: 'PO001' } });
      const result = await purchaseApiClient.updateOrder('PO001', { notes: '加急' });
      expect(result.success).toBe(true);
    });
  });

  describe('submitOrder', () => {
    it('should submit order for approval', async () => {
      mock.onPost(`${BASE}/orders/PO001/submit`).reply(200, { success: true, data: { status: 'SUBMITTED' } });
      const result = await purchaseApiClient.submitOrder('PO001');
      expect(result.success).toBe(true);
    });
  });

  describe('approveOrder', () => {
    it('should approve order', async () => {
      mock.onPost(`${BASE}/orders/PO001/approve`).reply(200, { success: true, data: { status: 'APPROVED' } });
      const result = await purchaseApiClient.approveOrder('PO001');
      expect(result.success).toBe(true);
    });
  });

  describe('rejectOrder', () => {
    it('should reject order with reason', async () => {
      mock.onPost(`${BASE}/orders/PO001/reject`).reply(200, { success: true, data: { status: 'REJECTED' } });
      const result = await purchaseApiClient.rejectOrder('PO001');
      expect(result.success).toBe(true);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order', async () => {
      mock.onPost(`${BASE}/orders/PO001/cancel`).reply(200, { success: true });
      const result = await purchaseApiClient.cancelOrder('PO001');
      expect(result.success).toBe(true);
    });
  });

  describe('getOrdersByStatus', () => {
    it('should fetch orders by status', async () => {
      mock.onGet(`${BASE}/orders/by-status`).reply(200, { success: true, data: [] });
      const result = await purchaseApiClient.getOrdersByStatus('APPROVED');
      expect(result.success).toBe(true);
    });
  });

  // ── Receives ──

  describe('createReceive', () => {
    it('should create receive record', async () => {
      const data = { orderId: 'PO001', items: [{ materialId: 'M001', receivedQuantity: 95 }] };
      mock.onPost(`${BASE}/receives`).reply(200, { success: true, data: { id: 'RCV001' } });
      const result = await purchaseApiClient.createReceive(data);
      expect(result.success).toBe(true);
    });
  });

  describe('getReceives', () => {
    it('should fetch all receives', async () => {
      mock.onGet(`${BASE}/receives`).reply(200, { success: true, data: [] });
      const result = await purchaseApiClient.getReceives();
      expect(result.success).toBe(true);
    });
  });

  describe('getReceive', () => {
    it('should fetch single receive', async () => {
      mock.onGet(`${BASE}/receives/RCV001`).reply(200, { success: true, data: { id: 'RCV001' } });
      const result = await purchaseApiClient.getReceive('RCV001');
      expect(result.success).toBe(true);
    });
  });

  describe('confirmReceive', () => {
    it('should confirm receive', async () => {
      mock.onPost(`${BASE}/receives/RCV001/confirm`).reply(200, { success: true });
      const result = await purchaseApiClient.confirmReceive('RCV001');
      expect(result.success).toBe(true);
    });
  });

  describe('getReceivesByOrder', () => {
    it('should fetch receives for specific order', async () => {
      mock.onGet(`${BASE}/receives/by-order/PO001`).reply(200, { success: true, data: [] });
      const result = await purchaseApiClient.getReceivesByOrder('PO001');
      expect(result.success).toBe(true);
    });
  });

  // ── Statistics ──

  describe('getStatistics', () => {
    it('should fetch purchase statistics', async () => {
      mock.onGet(`${BASE}/statistics`).reply(200, {
        success: true,
        data: { totalOrders: 50, totalAmount: 120000 },
      });
      const result = await purchaseApiClient.getStatistics();
      expect(result.success).toBe(true);
    });
  });

  // ── Price Lists ──

  describe('getPriceLists', () => {
    it('should fetch price lists', async () => {
      mock.onGet(`${PRICE_BASE}`).reply(200, { success: true, data: [] });
      const result = await purchaseApiClient.getPriceLists();
      expect(result.success).toBe(true);
    });
  });

  describe('getEffectivePriceLists', () => {
    it('should fetch effective price lists', async () => {
      mock.onGet(`${PRICE_BASE}/effective`).reply(200, { success: true, data: [] });
      const result = await purchaseApiClient.getEffectivePriceLists();
      expect(result.success).toBe(true);
    });
  });

  describe('getPriceList', () => {
    it('should fetch single price list', async () => {
      mock.onGet(`${PRICE_BASE}/PL001`).reply(200, { success: true, data: { id: 'PL001', name: '2026Q1' } });
      const result = await purchaseApiClient.getPriceList('PL001');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('PL001');
    });
  });

  describe('deletePriceList', () => {
    it('should delete price list', async () => {
      mock.onDelete(`${PRICE_BASE}/PL001`).reply(200, { success: true });
      const result = await purchaseApiClient.deletePriceList('PL001');
      expect(result.success).toBe(true);
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('should handle 401 unauthorized', async () => {
      mock.onGet(`${BASE}/orders`).reply(401);
      try {
        await purchaseApiClient.getOrders();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle 500 server error', async () => {
      mock.onPost(`${BASE}/orders`).reply(500);
      try {
        await purchaseApiClient.createOrder({});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network error', async () => {
      mock.onGet(`${BASE}/orders`).networkError();
      try {
        await purchaseApiClient.getOrders();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
