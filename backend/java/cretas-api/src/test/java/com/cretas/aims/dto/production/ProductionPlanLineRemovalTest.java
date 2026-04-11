package com.cretas.aims.dto.production;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * V3 P0-19 — 生产计划写路径移除"建议产线"字段
 *
 * <p>客户原话 (2026-04-06 六扇门会议 4259-4277s):
 * "我们没有固定产线, 没法选一产线二产线三产线".
 *
 * <p>写路径 ({@link CreateProductionPlanRequest}) 不应再接受 suggestedProductionLineId.
 * 读路径 ({@link ProductionPlanDTO} 与 Entity) 保留以兼容历史数据.
 */
class ProductionPlanLineRemovalTest {

    @Test
    void createProductionPlanRequest_shouldNotExposeLineField() {
        assertThrows(NoSuchFieldException.class,
                () -> CreateProductionPlanRequest.class.getDeclaredField("suggestedProductionLineId"),
                "P0-19: CreateProductionPlanRequest 不应再接受 suggestedProductionLineId (客户 4259s)");
    }
}
