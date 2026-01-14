/** 商品SPU实体 */
export interface GoodsSpu {
  /** 商品ID */
  id: string;
  /** 商品编码 */
  spuCode?: string;
  /** 商品名称 */
  name: string;
  /** 一级分类ID */
  categoryFirst?: string;
  /** 二级分类ID */
  categorySecond?: string;
  /** 商品图片列表（后端可能返回逗号分隔的字符串数组） */
  picUrls?: string[];
  /** 商品描述 */
  description?: string;
  /** 卖点 */
  sellPoint?: string;
  /** 销售价格（元） */
  salesPrice: number;
  /** 市场价格（元） */
  marketPrice?: number;
  /** 成本价（元） */
  costPrice?: number;
  /** 库存 */
  stock: number;
  /** 上下架状态：0下架 1上架 */
  shelf: "0" | "1";
  /** 排序 */
  sort: number;
  /** 销量 */
  saleNum?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
}

/** 商品表单数据 */
export interface GoodsSpuForm {
  id?: string;
  name: string;
  categoryId: string;
  picUrls?: string[];
  description?: string;
  sellPoint?: string;
  price: number;
  marketPrice?: number;
  stock: number;
  status: "0" | "1";
  sort: number;
}

/** 商品查询参数 */
export interface GoodsSpuQuery {
  /** 当前页 */
  current?: number;
  /** 每页数量 */
  size?: number;
  /** 商品名称 */
  name?: string;
  /** 分类ID */
  categoryId?: string;
  /** 状态 */
  status?: "0" | "1";
  /** 商户ID */
  merchantId?: number;
}

/** 分页结果 */
export interface PageResult<T> {
  /** 数据列表 */
  records: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  current: number;
  /** 每页数量 */
  size: number;
  /** 总页数 */
  pages: number;
}

/** API响应结果 */
export interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}
