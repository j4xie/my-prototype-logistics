import { http } from "@/utils/http";
import type {
  GoodsSpu,
  GoodsSpuForm,
  GoodsSpuQuery,
  PageResult,
  ApiResult
} from "./types/goodsSpu";

/** 获取商品分页列表 */
export const getGoodsSpuPage = (params: GoodsSpuQuery) => {
  return http.request<ApiResult<PageResult<GoodsSpu>>>("get", "/goodsspu/page", {
    params
  });
};

/** 获取商品详情 */
export const getGoodsSpuById = (id: string) => {
  return http.request<ApiResult<GoodsSpu>>("get", `/goodsspu/${id}`);
};

/** 新增商品 */
export const createGoodsSpu = (data: GoodsSpuForm) => {
  return http.request<ApiResult<GoodsSpu>>("post", "/goodsspu", { data });
};

/** 修改商品 */
export const updateGoodsSpu = (data: GoodsSpuForm) => {
  return http.request<ApiResult<GoodsSpu>>("put", "/goodsspu", { data });
};

/** 删除商品 */
export const deleteGoodsSpu = (id: string) => {
  return http.request<ApiResult<void>>("delete", `/goodsspu/${id}`);
};

/** 上架商品 */
export const publishGoodsSpu = (id: string) => {
  return http.request<ApiResult<void>>("put", `/goodsspu/${id}/publish`);
};

/** 下架商品 */
export const unpublishGoodsSpu = (id: string) => {
  return http.request<ApiResult<void>>("put", `/goodsspu/${id}/unpublish`);
};
