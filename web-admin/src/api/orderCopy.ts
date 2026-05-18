// 复制订单 API client — #860 follow-up (2026-05-18).
//
// Backend endpoints (mirror create*Order RBAC):
//   POST /api/mobile/{factoryId}/purchase/orders/{orderId}/copy
//   POST /api/mobile/{factoryId}/sales/orders/{orderId}/copy
//   POST /api/mobile/{factoryId}/production-plans/{planId}/copy
//
// axios baseURL = '/api/mobile' so caller-side URLs start at "/{factoryId}/...".
// 同 priceHistory.ts / customerTracking.ts 模式 (PR #857 fix #1 — 不带 /mobile/ 前缀).
import { post } from './request';

/** 采购订单复制响应 (后端 PurchaseOrder entity 完整字段). */
export interface CopiedPurchaseOrder {
  id: string;
  orderNumber: string;
  factoryId: string;
  supplierId: string;
  status: string;
  totalAmount?: number | null;
  [key: string]: unknown;
}

/** 销售订单复制响应 (后端 SalesOrder entity 完整字段). */
export interface CopiedSalesOrder {
  id: string;
  orderNumber: string;
  factoryId: string;
  customerId: string;
  status: string;
  totalAmount?: number | null;
  [key: string]: unknown;
}

/** 生产计划复制响应 (后端 ProductionPlanDTO 完整字段). */
export interface CopiedProductionPlan {
  id: string;
  planNumber: string;
  factoryId: string;
  productTypeId: string;
  status: string;
  plannedQuantity?: number | null;
  [key: string]: unknown;
}

/**
 * 复制采购订单 → 新草稿 (status=DRAFT, 复用供应商/品项/价格).
 * 后端不复制审批/到货状态. 异常走 axios interceptor (沿用 #860 sticky toast 模式).
 */
export function copyPurchaseOrder(factoryId: string, orderId: string) {
  return post<CopiedPurchaseOrder>(
    `/${factoryId}/purchase/orders/${orderId}/copy`
  );
}

/**
 * 复制销售订单 → 新草稿 (status=DRAFT, 复用客户/品项/价格).
 * 后端不复制审批/发货/收款状态.
 */
export function copySalesOrder(factoryId: string, orderId: string) {
  return post<CopiedSalesOrder>(
    `/${factoryId}/sales/orders/${orderId}/copy`
  );
}

/**
 * 复制生产计划 → 新草稿 (status=PENDING, 复用产品/数量/日期/成本预估).
 * 后端不复制实际值/审批/锁定状态. 跳过 SO source / Canvas validation.
 */
export function copyProductionPlan(factoryId: string, planId: string) {
  return post<CopiedProductionPlan>(
    `/${factoryId}/production-plans/${planId}/copy`
  );
}
