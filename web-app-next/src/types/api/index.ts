/**
 * API类型声明统一导出
 * @description TASK-P3-019A Day 0 - 统一类型声明包
 * @created 2025-06-03
 */

// 基础类型
export * from './shared/base';

// 业务模块类型
export * from './farming';
export * from './processing';
export * from './logistics';
export * from './admin';

// 重新导出常用类型
export type {
  BaseResponse,
  PaginatedResponse,
  BaseEntity,
  Location,
  UserInfo,
  ApiError,
  OperationResult,
  HttpMethod,
  ApiStatusCode
} from './shared/base';

// 农业模块常用类型
export type {
  Field,
  Crop,
  PlantingPlan,
  FarmActivity,
  HarvestRecord,
  FarmingDashboard
} from './farming';

// 加工模块常用类型
export type {
  RawMaterial,
  ProductionBatch,
  FinishedProduct,
  QualityTest,
  ProcessingDashboard
} from './processing';

// 物流模块常用类型
export type {
  TransportOrder,
  Vehicle,
  Driver,
  Warehouse,
  InventoryItem,
  LogisticsDashboard
} from './logistics';

// 管理模块常用类型
export type {
  User,
  Role,
  Permission,
  AuditLog,
  SystemConfig,
  Notification,
  AdminDashboard
} from './admin';
