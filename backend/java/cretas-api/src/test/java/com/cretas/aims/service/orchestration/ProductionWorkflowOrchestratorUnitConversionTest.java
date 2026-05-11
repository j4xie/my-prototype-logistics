package com.cretas.aims.service.orchestration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * D3 (2026-05-10 客户对接会议) 单位换算 — g ↔ kg 1:1000 后台自动换算
 *
 * 验证 ProductionWorkflowOrchestrator.convertUnit() helper:
 * - BOM 配方层用 g, 仓库 / 调拨层用 kg
 * - 系统在 buildTransferRequest 阶段后台自动按 1:1000 换算
 * - 不支持的换算返 null (沿用原 1:1 透传逻辑保持向后兼容)
 */
@DisplayName("D3: ProductionWorkflowOrchestrator.convertUnit (g↔kg 1:1000)")
class ProductionWorkflowOrchestratorUnitConversionTest {

    /** 通过反射调用 private convertUnit, 隔离单位换算逻辑测试. */
    private BigDecimal callConvertUnit(BigDecimal value, String from, String to) throws Exception {
        // 构造空实例只为调 method 不需要完整 DI
        ProductionWorkflowOrchestrator orch = newOrchestrator();
        Method m = ProductionWorkflowOrchestrator.class.getDeclaredMethod(
                "convertUnit", BigDecimal.class, String.class, String.class);
        m.setAccessible(true);
        return (BigDecimal) m.invoke(orch, value, from, to);
    }

    private ProductionWorkflowOrchestrator newOrchestrator() throws Exception {
        java.lang.reflect.Constructor<ProductionWorkflowOrchestrator> ctor =
                ProductionWorkflowOrchestrator.class.getDeclaredConstructors().length == 1
                        ? (java.lang.reflect.Constructor<ProductionWorkflowOrchestrator>)
                            ProductionWorkflowOrchestrator.class.getDeclaredConstructors()[0]
                        : null;
        if (ctor == null) throw new IllegalStateException("Constructor lookup failed");
        ctor.setAccessible(true);
        // 用 null 填充全部 final dependencies — 只调 convertUnit 不会触碰它们
        Object[] args = new Object[ctor.getParameterCount()];
        return ctor.newInstance(args);
    }

    @Test
    @DisplayName("g → kg: 344.83g → 0.34483kg (BOM 一份成品的换算示例)")
    void gToKg_oneServing() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("344.83"), "g", "kg");
        // 344.83 / 1000 = 0.34483
        assertEquals(0, result.compareTo(new BigDecimal("0.344830")),
                "344.83g → 0.34483kg");
    }

    @Test
    @DisplayName("g → kg: 34483g → 34.483kg (100 份成品计划的总量换算)")
    void gToKg_hundredServings() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("34483"), "g", "kg");
        // 34483 / 1000 = 34.483
        assertEquals(0, result.compareTo(new BigDecimal("34.483000")),
                "34483g → 34.483kg (调拨单一行)");
    }

    @Test
    @DisplayName("kg → g: 1.5kg → 1500g (反向换算)")
    void kgToG() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("1.5"), "kg", "g");
        // 1.5 * 1000 = 1500
        assertEquals(0, result.compareTo(new BigDecimal("1500")),
                "1.5kg → 1500g");
    }

    @Test
    @DisplayName("同单位透传 (kg → kg)")
    void sameUnitPassThrough() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("100"), "kg", "kg");
        assertEquals(0, result.compareTo(new BigDecimal("100")));
    }

    @Test
    @DisplayName("大小写不敏感 (KG / Kg / kg 均能识别)")
    void caseInsensitive() throws Exception {
        BigDecimal r1 = callConvertUnit(new BigDecimal("1000"), "G", "KG");
        BigDecimal r2 = callConvertUnit(new BigDecimal("1000"), "g", "Kg");
        assertEquals(0, r1.compareTo(new BigDecimal("1.000000")));
        assertEquals(0, r2.compareTo(new BigDecimal("1.000000")));
    }

    @Test
    @DisplayName("ml → L 1:1000 换算 (volume parallel to weight)")
    void mlToL() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("2500"), "ml", "L");
        assertEquals(0, result.compareTo(new BigDecimal("2.500000")),
                "2500mL → 2.5L");
    }

    @Test
    @DisplayName("不支持的换算 (g → L) 返 null, 沿用原 1:1 透传 (向后兼容)")
    void unsupportedConversionReturnsNull() throws Exception {
        BigDecimal result = callConvertUnit(new BigDecimal("100"), "g", "L");
        assertNull(result, "g→L 非法换算应返 null, caller 沿用原 quantity");
    }

    @Test
    @DisplayName("null 输入: 任一参数 null → 返 null")
    void nullInputReturnsNull() throws Exception {
        assertNull(callConvertUnit(null, "g", "kg"));
        assertNull(callConvertUnit(new BigDecimal("100"), null, "kg"));
        assertNull(callConvertUnit(new BigDecimal("100"), "g", null));
    }
}
