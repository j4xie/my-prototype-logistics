import type { User, FactoryType } from '../types/auth';

/**
 * 获取用户的工厂类型
 */
export function getFactoryType(user: User | null): FactoryType {
  if (!user || user.userType !== 'factory') return 'FACTORY';
  const raw = user.factoryUser?.factoryType || 'FACTORY';
  return raw.toUpperCase() as FactoryType;
}

/**
 * 判断是否为餐饮场景
 */
export function isRestaurant(user: User | null): boolean {
  return getFactoryType(user) === 'RESTAURANT';
}

/**
 * 判断是否有生产能力（工厂/中央厨房有，餐饮/总部/分店无）
 */
export function hasProductionCapability(user: User | null): boolean {
  const type = getFactoryType(user);
  return type === 'FACTORY' || type === 'CENTRAL_KITCHEN';
}
