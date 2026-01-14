import { http } from "@/utils/http";
import type {
  Merchant,
  MerchantSimple,
  MerchantQuery,
  PageResult,
  ApiResult
} from "./types/merchant";

/** 获取商户分页列表 */
export const getMerchantPage = (params: MerchantQuery) => {
  return http.request<ApiResult<PageResult<Merchant>>>("get", "/merchant/page", {
    params
  });
};

/** 获取商户详情 */
export const getMerchantById = (id: number) => {
  return http.request<ApiResult<Merchant>>("get", `/merchant/${id}`);
};

/** 获取商户列表（用于下拉选择） */
export const getMerchantList = () => {
  return http.request<ApiResult<MerchantSimple[]>>("get", "/merchant/list");
};

/** 新增商户 */
export const createMerchant = (data: Partial<Merchant>) => {
  return http.request<ApiResult<Merchant>>("post", "/merchant", { data });
};

/** 修改商户信息 */
export const updateMerchant = (data: Partial<Merchant>) => {
  return http.request<ApiResult<Merchant>>("put", "/merchant", { data });
};

/** 删除商户 */
export const deleteMerchant = (id: number) => {
  return http.request<ApiResult<void>>("delete", `/merchant/${id}`);
};

/** 审核商户 */
export const reviewMerchant = (
  id: number,
  action: "approve" | "reject",
  remark?: string
) => {
  // 后端 action: 1=通过 2=拒绝
  const actionValue = action === "approve" ? 1 : 2;
  return http.request<ApiResult<void>>("put", `/merchant/${id}/review`, {
    params: { action: actionValue, remark }
  });
};

/** 更新商户状态 */
export const updateMerchantStatus = (id: number, status: string) => {
  return http.request<ApiResult<void>>("put", `/merchant/${id}/status`, {
    params: { status }
  });
};
