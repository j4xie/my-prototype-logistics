/**
 * 商品分类相关类型定义
 */

/** 分类启用状态 */
export type EnableStatus = "0" | "1";

/** 商品分类实体 */
export interface GoodsCategory {
  /** 分类ID */
  id: string;
  /** 父级分类ID */
  parentId: string;
  /** 分类名称 */
  name: string;
  /** 图标文字 */
  iconText?: string;
  /** 分类图片URL */
  picUrl?: string;
  /** 排序值 */
  sort: number;
  /** 启用状态: 0-禁用, 1-启用 */
  enable: EnableStatus;
  /** 分类描述 */
  description?: string;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 子分类列表 */
  children?: GoodsCategory[];
}

/** 分类表单数据 */
export interface GoodsCategoryForm {
  id?: string;
  parentId: string;
  name: string;
  iconText?: string;
  picUrl?: string;
  sort: number;
  enable: EnableStatus;
  description?: string;
}

/** 分类树响应 */
export interface GoodsCategoryTreeResult {
  code: number;
  msg: string;
  data: GoodsCategory[];
}

/** 单个分类响应 */
export interface GoodsCategoryResult {
  code: number;
  msg: string;
  data: GoodsCategory;
}

/** 通用操作响应 */
export interface GoodsCategoryOperationResult {
  code: number;
  msg: string;
  data?: unknown;
}
