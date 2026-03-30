package com.cretas.aims.entity.enums;

/**
 * 入库类型
 */
public enum InboundType {
    /** 采购入库 */
    PURCHASE_ORDER,
    /** 盘点入库 */
    INVENTORY_COUNT,
    /** 供应商退货入库 */
    SUPPLIER_RETURN,
    /** 工厂退料入库 */
    FACTORY_RETURN,
    /** 其他 */
    OTHER
}
