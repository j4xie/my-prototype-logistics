// Sprint 4 W2 S-PRICE-1 follow-up (2026-05-18) — 客户价格历史 API client.
//
// Backend: CustomerPriceHistoryController @RequestMapping
//   "/api/mobile/{factoryId}/customer-price-history"
//   GET ?customerId&productId&limit
//
// axios baseURL = '/api/mobile' so caller-side URLs start at "/{factoryId}/...".
// 同 customerTracking.ts 模式.
import { get } from './request';

export interface PriceHistoryEntry {
  /** UUID 主键 */
  id: string;
  factoryId: string;
  customerId: string;
  /** 产品类型 ID — backend 字段是 product_type_id (per CustomerPriceHistory entity) */
  productTypeId: string;
  /** 成交单价. 注意: 后端 @PriceSensitive — 无 procurement:price:view 权限角色看到 null. */
  unitPrice: number | null;
  /** 来源销售订单 ID */
  sourceSalesOrderId: string;
  /** 来源销售订单号 (冗余, e.g. "SO-20260516-0123") — 可能为 null 在旧数据 */
  sourceOrderNumber: string | null;
  /** 订单日期 YYYY-MM-DD (来自 SO.orderDate) */
  orderDate: string;
  /** Audit (来自 BaseEntity) */
  createdAt?: string;
  updatedAt?: string;
}

export interface PriceHistoryQuery {
  /** 产品类型 ID — 必填 */
  productId: string;
  /** 客户 ID — 可选 (缺省返回该产品在所有客户的成交历史) */
  customerId?: string;
  /** 最大条数 (默认 20, 后端 cap 200) */
  limit?: number;
}

/**
 * 查询客户/产品成交价历史. 后端按 orderDate DESC, createdAt DESC 排序.
 *
 * @returns list (可能为空); 异常时返回 [] 让 caller 渲染 "暂无数据"
 */
export async function listPriceHistory(
  factoryId: string,
  query: PriceHistoryQuery
): Promise<PriceHistoryEntry[]> {
  if (!factoryId || !query.productId) {
    return [];
  }
  const params: Record<string, string | number> = {
    productId: query.productId,
  };
  if (query.customerId && query.customerId.trim()) {
    params.customerId = query.customerId.trim();
  }
  if (query.limit && query.limit > 0) {
    params.limit = query.limit;
  }
  const res = await get<PriceHistoryEntry[]>(`/${factoryId}/customer-price-history`, { params });
  if (!res.success || !Array.isArray(res.data)) {
    return [];
  }
  return res.data;
}
