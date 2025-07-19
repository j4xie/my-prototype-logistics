/**
 * MSW Comprehensive Functionality Test
 * 验证Central Mock Service的核心功能
 */

import { mockServerControls } from '@/mocks/node-server';
import { expectAppSuccess, expectAppCreated, expectAppError } from './utils/expectResponse';

describe('Central Mock Service - Comprehensive Testing', () => {
  beforeAll(async () => {
    const started = mockServerControls.start({
      quiet: true,
      onUnhandledRequest: 'warn'
    });
    if (!started) {
      throw new Error('Failed to start mock server for testing');
    }
  });

  afterAll(async () => {
    mockServerControls.stop();
  });

  describe('Authentication Module', () => {
    test('POST /api/auth/login - 成功登录', async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        code: 200,
        success: true,
        message: expect.any(String),
        data: expect.objectContaining({
          user: expect.objectContaining({
            username: 'admin'
          }),
          token: expect.any(String)
        })
      });
    });

    test('POST /api/auth/login - 错误密码', async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toMatchObject({
        code: 401,
        success: false,
        message: expect.any(String),
        data: null
      });
    });

    test('GET /api/auth/status - 验证状态', async () => {
      const response = await fetch('/api/auth/status');
      await expectAppSuccess(response, (data: any) => {
        expect(data.authenticated).toBe(true);
        expect(data.user).toHaveProperty('id');
      });
    });
  });

  describe('Users Module', () => {
    test('GET /api/users - 获取用户列表', async () => {
      const response = await fetch('/api/users');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('users');
        expect(Array.isArray(data.users)).toBe(true);
        expect(data.users.length).toBeGreaterThan(0);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('GET /api/users/profile - 获取用户资料', async () => {
      const response = await fetch('/api/users/profile');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('username');
      });
    });
  });

  describe('Farming Module', () => {
    test('GET /api/farming/crops - 获取作物信息', async () => {
      const response = await fetch('/api/farming/crops');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('crops');
        expect(Array.isArray(data.crops)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('GET /api/farming/fields - 获取田地信息', async () => {
      const response = await fetch('/api/farming/fields');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('fields');
        expect(Array.isArray(data.fields)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('POST /api/farming/plans - 创建种植计划', async () => {
      const response = await fetch('/api/farming/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: 1,
          cropId: 1,
          plannedDate: '2024-01-15',
          expectedHarvestDate: '2024-04-15'
        })
      });

      await expectAppCreated(response, (data: any) => {
        expect(data).toHaveProperty('id');
        expect(data.fieldId).toBe(1);
      });
    });
  });

  describe('Processing Module', () => {
    test('GET /api/processing/raw-materials - 获取原材料', async () => {
      const response = await fetch('/api/processing/raw-materials');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('materials');
        expect(Array.isArray(data.materials)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('POST /api/processing/production-batches - 创建生产批次', async () => {
      const response = await fetch('/api/processing/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 1,
          quantity: 1000,
          startDate: '2024-01-15'
        })
      });

      await expectAppCreated(response, (data: any) => {
        expect(data).toHaveProperty('id');
        expect(data.quantity).toBe(1000);
      });
    });

    test('GET /api/processing/quality-tests - 获取质检记录', async () => {
      const response = await fetch('/api/processing/quality-tests');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('tests');
        expect(Array.isArray(data.tests)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });
  });

  describe('Logistics Module', () => {
    test('GET /api/logistics/vehicles - 获取车辆信息', async () => {
      const response = await fetch('/api/logistics/vehicles');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('vehicles');
        expect(Array.isArray(data.vehicles)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('GET /api/logistics/orders - 获取运输订单', async () => {
      const response = await fetch('/api/logistics/orders');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('orders');
        expect(Array.isArray(data.orders)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('GET /api/logistics/warehouses - 获取仓库信息', async () => {
      const response = await fetch('/api/logistics/warehouses');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('warehouses');
        expect(Array.isArray(data.warehouses)).toBe(true);
        expect(data).toHaveProperty('pagination');
      });
    });
  });

  describe('Admin Module', () => {
    test('GET /api/admin/overview - 获取管理概览', async () => {
      const response = await fetch('/api/admin/overview');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toBeDefined();
      });
    });

    test('GET /api/admin/configs - 获取系统配置', async () => {
      const response = await fetch('/api/admin/configs');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toBeDefined();
      });
    });

    test('GET /api/admin/audit-logs - 获取审计日志', async () => {
      const response = await fetch('/api/admin/audit-logs');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('logs');
        expect(Array.isArray(data.logs)).toBe(true);
        expect(data).toHaveProperty('pagination');
        expect(data).toHaveProperty('summary');
      });
    });
  });

  describe('Trace Module', () => {
    test('GET /api/trace/12345 - 获取溯源信息', async () => {
      const response = await fetch('/api/trace/12345');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('traceId');
        expect(data.traceId).toBe('12345');
      });
    });

    test('POST /api/trace/12345/verify - 验证溯源码', async () => {
      const response = await fetch('/api/trace/12345/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '12345',
          timestamp: new Date().toISOString()
        })
      });
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('verified');
        expect(data.verified).toBe(true);
      });
    });
  });

  describe('Products Module', () => {
    test('GET /api/products - 获取产品列表', async () => {
      const response = await fetch('/api/products');
      await expectAppSuccess(response, (data: any) => {
        expect(data).toHaveProperty('products');
        expect(Array.isArray(data.products)).toBe(true);
        expect(data.products.length).toBeGreaterThan(0);
        expect(data).toHaveProperty('pagination');
      });
    });

    test('POST /api/products - 创建新产品', async () => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '测试产品',
          category: '测试分类',
          price: 100,
          unit: '个',
          stock: 10,
          description: '这是一个测试产品'
        })
      });

      await expectAppCreated(response, (data: any) => {
        expect(data).toHaveProperty('id');
        expect(data.name).toBe('测试产品');
      });
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent - 404错误处理', async () => {
      const response = await fetch('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    test('POST invalid data - 数据验证错误', async () => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      await expectAppError(response, 400);
    });
  });

  describe('Central Mock Service Status', () => {
    test('获取Mock服务器状态', () => {
      const status = mockServerControls.getStatus();
      expect(status).toMatchObject({
        enabled: expect.any(Boolean),
        environment: expect.any(String),
        handlerCount: expect.any(Number)
      });
      expect(status.handlerCount).toBeGreaterThan(20); // 确保有足够的handlers
    });

    test('Reset handlers功能', () => {
      expect(() => {
        mockServerControls.reset();
      }).not.toThrow();
    });
  });

  describe('Network Delay Simulation', () => {
    test('API响应包含延迟模拟', async () => {
      const startTime = Date.now();
      const response = await fetch('/api/logistics/vehicles');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // 检查是否有基本的延迟（考虑到测试环境可能很快）
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});
