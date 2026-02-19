/**
 * 餐饮/工厂双模式 composable
 * 根据工厂类型自动切换术语
 */
import { computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';

export type BusinessMode = 'FACTORY' | 'RESTAURANT' | 'HEADQUARTERS';

const FACTORY_LABELS = {
  rawMaterial: '原材料',
  product: '成品',
  purchase: '采购',
  sales: '销售',
  transfer: '调拨',
  supplier: '供应商',
  customer: '客户',
  warehouse: '仓库',
  production: '生产',
  batch: '生产批次',
  delivery: '发货',
  receive: '收货',
  inventory: '库存',
  finishedGoods: '成品库存',
  purchaseOrder: '采购订单',
  salesOrder: '销售订单',
} as const;

const RESTAURANT_LABELS = {
  rawMaterial: '食材',
  product: '菜品',
  purchase: '进货',
  sales: '出餐/外卖',
  transfer: '调拨',
  supplier: '供货商',
  customer: '客户/平台',
  warehouse: '后厨仓库',
  production: '备餐',
  batch: '备货批次',
  delivery: '配送',
  receive: '验收',
  inventory: '库存',
  finishedGoods: '菜品库存',
  purchaseOrder: '进货单',
  salesOrder: '出餐单',
} as const;

export type LabelKey = keyof typeof FACTORY_LABELS;

export function useBusinessMode() {
  const authStore = useAuthStore();

  const factoryType = computed(() => {
    const user = authStore.user;
    if (!user) return 'FACTORY';
    // factoryType stored in user.factoryUser after login
    return (user as any).factoryType || 'FACTORY';
  });

  const mode = computed<BusinessMode>(() => {
    const t = factoryType.value;
    if (t === 'RESTAURANT' || t === 'CENTRAL_KITCHEN') return 'RESTAURANT';
    if (t === 'HEADQUARTERS') return 'HEADQUARTERS';
    return 'FACTORY';
  });

  const isFactory = computed(() => mode.value === 'FACTORY');
  const isRestaurant = computed(() => mode.value === 'RESTAURANT');
  const isHeadquarters = computed(() => mode.value === 'HEADQUARTERS');

  const labels = computed(() => {
    return mode.value === 'RESTAURANT' ? RESTAURANT_LABELS : FACTORY_LABELS;
  });

  function label(key: LabelKey): string {
    return labels.value[key];
  }

  return {
    mode,
    isFactory,
    isRestaurant,
    isHeadquarters,
    labels,
    label,
  };
}
