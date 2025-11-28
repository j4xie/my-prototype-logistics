/**
 * FactoryId Helper - 工厂ID管理工具
 *
 * 本模块提供了统一的 factoryId 获取和管理功能，解决以下问题：
 * 1. ✅ 登录时不需要 factoryId（后端自动识别）
 * 2. ✅ 工厂用户自动使用其 factoryId
 * 3. ✅ 平台管理员明确指定要访问的工厂
 * 4. ✅ 避免使用硬编码的默认 factoryId
 *
 * ## 使用场景
 *
 * ### 场景1: 工厂用户访问自己工厂的数据（最常见）
 * ```typescript
 * // API 客户端
 * class ProcessingApiClient {
 *   private getPath(factoryId?: string) {
 *     const id = requireFactoryId(factoryId); // 自动从登录用户获取
 *     return `/api/mobile/${id}/processing`;
 *   }
 *
 *   async getBatches() {
 *     // 工厂用户调用时，factoryId 自动使用其工厂ID
 *     return apiClient.get(this.getPath());
 *   }
 * }
 * ```
 *
 * ### 场景2: 平台管理员访问指定工厂的数据
 * ```typescript
 * // UI 组件
 * function DashboardScreen() {
 *   const [selectedFactory, setSelectedFactory] = useState('F001');
 *
 *   async function loadData() {
 *     // 平台管理员必须提供 factoryId
 *     const data = await dashboardApiClient.getOverview({
 *       factoryId: selectedFactory  // ✅ 明确指定
 *     });
 *   }
 * }
 * ```
 *
 * ### 场景3: 认证相关API（不需要 factoryId）
 * ```typescript
 * // 登录服务
 * async function login(credentials) {
 *   // ✅ 直接调用，不涉及 factoryId
 *   const response = await apiClient.post('/api/mobile/auth/unified-login', credentials);
 * }
 * ```
 *
 * ### 场景4: 检查用户类型
 * ```typescript
 * if (isFactoryUser()) {
 *   // 工厂用户逻辑
 *   navigation.navigate('FactoryDashboard');
 * } else if (isPlatformAdmin()) {
 *   // 平台管理员逻辑
 *   navigation.navigate('FactorySelector');
 * }
 * ```
 *
 * ## 常见错误和解决方法
 *
 * ❌ 错误1: "平台管理员必须明确指定 factoryId 参数"
 * ```typescript
 * // 错误代码
 * const data = await dashboardApiClient.getOverview();
 *
 * // ✅ 正确代码
 * const data = await dashboardApiClient.getOverview({ factoryId: 'F001' });
 * ```
 *
 * ❌ 错误2: "未登录，无法获取 factoryId"
 * ```typescript
 * // 解决方法: 在调用API前检查登录状态
 * const user = useAuthStore.getState().user;
 * if (!user) {
 *   navigation.navigate('Login');
 *   return;
 * }
 * ```
 *
 * @module factoryIdHelper
 */

import { useAuthStore } from '../store/authStore';
import { getFactoryId as getFactoryIdFromUser } from '../types/auth';
import { DEFAULT_FACTORY_ID } from '../constants/config';
import { logger } from './logger';

const helperLogger = logger.createContextLogger('FactoryIdHelper');

/**
 * FactoryId 获取策略
 *
 * 用于明确不同 API 场景对 factoryId 的需求
 */
export enum FactoryIdStrategy {
  /**
   * 必需策略 - factoryId 是必须的
   * - 工厂用户：自动从登录信息获取
   * - 平台管理员：必须显式提供，否则抛出错误
   *
   * 适用场景：大部分工厂范围的业务 API
   */
  REQUIRED = 'required',

  /**
   * 用户优先策略 - 优先从用户获取
   * - 工厂用户：自动从登录信息获取
   * - 平台管理员：返回 undefined（不抛错）
   *
   * 适用场景：可选的工厂相关功能
   */
  FROM_USER = 'from_user',

  /**
   * 可选策略 - factoryId 可选
   * - 尽力从用户获取，失败时返回 undefined
   * - 不会抛出错误
   *
   * 适用场景：公共资源、统计数据等
   */
  OPTIONAL = 'optional',

  /**
   * 平台管理员策略 - 必须显式提供
   * - 必须通过参数传入 factoryId
   * - 不会从登录用户获取
   * - 缺失时抛出明确错误
   *
   * 适用场景：平台管理功能、多工厂报表等
   */
  PLATFORM_ADMIN = 'platform_admin'
}

/**
 * 根据策略获取 factoryId
 *
 * @param providedFactoryId 调用时提供的 factoryId（可选）
 * @param strategy 获取策略，默认 FROM_USER
 * @returns factoryId 字符串，或 undefined（取决于策略）
 * @throws Error 当策略为 REQUIRED 或 PLATFORM_ADMIN 且无法获取时
 *
 * @example
 * // 工厂用户调用
 * const factoryId = getFactoryId(undefined, FactoryIdStrategy.REQUIRED);
 * // → 自动从登录用户获取
 *
 * @example
 * // 平台管理员调用（必须提供）
 * const factoryId = getFactoryId('F001', FactoryIdStrategy.REQUIRED);
 * // → 使用提供的 'F001'
 *
 * @example
 * // 平台管理员忘记提供
 * const factoryId = getFactoryId(undefined, FactoryIdStrategy.REQUIRED);
 * // → 抛出错误: "平台管理员必须明确指定 factoryId 参数"
 */
export function getFactoryId(
  providedFactoryId?: string,
  strategy: FactoryIdStrategy = FactoryIdStrategy.FROM_USER
): string | undefined {
  // 1. 如果明确提供了 factoryId，直接使用
  if (providedFactoryId?.trim()) {
    helperLogger.debug('使用提供的 factoryId', { factoryId: providedFactoryId, strategy });
    return providedFactoryId;
  }

  // 2. 获取当前登录用户
  const user = useAuthStore.getState().user;

  // 3. 根据策略处理
  switch (strategy) {
    case FactoryIdStrategy.REQUIRED:
      // 必需策略：必须有 factoryId
      if (!user) {
        throw new Error('未登录，无法获取 factoryId。请先登录。');
      }

      if (user.userType === 'platform') {
        throw new Error('平台管理员必须明确指定 factoryId 参数（如: { factoryId: "F001" }）');
      }

      const requiredFactoryId = getFactoryIdFromUser(user);
      if (!requiredFactoryId) {
        throw new Error('无法从用户信息获取 factoryId');
      }

      helperLogger.debug('从用户获取 factoryId (REQUIRED)', { factoryId: requiredFactoryId });
      return requiredFactoryId;

    case FactoryIdStrategy.FROM_USER:
      // 用户优先策略：从工厂用户获取，平台用户返回 undefined
      if (user?.userType === 'factory') {
        const userFactoryId = getFactoryIdFromUser(user);
        helperLogger.debug('从用户获取 factoryId (FROM_USER)', { factoryId: userFactoryId });
        return userFactoryId;
      }

      helperLogger.debug('用户不是工厂用户，返回 undefined', { userType: user?.userType });
      return undefined;

    case FactoryIdStrategy.PLATFORM_ADMIN:
      // 平台管理员策略：必须显式提供
      throw new Error(
        '平台管理员访问工厂数据时必须提供 factoryId 参数。' +
        '例如: getOverview({ factoryId: "F001" })'
      );

    case FactoryIdStrategy.OPTIONAL:
      // 可选策略：尽力获取，失败时返回 undefined
      if (user?.userType === 'factory') {
        const optionalFactoryId = getFactoryIdFromUser(user);
        helperLogger.debug('从用户获取 factoryId (OPTIONAL)', { factoryId: optionalFactoryId });
        return optionalFactoryId;
      }

      helperLogger.debug('无法获取 factoryId，返回 undefined (OPTIONAL)');
      return undefined;

    default:
      helperLogger.warn('未知策略，返回 undefined', { strategy });
      return undefined;
  }
}

/**
 * 从当前登录用户获取 factoryId（向后兼容）
 *
 * 优先级：
 * 1. 如果提供了 factoryId 参数，直接使用
 * 2. 如果用户已登录且是工厂用户，使用用户的 factoryId
 * 3. 否则返回空字符串（不使用默认值，避免错误）
 *
 * @deprecated 建议使用 getFactoryId() 并指定策略
 * @param providedFactoryId 调用时提供的 factoryId（可选）
 * @returns factoryId 字符串，如果无法确定则返回空字符串
 */
export function getCurrentFactoryId(providedFactoryId?: string): string {
  const factoryId = getFactoryId(providedFactoryId, FactoryIdStrategy.FROM_USER);
  return factoryId || '';
}

/**
 * 获取 factoryId，如果无法确定则使用默认值（仅用于特殊情况）
 * 
 * 注意：此函数仅在确实需要默认值的场景使用（如未登录时的公共接口）
 * 大多数情况下应该使用 getCurrentFactoryId
 * 
 * @param providedFactoryId 调用时提供的 factoryId（可选）
 * @returns factoryId 字符串
 */
export function getFactoryIdWithFallback(providedFactoryId?: string): string {
  const factoryId = getCurrentFactoryId(providedFactoryId);
  if (factoryId) {
    return factoryId;
  }
  
  // 仅在确实需要默认值的情况下使用
  helperLogger.debug('使用默认 factoryId', { factoryId: DEFAULT_FACTORY_ID });
  return DEFAULT_FACTORY_ID;
}

/**
 * 验证 factoryId 是否有效
 *
 * @param factoryId 要验证的 factoryId
 * @returns 是否有效
 */
export function isValidFactoryId(factoryId: string | null | undefined): boolean {
  return !!(factoryId && factoryId.trim() !== '');
}

/**
 * 检查当前用户是否为工厂用户
 *
 * @returns 是否为工厂用户
 */
export function isFactoryUser(): boolean {
  const user = useAuthStore.getState().user;
  return user?.userType === 'factory';
}

/**
 * 检查当前用户是否为平台管理员
 *
 * @returns 是否为平台管理员
 */
export function isPlatformAdmin(): boolean {
  const user = useAuthStore.getState().user;
  return user?.userType === 'platform';
}

/**
 * 获取 factoryId，如果无法获取则抛出错误
 *
 * 适用场景：必须有 factoryId 才能执行的操作
 *
 * @param providedFactoryId 调用时提供的 factoryId（可选）
 * @returns factoryId 字符串
 * @throws Error 无法获取 factoryId 时
 *
 * @example
 * // 在 API 客户端中使用
 * private getPath(providedFactoryId?: string) {
 *   const factoryId = requireFactoryId(providedFactoryId);
 *   return `/api/mobile/${factoryId}/batches`;
 * }
 */
export function requireFactoryId(providedFactoryId?: string): string {
  const factoryId = getFactoryId(providedFactoryId, FactoryIdStrategy.REQUIRED);
  if (!factoryId) {
    throw new Error('无法确定 factoryId，请确保已登录或提供 factoryId 参数');
  }
  return factoryId;
}

