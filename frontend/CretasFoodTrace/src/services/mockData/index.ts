/**
 * Mock数据服务
 * 用于前端开发和测试，模拟后端API返回的数据
 *
 * 使用方法：
 * import { mockUsers, mockSuppliers } from '@/services/mockData';
 */

import { UserDTO } from '../api/userApiClient';
import { WhitelistDTO } from '../api/whitelistApiClient';
import { Customer } from '../api/customerApiClient';

// ========== 用户Mock数据 ==========

export const mockUsers: UserDTO[] = [
  {
    id: 1,
    username: 'super_admin',
    realName: '张三',
    phone: '+8613800138001',
    email: 'zhangsan@test.com',
    role: 'factory_super_admin',
    department: 'management',
    position: '工厂总经理',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'dept_admin',
    realName: '李四',
    phone: '+8613800138002',
    role: 'department_admin',
    department: 'processing',
    position: '加工部主管',
    isActive: true,
    createdAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 3,
    username: 'operator1',
    realName: '王五',
    phone: '+8613800138003',
    role: 'operator',
    department: 'processing',
    position: '加工工',
    isActive: true,
    createdAt: '2025-01-03T00:00:00Z',
  },
  {
    id: 4,
    username: 'operator2',
    realName: '赵六',
    phone: '+8613800138004',
    role: 'operator',
    department: 'processing',
    position: '加工工',
    isActive: true,
    createdAt: '2025-01-04T00:00:00Z',
  },
  {
    id: 5,
    username: 'quality_admin',
    realName: '孙七',
    phone: '+8613800138005',
    role: 'department_admin',
    department: 'quality',
    position: '质检部主管',
    isActive: true,
    createdAt: '2025-01-05T00:00:00Z',
  },
];

// ========== 白名单Mock数据 ==========

export const mockWhitelist: WhitelistDTO[] = [
  {
    id: 1,
    phoneNumber: '+8613900139001',
    realName: '待注册用户1',
    role: 'operator',
    department: 'processing',
    status: 'PENDING',
    maxUsageCount: 1,
    usedCount: 0,
    createdBy: 'super_admin',
    createdAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 2,
    phoneNumber: '+8613900139002',
    realName: '已注册用户',
    role: 'operator',
    department: 'processing',
    status: 'ACTIVE',
    maxUsageCount: 1,
    usedCount: 1,
    createdBy: 'super_admin',
    createdAt: '2025-01-09T00:00:00Z',
  },
];

// ========== 供应商Mock数据 ==========

export const mockSuppliers = [
  {
    id: '1',
    factoryId: 'TEST_2024_001',
    supplierCode: 'SUP001',
    code: 'SUP001',
    name: '优质海鲜供应商',
    contactPerson: '刘经理',
    contactPhone: '+8613800001001',
    email: 'liu@supplier1.com',
    address: '广东省广州市海鲜批发市场A区101',
    businessType: '海鲜批发',
    category: '海鲜类',
    isActive: true,
    createdAt: '2024-12-01T00:00:00Z',
  },
  {
    id: '2',
    supplierCode: 'SUP002',
    code: 'SUP002',
    name: '新鲜肉类供应',
    contactPerson: '陈经理',
    contactPhone: '+8613800001002',
    address: '广东省深圳市肉类批发中心',
    businessType: '肉类批发',
    category: '肉类',
    isActive: true,
    createdAt: '2024-12-05T00:00:00Z',
  },
  {
    id: '3',
    supplierCode: 'SUP003',
    code: 'SUP003',
    name: '冻货专营',
    contactPerson: '周经理',
    contactPhone: '+8613800001003',
    address: '广东省佛山市冷链物流园',
    businessType: '冻货批发',
    category: '冻货',
    isActive: true,
    createdAt: '2024-12-10T00:00:00Z',
  },
];

// ========== 客户Mock数据 ==========

export const mockCustomers: Customer[] = [
  {
    id: '1',
    factoryId: 'TEST_2024_001',
    customerCode: 'CUS001',
    code: 'CUS001',
    name: '海鲜餐厅连锁',
    contactPerson: '王总',
    contactPhone: '+8613900001001',
    email: 'wang@restaurant.com',
    address: '广东省广州市天河区美食街88号',
    businessType: '餐饮',
    customerType: 'retailer',
    industry: '餐饮',
    isActive: true,
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: '2',
    customerCode: 'CUS002',
    code: 'CUS002',
    name: '大型超市',
    contactPerson: '李采购',
    contactPhone: '+8613900001002',
    address: '广东省深圳市罗湖区',
    businessType: '零售',
    customerType: 'distributor',
    industry: '零售',
    isActive: true,
    createdAt: '2024-11-05T00:00:00Z',
  },
  {
    id: '3',
    customerCode: 'CUS003',
    code: 'CUS003',
    name: '电商平台',
    contactPerson: '赵总监',
    contactPhone: '+8613900001003',
    address: '广东省广州市番禺区',
    businessType: '电商',
    customerType: 'direct_consumer',
    industry: '电商',
    isActive: true,
    createdAt: '2024-11-10T00:00:00Z',
  },
];

// ========== 原材料批次Mock数据 ==========

export const mockMaterialBatches = [
  {
    id: 1,
    batchNumber: 'RAW_20250115_001',
    materialTypeId: 1,
    materialTypeName: '新鲜鲈鱼',
    supplierId: 1,
    supplierName: '优质海鲜供应商',
    quantity: 500,
    remainingQuantity: 350,
    unit: 'kg',
    purchasePrice: 28.5,
    receiveDate: '2025-01-15T08:00:00Z',
    productionDate: '2025-01-14',
    expiryDate: '2025-01-22',
    status: 'available',
    storageLocation: '冷藏区A-01',
    storageType: 'fresh',
    qualityStatus: 'passed',
    qualityGrade: 'A',
    qualityScore: 95,
  },
  {
    id: 2,
    batchNumber: 'RAW_20250113_002',
    materialTypeId: 2,
    materialTypeName: '冻三文鱼',
    supplierId: 3,
    supplierName: '冻货专营',
    quantity: 1000,
    remainingQuantity: 800,
    unit: 'kg',
    purchasePrice: 45.0,
    receiveDate: '2025-01-13T09:00:00Z',
    productionDate: '2024-12-20',
    expiryDate: '2025-02-13',
    status: 'available',
    storageLocation: '冷冻区B-05',
    storageType: 'frozen',
    qualityStatus: 'passed',
    qualityGrade: 'A',
    qualityScore: 92,
  },
  {
    id: 3,
    batchNumber: 'RAW_20250118_003',
    materialTypeId: 1,
    materialTypeName: '新鲜鲈鱼',
    supplierId: 1,
    supplierName: '优质海鲜供应商',
    quantity: 300,
    remainingQuantity: 50,
    unit: 'kg',
    purchasePrice: 29.0,
    receiveDate: '2025-01-18T08:30:00Z',
    productionDate: '2025-01-17',
    expiryDate: '2025-01-20',
    status: 'available',
    storageLocation: '冷藏区A-02',
    storageType: 'fresh',
    qualityStatus: 'passed',
    qualityGrade: 'B',
    qualityScore: 88,
    notes: '即将过期，请优先使用',
  },
];

// ========== 产品类型Mock数据 ==========

export const mockProductTypes = [
  {
    id: 1,
    code: 'PROD001',
    name: '精制鲈鱼片',
    category: '鱼片类',
    specification: '去骨去皮，200g/片',
    unit: 'kg',
    shelfLife: 3,
    storageConditions: '0-4°C冷藏',
    isActive: true,
    description: '高品质鲈鱼片，适合餐饮',
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'PROD002',
    name: '三文鱼片',
    category: '鱼片类',
    specification: '切片，150g/片',
    unit: 'kg',
    shelfLife: 5,
    storageConditions: '-18°C冷冻',
    isActive: true,
    createdAt: '2024-11-02T00:00:00Z',
  },
  {
    id: 3,
    code: 'PROD003',
    name: '鱼骨粉',
    category: '副产品',
    specification: '磨碎，用于饲料',
    unit: 'kg',
    shelfLife: 90,
    storageConditions: '常温干燥',
    isActive: true,
    createdAt: '2024-11-03T00:00:00Z',
  },
];

// ========== 原材料类型Mock数据 ==========

export const mockMaterialTypes = [
  {
    id: 1,
    code: 'MAT001',
    name: '新鲜鲈鱼',
    category: '海鲜类',
    specification: '活鱼，500-800g/条',
    unit: 'kg',
    shelfLife: 7,
    storageType: 'fresh',
    storageConditions: '0-4°C冷藏',
    isActive: true,
    createdAt: '2024-10-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'MAT002',
    name: '冻三文鱼',
    category: '海鲜类',
    specification: '整条，2-3kg/条',
    unit: 'kg',
    shelfLife: 30,
    storageType: 'frozen',
    storageConditions: '-18°C冷冻',
    isActive: true,
    createdAt: '2024-10-02T00:00:00Z',
  },
  {
    id: 3,
    code: 'MAT003',
    name: '新鲜带鱼',
    category: '海鲜类',
    specification: '中等大小',
    unit: 'kg',
    shelfLife: 5,
    storageType: 'fresh',
    storageConditions: '0-4°C冷藏',
    isActive: true,
    createdAt: '2024-10-03T00:00:00Z',
  },
];

// ========== 工作类型Mock数据 ==========

export const mockWorkTypes = [
  {
    id: 1,
    code: 'WORK001',
    name: '加工工',
    description: '负责鱼类加工处理',
    hourlyRate: 35,
    overtimeMultiplier: 1.5,
    department: 'processing',
    isActive: true,
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'WORK002',
    name: '质检员',
    description: '负责质量检验',
    hourlyRate: 40,
    overtimeMultiplier: 1.5,
    department: 'quality',
    isActive: true,
    createdAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 3,
    code: 'WORK003',
    name: '仓管员',
    description: '负责库存管理',
    hourlyRate: 32,
    overtimeMultiplier: 1.5,
    department: 'logistics',
    isActive: true,
    createdAt: '2024-09-01T00:00:00Z',
  },
];

// ========== 转换率Mock数据 ==========

export const mockConversionRates = [
  {
    id: 1,
    materialTypeId: '1',
    materialTypeName: '新鲜鲈鱼',
    productTypeId: '1',
    productTypeName: '精制鲈鱼片',
    conversionRate: 0.60,
    wastageRate: 0.05,
    isActive: true,
    notes: '包含去头、去骨、去皮的损耗',
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 2,
    materialTypeId: '2',
    materialTypeName: '冻三文鱼',
    productTypeId: '2',
    productTypeName: '三文鱼片',
    conversionRate: 0.65,
    wastageRate: 0.03,
    isActive: true,
    notes: '冻货损耗较少',
    createdAt: '2024-11-16T00:00:00Z',
  },
];

// ========== 生产计划Mock数据 ==========

export const mockProductionPlans = [
  {
    id: '1',
    planNumber: 'PLAN_20250118_001',
    factoryId: 'TEST_2024_001',
    productTypeId: '1',
    productType: {
      id: 1,
      name: '精制鲈鱼片',
      code: 'PROD001',
    },
    customerId: '1',
    customer: {
      id: '1',
      name: '海鲜餐厅连锁',
      code: 'CUS001',
    },
    plannedQuantity: 100,
    estimatedMaterialUsage: 175.4,
    actualQuantity: null,
    status: 'pending',
    notes: '餐厅急单，优先处理',
    createdAt: '2025-01-18T09:00:00Z',
  },
  {
    id: '2',
    planNumber: 'PLAN_20250117_001',
    factoryId: 'TEST_2024_001',
    productTypeId: '2',
    productType: {
      id: 2,
      name: '三文鱼片',
      code: 'PROD002',
    },
    customerId: '2',
    customer: {
      id: '2',
      name: '大型超市',
      code: 'CUS002',
    },
    plannedQuantity: 200,
    estimatedMaterialUsage: 323.1,
    actualQuantity: 205,
    status: 'completed',
    startTime: '2025-01-17T08:00:00Z',
    endTime: '2025-01-17T18:00:00Z',
    createdAt: '2025-01-17T07:00:00Z',
  },
];

// ========== 考勤打卡Mock数据 ==========

export const mockAttendanceRecords = [
  {
    id: 1,
    userId: 3,
    userName: '王五',
    clockInTime: '2025-01-18T08:05:00Z',
    clockOutTime: '2025-01-18T17:58:00Z',
    workDate: '2025-01-18',
    workTypeId: 1,
    workTypeName: '加工工',
    totalHours: 9.88,
    location: {
      latitude: 23.1291,
      longitude: 113.2644,
    },
    notes: '正常',
  },
  {
    id: 2,
    userId: 3,
    userName: '王五',
    clockInTime: '2025-01-17T08:02:00Z',
    clockOutTime: '2025-01-17T18:05:00Z',
    workDate: '2025-01-17',
    totalHours: 10.05,
    location: {
      latitude: 23.1291,
      longitude: 113.2644,
    },
  },
];

// ========== 工时统计Mock数据 ==========

export const mockTimeStatistics = {
  totalHours: 48.5,
  regularHours: 40.0,
  overtimeHours: 8.5,
  averageDailyHours: 9.7,
  period: '2025-01-13 至 2025-01-18',
  employeeRecords: [
    {
      userId: 3,
      userName: '王五',
      department: 'processing',
      totalHours: 48.5,
      regularHours: 40.0,
      overtimeHours: 8.5,
    },
    {
      userId: 4,
      userName: '赵六',
      department: 'processing',
      totalHours: 45.0,
      regularHours: 40.0,
      overtimeHours: 5.0,
    },
  ],
};

// ========== 导出所有Mock数据 ==========

export const MockData = {
  users: mockUsers,
  whitelist: mockWhitelist,
  suppliers: mockSuppliers,
  customers: mockCustomers,
  materialBatches: mockMaterialBatches,
  productTypes: mockProductTypes,
  materialTypes: mockMaterialTypes,
  workTypes: mockWorkTypes,
  conversionRates: mockConversionRates,
  productionPlans: mockProductionPlans,
  attendanceRecords: mockAttendanceRecords,
  timeStatistics: mockTimeStatistics,
};

export default MockData;
