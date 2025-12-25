/**
 * Mock数据服务
 * 用于前端开发和测试，模拟后端API返回的数据
 *
 * 使用方法：
 * import { mockUsers, mockSuppliers } from '@/services/mockData';
 *
 * ⚠️ 警告：Mock数据仅用于开发环境，不应在生产环境使用
 *
 * 数据来源：所有mock数据从JSON文件加载，便于维护和更新
 * 数据位置：/src/services/mockData/data/*.json
 */

import { UserDTO } from '../api/userApiClient';
import { WhitelistDTO } from '../api/whitelistApiClient';
import { Customer } from '../api/customerApiClient';

// 环境检查：禁止在生产环境使用mock数据
if (!__DEV__) {
  console.error('⚠️ WARNING: Mock data should not be used in production!');
  throw new Error('Mock data is disabled in production environment');
}

// 从JSON文件加载mock数据
import usersData from './data/users.json';
import whitelistData from './data/whitelist.json';
import suppliersData from './data/suppliers.json';
import customersData from './data/customers.json';
import materialBatchesData from './data/materialBatches.json';
import productTypesData from './data/productTypes.json';
import materialTypesData from './data/materialTypes.json';
import workTypesData from './data/workTypes.json';
import conversionRatesData from './data/conversionRates.json';
import productionPlansData from './data/productionPlans.json';
import attendanceRecordsData from './data/attendanceRecords.json';
import timeStatisticsData from './data/timeStatistics.json';

// ========== 导出类型化的Mock数据 ==========

export const mockUsers: UserDTO[] = usersData.data;
export const mockWhitelist = whitelistData.data as WhitelistDTO[];
export const mockSuppliers = suppliersData.data;
export const mockCustomers = customersData.data as Customer[];
export const mockMaterialBatches = materialBatchesData.data;
export const mockProductTypes = productTypesData.data;
export const mockMaterialTypes = materialTypesData.data;
export const mockWorkTypes = workTypesData.data;
export const mockConversionRates = conversionRatesData.data;
export const mockProductionPlans = productionPlansData.data;
export const mockAttendanceRecords = attendanceRecordsData.data;
export const mockTimeStatistics = timeStatisticsData.data;

// ========== 导出所有Mock数据集合 ==========

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

// Log confirmation that mock data has been loaded from JSON files
console.log('📦 Mock data loaded from JSON files (development mode only)');
