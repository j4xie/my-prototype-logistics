/**
 * 平台管理模块MSW Handlers
 * 提供多租户工厂管理、订阅套餐、操作日志等API
 */

import { http, HttpResponse, RequestHandler } from 'msw';
import type {
  Factory,
  SubscriptionPlanInfo,
  OperationLog,
  PlatformOverview,
  FactoryStatus,
  SubscriptionPlan
} from '../data/platform-data';
import {
  mockFactories,
  mockSubscriptionPlans,
  mockOperationLogs,
  mockPlatformOverview,
  generateFactoryId,
  generateUserId,
  generateLogId
} from '../data/platform-data';

// 模拟存储（实际应用中这些数据会存储在数据库中）
const factories = [...mockFactories];
const subscriptionPlans = [...mockSubscriptionPlans];
const operationLogs = [...mockOperationLogs];
let platformOverview = { ...mockPlatformOverview };

// 记录操作日志的辅助函数
const addOperationLog = (action: string, targetType: 'factory' | 'user' | 'plan' | 'system', targetId: string, targetName: string, description: string) => {
  const newLog: OperationLog = {
    id: generateLogId(),
    operator_id: 'platform_admin_001',
    operator_name: '平台管理员',
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    description,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    created_at: new Date().toISOString()
  };
  operationLogs.unshift(newLog); // 新日志在前
};

// 更新平台概览统计的辅助函数
const updatePlatformOverview = () => {
  platformOverview = {
    ...platformOverview,
    total_factories: factories.length,
    active_factories: factories.filter(f => f.status === 'active').length,
    pending_factories: factories.filter(f => f.status === 'pending').length,
    suspended_factories: factories.filter(f => f.status === 'suspended').length,
    total_users: factories.reduce((sum, f) => sum + f.employee_count, 0),
    total_revenue: factories.filter(f => f.status === 'active').reduce((sum, f) => sum + f.monthly_revenue, 0),
    data_usage_total_gb: factories.reduce((sum, f) => sum + f.data_usage_gb, 0)
  };
};

/**
 * 平台概览统计
 * GET /api/platform/overview
 */
const getOverviewHandler: RequestHandler = http.get('/api/platform/overview', () => {
  // 模拟延迟
  return new Promise((resolve) => {
    setTimeout(() => {
      updatePlatformOverview();
      resolve(HttpResponse.json({
        code: 200,
        message: '获取概览数据成功',
        data: platformOverview
      }));
    }, 500);
  });
});

/**
 * 获取工厂列表
 * GET /api/platform/factories?keyword=&page=1&size=10
 */
const getFactoriesHandler: RequestHandler = http.get('/api/platform/factories', ({ request }) => {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '10');

  // 过滤数据
  let filteredFactories = factories;
  if (keyword) {
    filteredFactories = factories.filter(factory =>
      factory.name.toLowerCase().includes(keyword.toLowerCase()) ||
      factory.industry.toLowerCase().includes(keyword.toLowerCase()) ||
      factory.owner_name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 分页
  const total = filteredFactories.length;
  const start = (page - 1) * size;
  const end = start + size;
  const pagedData = filteredFactories.slice(start, end);

  return HttpResponse.json({
    code: 200,
    message: '获取工厂列表成功',
    data: {
      factories: pagedData,
      pagination: {
        page,
        size,
        total,
        pages: Math.ceil(total / size)
      }
    }
  });
});

/**
 * 创建工厂
 * POST /api/platform/factories
 */
const createFactoryHandler: RequestHandler = http.post('/api/platform/factories', async ({ request }) => {
  const body = await request.json() as {
    factory_name: string;
    industry: string;
    owner_name: string;
    owner_email: string;
    owner_phone: string;
    contact_address: string;
    subscription_plan: SubscriptionPlan;
    employee_count: number;
  };

  // 验证必填字段
  if (!body.factory_name || !body.owner_name || !body.owner_email) {
    return HttpResponse.json({
      code: 400,
      message: '缺少必填字段'
    }, { status: 400 });
  }

  // 检查工厂名称是否已存在
  if (factories.some(f => f.name === body.factory_name)) {
    return HttpResponse.json({
      code: 400,
      message: '工厂名称已存在'
    }, { status: 400 });
  }

  // 检查邮箱是否已存在
  if (factories.some(f => f.owner_email === body.owner_email)) {
    return HttpResponse.json({
      code: 400,
      message: '管理员邮箱已存在'
    }, { status: 400 });
  }

  // 创建新工厂
  const newFactory: Factory = {
    id: generateFactoryId(),
    name: body.factory_name,
    industry: body.industry || '其他',
    status: 'pending',
    subscription_plan: body.subscription_plan || 'trial',
    employee_count: body.employee_count || 1,
    owner_user_id: generateUserId(),
    owner_name: body.owner_name,
    owner_email: body.owner_email,
    owner_phone: body.owner_phone || '',
    contact_address: body.contact_address || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    monthly_revenue: 0,
    data_usage_gb: 0
  };

  factories.push(newFactory);

  // 记录操作日志
  addOperationLog(
    'CREATE_FACTORY',
    'factory',
    newFactory.id,
    newFactory.name,
    `创建新工厂：${newFactory.name}`
  );

  return HttpResponse.json({
    code: 200,
    message: '工厂创建成功',
    data: newFactory
  });
});

/**
 * 更新工厂状态
 * PUT /api/platform/factories/{id}/status
 */
const updateFactoryStatusHandler: RequestHandler = http.put('/api/platform/factories/:id/status', async ({ params, request }) => {
  const factoryId = params.id as string;
  const body = await request.json() as { status: FactoryStatus; reason?: string };

  const factoryIndex = factories.findIndex(f => f.id === factoryId);
  if (factoryIndex === -1) {
    return HttpResponse.json({
      code: 404,
      message: '工厂不存在'
    }, { status: 404 });
  }

  const factory = factories[factoryIndex];
  const oldStatus = factory.status;

  // 更新状态
  factories[factoryIndex] = {
    ...factory,
    status: body.status,
    updated_at: new Date().toISOString()
  };

  // 如果是暂停，清零收入
  if (body.status === 'suspended') {
    factories[factoryIndex].monthly_revenue = 0;
  }

  // 记录操作日志
  const actionMap = {
    active: 'ACTIVATE_FACTORY',
    suspended: 'SUSPEND_FACTORY',
    pending: 'PENDING_FACTORY',
    deleted: 'DELETE_FACTORY'
  };

  addOperationLog(
    actionMap[body.status],
    'factory',
    factoryId,
    factory.name,
    `将工厂状态从 ${oldStatus} 更改为 ${body.status}${body.reason ? `（原因：${body.reason}）` : ''}`
  );

  return HttpResponse.json({
    code: 200,
    message: '工厂状态更新成功',
    data: factories[factoryIndex]
  });
});

/**
 * 获取订阅套餐列表
 * GET /api/platform/plans
 */
const getPlansHandler: RequestHandler = http.get('/api/platform/plans', () => {
  return HttpResponse.json({
    code: 200,
    message: '获取套餐列表成功',
    data: subscriptionPlans
  });
});

/**
 * 创建订阅套餐
 * POST /api/platform/plans
 */
const createPlanHandler: RequestHandler = http.post('/api/platform/plans', async ({ request }) => {
  const body = await request.json() as {
    name: string;
    display_name: string;
    price_monthly: number;
    price_yearly: number;
    max_users: number;
    max_storage_gb: number;
    features: string[];
  };

  // 验证必填字段
  if (!body.name || !body.display_name) {
    return HttpResponse.json({
      code: 400,
      message: '缺少必填字段'
    }, { status: 400 });
  }

  // 检查套餐名称是否已存在
  if (subscriptionPlans.some(p => p.name === body.name)) {
    return HttpResponse.json({
      code: 400,
      message: '套餐名称已存在'
    }, { status: 400 });
  }

  const newPlan: SubscriptionPlanInfo = {
    id: `plan_${Date.now()}`,
    name: body.name,
    display_name: body.display_name,
    price_monthly: body.price_monthly || 0,
    price_yearly: body.price_yearly || 0,
    max_users: body.max_users || 10,
    max_storage_gb: body.max_storage_gb || 5,
    features: body.features || [],
    is_active: true,
    created_at: new Date().toISOString()
  };

  subscriptionPlans.push(newPlan);

  // 记录操作日志
  addOperationLog(
    'CREATE_PLAN',
    'plan',
    newPlan.id,
    newPlan.display_name,
    `创建新套餐：${newPlan.display_name}`
  );

  return HttpResponse.json({
    code: 200,
    message: '套餐创建成功',
    data: newPlan
  });
});

/**
 * 更新订阅套餐
 * PUT /api/platform/plans/{id}
 */
const updatePlanHandler: RequestHandler = http.put('/api/platform/plans/:id', async ({ params, request }) => {
  const planId = params.id as string;
  const body = await request.json() as Partial<SubscriptionPlanInfo>;

  const planIndex = subscriptionPlans.findIndex(p => p.id === planId);
  if (planIndex === -1) {
    return HttpResponse.json({
      code: 404,
      message: '套餐不存在'
    }, { status: 404 });
  }

  // 更新套餐
  subscriptionPlans[planIndex] = {
    ...subscriptionPlans[planIndex],
    ...body,
    id: planId // 确保ID不被更改
  };

  // 记录操作日志
  addOperationLog(
    'UPDATE_PLAN',
    'plan',
    planId,
    subscriptionPlans[planIndex].display_name,
    `更新套餐：${subscriptionPlans[planIndex].display_name}`
  );

  return HttpResponse.json({
    code: 200,
    message: '套餐更新成功',
    data: subscriptionPlans[planIndex]
  });
});

/**
 * 获取操作日志
 * GET /api/platform/logs?page=1&size=20
 */
const getLogsHandler: RequestHandler = http.get('/api/platform/logs', ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '20');

  // 分页
  const total = operationLogs.length;
  const start = (page - 1) * size;
  const end = start + size;
  const pagedData = operationLogs.slice(start, end);

  return HttpResponse.json({
    code: 200,
    message: '获取操作日志成功',
    data: {
      logs: pagedData,
      pagination: {
        page,
        size,
        total,
        pages: Math.ceil(total / size)
      }
    }
  });
});

/**
 * 模拟登录到工厂
 * POST /api/platform/factories/{id}/simulate-login
 */
const simulateLoginHandler: RequestHandler = http.post('/api/platform/factories/:id/simulate-login', ({ params }) => {
  const factoryId = params.id as string;

  const factory = factories.find(f => f.id === factoryId);
  if (!factory) {
    return HttpResponse.json({
      code: 404,
      message: '工厂不存在'
    }, { status: 404 });
  }

  if (factory.status !== 'active') {
    return HttpResponse.json({
      code: 400,
      message: '只能模拟登录到激活状态的工厂'
    }, { status: 400 });
  }

  // 记录操作日志
  addOperationLog(
    'SIMULATE_LOGIN',
    'factory',
    factoryId,
    factory.name,
    `模拟登录到工厂：${factory.name}`
  );

  // 返回模拟的工厂管理员令牌
  return HttpResponse.json({
    code: 200,
    message: '模拟登录成功',
    data: {
      token: `factory_admin_token_${factoryId}_${Date.now()}`,
      factory_id: factoryId,
      factory_name: factory.name,
      redirect_url: `/dashboard?factory=${factoryId}`
    }
  });
});

// 导出所有平台管理handlers
export const platformHandlers: RequestHandler[] = [
  getOverviewHandler,
  getFactoriesHandler,
  createFactoryHandler,
  updateFactoryStatusHandler,
  getPlansHandler,
  createPlanHandler,
  updatePlanHandler,
  getLogsHandler,
  simulateLoginHandler
];

export default platformHandlers;
