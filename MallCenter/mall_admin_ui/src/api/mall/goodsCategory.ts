import { http } from "@/utils/http";
import type {
  GoodsCategory,
  GoodsCategoryForm,
  GoodsCategoryTreeResult,
  GoodsCategoryResult,
  GoodsCategoryOperationResult
} from "./types/goodsCategory";

// 导出类型供外部使用
export type { GoodsCategory, GoodsCategoryForm };

/** 获取分类树 */
export const getCategoryTree = () => {
  return http.request<GoodsCategoryTreeResult>("get", "/goodscategory/tree");
};

/** 获取单个分类 */
export const getCategoryById = (id: string) => {
  return http.request<GoodsCategoryResult>("get", `/goodscategory/${id}`);
};

/** 新增分类 */
export const createCategory = (data: GoodsCategoryForm) => {
  return http.request<GoodsCategoryOperationResult>("post", "/goodscategory", {
    data
  });
};

/** 修改分类 */
export const updateCategory = (data: GoodsCategoryForm) => {
  return http.request<GoodsCategoryOperationResult>("put", "/goodscategory", {
    data
  });
};

/** 删除分类 */
export const deleteCategory = (id: string) => {
  return http.request<GoodsCategoryOperationResult>(
    "delete",
    `/goodscategory/${id}`
  );
};
