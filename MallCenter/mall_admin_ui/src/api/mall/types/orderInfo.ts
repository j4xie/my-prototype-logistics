/**
 * 订单信息相关类型定义
 */

/** 订单状态 */
export type OrderStatus = "0" | "1" | "2" | "3" | "4" | "5";

/** 订单状态映射 */
export const OrderStatusMap: Record<OrderStatus, string> = {
  "0": "待付款",
  "1": "待发货",
  "2": "待收货",
  "3": "已完成",
  "4": "已取消",
  "5": "已退款"
};

/** 订单商品项 */
export interface OrderItem {
  /** 商品项ID */
  id: string;
  /** 商品ID */
  goodsId: string;
  /** 商品名称 */
  goodsName: string;
  /** 商品图片 */
  goodsPic: string;
  /** 商品单价（分） */
  price: number;
  /** 购买数量 */
  quantity: number;
}

/** 订单信息实体 */
export interface OrderInfo {
  /** 订单ID */
  id: string;
  /** 订单编号 */
  orderNo: string;
  /** 用户ID */
  userId: string;
  /** 用户名称 */
  userName?: string;
  /** 用户手机号 */
  userPhone?: string;
  /** 订单状态: 0待付款 1待发货 2待收货 3已完成 4已取消 5已退款 */
  status: OrderStatus;
  /** 实付金额（分） */
  payAmount: number;
  /** 运费金额（分） */
  freightAmount: number;
  /** 订单总金额（分） */
  totalAmount: number;
  /** 收货人姓名 */
  receiverName: string;
  /** 收货人电话 */
  receiverPhone: string;
  /** 收货地址 */
  receiverAddress: string;
  /** 订单备注 */
  remark?: string;
  /** 支付时间 */
  payTime?: string;
  /** 发货时间 */
  deliverTime?: string;
  /** 收货时间 */
  receiveTime?: string;
  /** 创建时间 */
  createTime: string;
  /** 订单商品列表 */
  orderItems: OrderItem[];
}

/** 订单查询参数 */
export interface OrderInfoQuery {
  /** 当前页 */
  current?: number;
  /** 每页数量 */
  size?: number;
  /** 订单编号 */
  orderNo?: string;
  /** 订单状态 */
  status?: OrderStatus;
  /** 收货人手机号 */
  receiverPhone?: string;
}

/** 发货参数 */
export interface DeliverParams {
  /** 物流公司 */
  expressCompany?: string;
  /** 物流单号 */
  expressNo?: string;
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
