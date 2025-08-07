/**
 * 平台管理Mock数据
 * 支持多租户工厂管理、订阅套餐、操作日志等功能
 */

// 工厂状态枚举
export type FactoryStatus = 'active' | 'suspended' | 'pending' | 'deleted';

// 订阅套餐类型
export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise' | 'trial';

// 工厂信息接口
export interface Factory {
  id: string;
  name: string;
  industry: string;
  status: FactoryStatus;
  subscription_plan: SubscriptionPlan;
  employee_count: number;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  contact_address: string;
  created_at: string;
  updated_at: string;
  last_active_at: string;
  monthly_revenue: number;
  data_usage_gb: number;
}

// 订阅套餐信息
export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_storage_gb: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

// 操作日志
export interface OperationLog {
  id: string;
  operator_id: string;
  operator_name: string;
  action: string;
  target_type: 'factory' | 'user' | 'plan' | 'system';
  target_id: string;
  target_name: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// 员工状态枚举
export type EmployeeStatus = 'active' | 'inactive' | 'suspended';

// 员工信息接口
export interface Employee {
  id: string;
  factory_id: string;
  username: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  role: string;
  status: EmployeeStatus;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// 白名单状态枚举
export type WhitelistStatus = 'active' | 'expired' | 'suspended';

// 白名单信息接口
export interface Whitelist {
  id: string;
  factory_id: string;
  factory_name: string;
  identifier: string;        // 标识符（手机号、邮箱等）
  identifier_type: 'phone' | 'email' | 'id_card';
  name?: string;            // 姓名
  department?: string;      // 部门
  position?: string;        // 职位
  status: WhitelistStatus;
  expires_at?: string;      // 过期时间
  created_by: string;       // 创建者ID
  created_by_name: string;  // 创建者姓名
  created_at: string;
  updated_at: string;
  last_used_at?: string;    // 最后使用时间
}

// 平台概览统计
export interface PlatformOverview {
  total_factories: number;
  active_factories: number;
  pending_factories: number;
  suspended_factories: number;
  total_users: number;
  total_revenue: number;
  data_usage_total_gb: number;
  monthly_growth_rate: number;
  daily_active_factories: number[];
  revenue_trend: { date: string; revenue: number }[];
}

// Mock工厂数据
export const mockFactories: Factory[] = [
  {
    id: 'factory_001',
    name: '山东第一肉联厂',
    industry: '肉类加工',
    status: 'active',
    subscription_plan: 'premium',
    employee_count: 145,
    owner_user_id: 'user_factory_001',
    owner_name: '王建国',
    owner_email: 'wang@sdfood.com',
    owner_phone: '13800138001',
    contact_address: '山东省济南市历下区工业园区88号',
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-12-20T15:45:00Z',
    last_active_at: '2024-12-20T15:45:00Z',
    monthly_revenue: 28500,
    data_usage_gb: 12.5
  },
  {
    id: 'factory_002',
    name: '广东海鲜加工有限公司',
    industry: '海鲜加工',
    status: 'active',
    subscription_plan: 'enterprise',
    employee_count: 289,
    owner_user_id: 'user_factory_002',
    owner_name: '陈海涛',
    owner_email: 'chen@gdseafood.com',
    owner_phone: '13800138002',
    contact_address: '广东省广州市白云区海鲜工业区66号',
    created_at: '2024-02-20T10:15:00Z',
    updated_at: '2024-12-19T09:20:00Z',
    last_active_at: '2024-12-19T16:30:00Z',
    monthly_revenue: 45600,
    data_usage_gb: 28.3
  },
  {
    id: 'factory_003',
    name: '四川农产品深加工集团',
    industry: '农产品加工',
    status: 'active',
    subscription_plan: 'premium',
    employee_count: 198,
    owner_user_id: 'user_factory_003',
    owner_name: '李明华',
    owner_email: 'li@scagri.com',
    owner_phone: '13800138003',
    contact_address: '四川省成都市双流区农业园区168号',
    created_at: '2024-03-10T14:20:00Z',
    updated_at: '2024-12-18T11:10:00Z',
    last_active_at: '2024-12-20T08:15:00Z',
    monthly_revenue: 32100,
    data_usage_gb: 18.7
  },
  {
    id: 'factory_004',
    name: '新疆牛羊肉加工厂',
    industry: '畜牧加工',
    status: 'suspended',
    subscription_plan: 'basic',
    employee_count: 67,
    owner_user_id: 'user_factory_004',
    owner_name: '阿里木江',
    owner_email: 'ali@xjmeat.com',
    owner_phone: '13800138004',
    contact_address: '新疆维吾尔自治区乌鲁木齐市经开区牧业街22号',
    created_at: '2024-05-05T16:45:00Z',
    updated_at: '2024-11-30T13:25:00Z',
    last_active_at: '2024-11-28T17:40:00Z',
    monthly_revenue: 0,
    data_usage_gb: 5.2
  },
  {
    id: 'factory_005',
    name: '江苏绿色蔬菜配送中心',
    industry: '蔬菜配送',
    status: 'pending',
    subscription_plan: 'trial',
    employee_count: 34,
    owner_user_id: 'user_factory_005',
    owner_name: '张玉梅',
    owner_email: 'zhang@jsvege.com',
    owner_phone: '13800138005',
    contact_address: '江苏省南京市江宁区蔬菜基地路99号',
    created_at: '2024-12-15T09:30:00Z',
    updated_at: '2024-12-15T09:30:00Z',
    last_active_at: '2024-12-15T09:30:00Z',
    monthly_revenue: 0,
    data_usage_gb: 0.8
  }
];

// Mock订阅套餐数据
export const mockSubscriptionPlans: SubscriptionPlanInfo[] = [
  {
    id: 'plan_trial',
    name: 'trial',
    display_name: '试用版',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 5,
    max_storage_gb: 1,
    features: [
      '基础溯源功能',
      '最多5个用户',
      '1GB存储空间',
      '邮件客服支持'
    ],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'plan_basic',
    name: 'basic',
    display_name: '基础版',
    price_monthly: 299,
    price_yearly: 2990,
    max_users: 20,
    max_storage_gb: 10,
    features: [
      '完整溯源功能',
      '最多20个用户',
      '10GB存储空间',
      '基础报表',
      '在线客服支持'
    ],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'plan_premium',
    name: 'premium',
    display_name: '专业版',
    price_monthly: 599,
    price_yearly: 5990,
    max_users: 50,
    max_storage_gb: 50,
    features: [
      '高级溯源功能',
      '最多50个用户',
      '50GB存储空间',
      '高级报表和分析',
      'API接口',
      '电话客服支持',
      '数据备份'
    ],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'plan_enterprise',
    name: 'enterprise',
    display_name: '企业版',
    price_monthly: 1299,
    price_yearly: 12990,
    max_users: 200,
    max_storage_gb: 200,
    features: [
      '企业级溯源功能',
      '最多200个用户',
      '200GB存储空间',
      '定制化报表',
      '完整API访问',
      '专属客服经理',
      '实时数据备份',
      'SLA保证',
      '私有化部署支持'
    ],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

// Mock操作日志数据
export const mockOperationLogs: OperationLog[] = [
  {
    id: 'log_001',
    operator_id: 'platform_admin_001',
    operator_name: '平台管理员',
    action: 'CREATE_FACTORY',
    target_type: 'factory',
    target_id: 'factory_005',
    target_name: '江苏绿色蔬菜配送中心',
    description: '创建新工厂：江苏绿色蔬菜配送中心',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    created_at: '2024-12-15T09:30:00Z'
  },
  {
    id: 'log_002',
    operator_id: 'platform_admin_001',
    operator_name: '平台管理员',
    action: 'SUSPEND_FACTORY',
    target_type: 'factory',
    target_id: 'factory_004',
    target_name: '新疆牛羊肉加工厂',
    description: '暂停工厂：新疆牛羊肉加工厂（原因：未及时续费）',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    created_at: '2024-11-30T13:25:00Z'
  },
  {
    id: 'log_003',
    operator_id: 'platform_admin_001',
    operator_name: '平台管理员',
    action: 'UPDATE_PLAN',
    target_type: 'plan',
    target_id: 'plan_premium',
    target_name: '专业版',
    description: '更新订阅套餐：专业版价格调整',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    created_at: '2024-12-10T14:20:00Z'
  }
];

// Mock概览统计数据
export const mockPlatformOverview: PlatformOverview = {
  total_factories: 5,
  active_factories: 3,
  pending_factories: 1,
  suspended_factories: 1,
  total_users: 733,
  total_revenue: 106200,
  data_usage_total_gb: 65.5,
  monthly_growth_rate: 12.5,
  daily_active_factories: [2, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 2, 3],
  revenue_trend: [
    { date: '2024-12-01', revenue: 98500 },
    { date: '2024-12-02', revenue: 99200 },
    { date: '2024-12-03', revenue: 101800 },
    { date: '2024-12-04', revenue: 103500 },
    { date: '2024-12-05', revenue: 105200 },
    { date: '2024-12-06', revenue: 106200 }
  ]
};

// 生成新工厂ID的辅助函数
export const generateFactoryId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `factory_${timestamp}_${random}`;
};

// 生成新用户ID的辅助函数
export const generateUserId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `user_factory_${timestamp}_${random}`;
};

// 生成新日志ID的辅助函数
export const generateLogId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `log_${timestamp}_${random}`;
};
