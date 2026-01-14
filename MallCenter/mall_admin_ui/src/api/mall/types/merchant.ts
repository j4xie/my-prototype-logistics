/** 商户状态：0-待审核 1-已认证 2-已封禁 3-已注销 */
export type MerchantStatus = 0 | 1 | 2 | 3;

/** 商户状态映射 */
export const MerchantStatusMap: Record<MerchantStatus, string> = {
  0: "待审核",
  1: "已认证",
  2: "已封禁",
  3: "已注销"
};

/** 商户状态颜色 */
export const MerchantStatusColor: Record<MerchantStatus, string> = {
  0: "warning",
  1: "success",
  2: "danger",
  3: "info"
};

/** 商户实体 */
export interface Merchant {
  /** 商户ID */
  id: number;
  /** 用户ID */
  userId?: number;
  /** 商户编号 */
  merchantNo?: string;
  /** 商户名称 */
  merchantName: string;
  /** 商户简称 */
  shortName?: string;
  /** Logo URL */
  logoUrl?: string;
  /** 营业执照号 */
  licenseNo?: string;
  /** 营业执照图片 */
  licenseImage?: string;
  /** 法人姓名 */
  legalPerson?: string;
  /** 法人身份证 */
  legalIdCard?: string;
  /** 联系人 */
  contactName?: string;
  /** 联系电话 */
  contactPhone?: string;
  /** 联系邮箱 */
  contactEmail?: string;
  /** 地址 */
  address?: string;
  /** 公司类型 */
  companyType?: string;
  /** 备注 */
  remarks?: string;
  /** 状态：0-待审核 1-已认证 2-已封禁 3-已注销 */
  status: MerchantStatus;
  /** 评分 */
  rating?: number;
  /** 商品数量 */
  productCount?: number;
  /** 订单数量 */
  orderCount?: number;
  /** 销售总额 */
  totalSales?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
}

/** 商户简要信息（用于下拉选择） */
export interface MerchantSimple {
  /** 商户ID */
  id: number;
  /** 商户名称 */
  merchantName: string;
  /** 商户编号 */
  merchantNo?: string;
}

/** 商户查询参数 */
export interface MerchantQuery {
  /** 当前页 */
  current?: number;
  /** 每页数量 */
  size?: number;
  /** 商户名称 */
  merchantName?: string;
  /** 商户状态 */
  status?: MerchantStatus;
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
