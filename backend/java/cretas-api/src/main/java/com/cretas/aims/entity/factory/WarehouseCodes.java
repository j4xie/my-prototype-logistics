package com.cretas.aims.entity.factory;

/**
 * D1 双仓流转 — warehouse code 常量 (2026-05-10 spec, PR #309 A1=A).
 *
 * <p>per-factory 仓库 code，每个 factory 通过 V20260411_03 seed 自动生成对应的
 * {@link FactoryWarehouse} entry。这里 code 是逻辑标识符，业务代码通过
 * {@link com.cretas.aims.repository.factory.FactoryWarehouseRepository#findByFactoryIdAndCodeAndDeletedAtIsNull}
 * 解析为 {@code factory_warehouses.id} (UUID).
 *
 * <p>用法示例:
 * <pre>
 * String warehouseId = factoryWarehouseRepository
 *     .findByFactoryIdAndCodeAndDeletedAtIsNull(factoryId, WarehouseCodes.WH_LOG)
 *     .orElseThrow()
 *     .getId();
 * </pre>
 */
public final class WarehouseCodes {

    /** 物流仓 (LOGISTICS) — 长期存储, 销售/调拨基础。 */
    public static final String WH_LOG = "WH-LOG";

    /** 鲜棉仓 / 车间仓 (WORKSHOP) — 当天清仓, 报工消耗在此。 */
    public static final String WH_WKS = "WH-WKS";

    private WarehouseCodes() {
        // util class
    }
}
