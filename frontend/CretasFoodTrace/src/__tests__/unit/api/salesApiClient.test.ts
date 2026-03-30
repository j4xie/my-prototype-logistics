// @ts-nocheck
import { salesApiClient } from '../../../services/api/salesApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/sales`;

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
});

afterEach(() => {
  resetApiMock(mock);
});

describe('salesApiClient', () => {
  describe('Orders', () => {
    it('getOrders fetches order list', async () => {
      const orders = [{ id: '1', orderNumber: 'SO-001' }];
      mock.onGet(`${BASE}/orders`).reply(200, { success: true, data: orders });
      const result = await salesApiClient.getOrders();
      expect(result).toEqual({ success: true, data: orders });
    });

    it('getOrders passes query params', async () => {
      mock.onGet(`${BASE}/orders`).reply(200, { success: true, data: [] });
      await salesApiClient.getOrders({ page: 0, size: 10 });
      expect(mock.history.get[0].params).toEqual({ page: 0, size: 10 });
    });

    it('getOrdersByStatus fetches filtered orders', async () => {
      mock.onGet(`${BASE}/orders/by-status`).reply(200, { success: true, data: [] });
      await salesApiClient.getOrdersByStatus('CONFIRMED');
      expect(mock.history.get[0].params).toMatchObject({ status: 'CONFIRMED' });
    });

    it('getOrder fetches single order by id', async () => {
      const order = { id: 'o1', orderNumber: 'SO-001' };
      mock.onGet(`${BASE}/orders/o1`).reply(200, { success: true, data: order });
      const result = await salesApiClient.getOrder('o1');
      expect(result).toEqual({ success: true, data: order });
    });

    it('createOrder posts new order', async () => {
      const orderData = { customerId: 'c1', items: [{ productId: 'p1', quantity: 10 }] };
      mock.onPost(`${BASE}/orders`).reply(201, { success: true, data: { id: 'new1' } });
      const result = await salesApiClient.createOrder(orderData as any);
      expect(result).toEqual({ success: true, data: { id: 'new1' } });
      expect(JSON.parse(mock.history.post[0].data)).toEqual(orderData);
    });

    it('confirmOrder confirms an order', async () => {
      mock.onPost(`${BASE}/orders/o1/confirm`).reply(200, { success: true, data: { status: 'CONFIRMED' } });
      const result = await salesApiClient.confirmOrder('o1');
      expect(result.success).toBe(true);
    });

    it('cancelOrder cancels an order', async () => {
      mock.onPost(`${BASE}/orders/o1/cancel`).reply(200, { success: true });
      const result = await salesApiClient.cancelOrder('o1');
      expect(result.success).toBe(true);
    });

    it('createOrder handles validation error', async () => {
      mock.onPost(`${BASE}/orders`).reply(400, { success: false, message: 'Invalid data' });
      try {
        await salesApiClient.createOrder({} as any);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Deliveries', () => {
    it('createDelivery posts new delivery', async () => {
      const deliveryData = { orderId: 'o1', items: [] };
      mock.onPost(`${BASE}/deliveries`).reply(201, { success: true, data: { id: 'd1' } });
      const result = await salesApiClient.createDelivery(deliveryData as any);
      expect(result).toEqual({ success: true, data: { id: 'd1' } });
    });

    it('getDeliveries fetches delivery list', async () => {
      mock.onGet(`${BASE}/deliveries`).reply(200, { success: true, data: [] });
      const result = await salesApiClient.getDeliveries();
      expect(result.data).toEqual([]);
    });

    it('getDelivery fetches single delivery', async () => {
      const delivery = { id: 'd1', status: 'PENDING' };
      mock.onGet(`${BASE}/deliveries/d1`).reply(200, { success: true, data: delivery });
      const result = await salesApiClient.getDelivery('d1');
      expect(result.data).toEqual(delivery);
    });

    it('shipDelivery updates delivery to shipped', async () => {
      mock.onPost(`${BASE}/deliveries/d1/ship`).reply(200, { success: true, data: { status: 'SHIPPED' } });
      const result = await salesApiClient.shipDelivery('d1');
      expect(result.data.status).toBe('SHIPPED');
    });

    it('confirmDelivered marks delivery as delivered', async () => {
      mock.onPost(`${BASE}/deliveries/d1/delivered`).reply(200, { success: true });
      const result = await salesApiClient.confirmDelivered('d1');
      expect(result.success).toBe(true);
    });

    it('getDeliveriesByOrder fetches deliveries for an order', async () => {
      const deliveries = [{ id: 'd1', orderId: 'o1' }];
      mock.onGet(`${BASE}/deliveries/by-order/o1`).reply(200, { success: true, data: deliveries });
      const result = await salesApiClient.getDeliveriesByOrder('o1');
      expect(result.data).toEqual(deliveries);
    });

    it('createDelivery handles server error', async () => {
      mock.onPost(`${BASE}/deliveries`).reply(500);
      await expect(salesApiClient.createDelivery({} as any)).rejects.toThrow();
    });
  });

  describe('Finished Goods', () => {
    it('getFinishedGoods fetches finished goods list', async () => {
      const goods = [{ id: 'fg1', name: 'Product A', quantity: 100 }];
      mock.onGet(`${BASE}/finished-goods`).reply(200, { success: true, data: goods });
      const result = await salesApiClient.getFinishedGoods();
      expect(result.data).toEqual(goods);
    });

    it('getAvailableBatches fetches available batches', async () => {
      const batches = [{ id: 'b1', batchNumber: 'B-001', available: 50 }];
      mock.onGet(`${BASE}/finished-goods/available`).reply(200, { success: true, data: batches });
      const result = await salesApiClient.getAvailableBatches('pt1');
      expect(result.data).toEqual(batches);
    });

    it('getFinishedGoods passes query params', async () => {
      mock.onGet(`${BASE}/finished-goods`).reply(200, { success: true, data: [] });
      await salesApiClient.getFinishedGoods({ category: 'meat' });
      expect(mock.history.get[0].params).toEqual({ category: 'meat' });
    });
  });

  describe('Statistics', () => {
    it('getStatistics fetches sales statistics', async () => {
      const stats = { totalOrders: 50, totalRevenue: 100000, avgOrderValue: 2000 };
      mock.onGet(`${BASE}/statistics`).reply(200, { success: true, data: stats });
      const result = await salesApiClient.getStatistics();
      expect(result.data).toEqual(stats);
    });

    it('getStatistics handles empty response', async () => {
      mock.onGet(`${BASE}/statistics`).reply(200, { success: true, data: null });
      const result = await salesApiClient.getStatistics();
      expect(result.data).toBeNull();
    });
  });
});
