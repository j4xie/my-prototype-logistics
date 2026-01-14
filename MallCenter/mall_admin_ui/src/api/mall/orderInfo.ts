import { http } from "@/utils/http";
import type {
  OrderInfo,
  OrderInfoQuery,
  DeliverParams,
  PageResult,
  ApiResult
} from "./types/orderInfo";

// 导出类型供外部使用
export type { OrderInfo, OrderInfoQuery, DeliverParams };
export { OrderStatusMap } from "./types/orderInfo";

/** 获取订单分页列表 */
export const getOrderInfoPage = (params: OrderInfoQuery) => {
  return http.request<ApiResult<PageResult<OrderInfo>>>("get", "/orderinfo/page", {
    params
  });
};

/** 获取订单详情 */
export const getOrderInfoById = (id: string) => {
  return http.request<ApiResult<OrderInfo>>("get", `/orderinfo/${id}`);
};

/** 发货 */
export const deliverOrder = (id: string, data?: DeliverParams) => {
  return http.request<ApiResult<void>>("put", `/orderinfo/${id}/deliver`, {
    data
  });
};

/** 取消订单 */
export const cancelOrder = (id: string) => {
  return http.request<ApiResult<void>>("put", `/orderinfo/${id}/cancel`);
};
