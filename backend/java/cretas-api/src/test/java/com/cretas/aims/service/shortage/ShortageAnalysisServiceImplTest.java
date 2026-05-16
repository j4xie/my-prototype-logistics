package com.cretas.aims.service.shortage;

import com.cretas.aims.dto.orchestration.LineItemMatch;
import com.cretas.aims.dto.orchestration.MaterialCheckResult;
import com.cretas.aims.dto.orchestration.MaterialRequirement;
import com.cretas.aims.dto.orchestration.MaterialShortfall;
import com.cretas.aims.dto.orchestration.StockCheckResult;
import com.cretas.aims.service.orchestration.BomExpansionService;
import com.cretas.aims.service.orchestration.InventoryMatchingService;
import com.cretas.aims.service.shortage.dto.ProcurementSuggestion;
import com.cretas.aims.service.shortage.dto.ProductionPlanSuggestion;
import com.cretas.aims.service.shortage.dto.ShortageReport;
import com.cretas.aims.service.shortage.impl.ShortageAnalysisServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sprint 2 Track E (S-MRP-1 / N31) — 缺料编排单测.
 *
 * <p>覆盖 3 路径:
 * <ol>
 *   <li>FG 库存完全充足 → 不展开 BOM, fullySatisfied=true, 建议列表空</li>
 *   <li>FG 缺 + 原料充足 → 展开 BOM, 无 procurement 建议, 有 production 建议</li>
 *   <li>FG 缺 + 原料缺 → 同时有 procurement + production 建议; 多 SKU 共用原料聚合</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ShortageAnalysisService — N31 缺料编排")
class ShortageAnalysisServiceImplTest {

    private static final String FACTORY = "F001";
    private static final String SALES_ORDER = "SO-001";

    @Mock
    private InventoryMatchingService inventoryMatchingService;

    @Mock
    private BomExpansionService bomExpansionService;

    @InjectMocks
    private ShortageAnalysisServiceImpl service;

    @Test
    @DisplayName("FG 库存充足 → 不展 BOM, 报告显示充足, 建议列表空")
    void analyze_whenAllFgSatisfied_returnsClean() {
        LineItemMatch ok = lineItem("PROD-A", "Product A", new BigDecimal("10"), new BigDecimal("100"));
        StockCheckResult fg = stockCheck(true, List.of(ok));
        when(inventoryMatchingService.checkAvailability(FACTORY, SALES_ORDER)).thenReturn(fg);

        ShortageReport report = service.analyzeForSalesOrder(FACTORY, SALES_ORDER);

        assertEquals("COMPLETED", report.getAnalysisStatus());
        assertTrue(report.isFullySatisfied());
        assertTrue(report.getTotalRequired().isEmpty(), "无 FG 缺口时不应展开 BOM");
        assertTrue(report.getMaterialShortages().isEmpty());
        assertEquals(1, report.getFinishedGoodsLineItems().size());

        verify(bomExpansionService, never()).expandBOM(anyString(), anyString(), any(BigDecimal.class));
        verify(bomExpansionService, never()).checkMaterialAvailability(anyString(), anyList());

        assertTrue(service.suggestProcurement(FACTORY, report).isEmpty());
        assertTrue(service.suggestProduction(FACTORY, report).isEmpty());
    }

    @Test
    @DisplayName("FG 缺 + 原料充足 → 仅生产建议, 不出采购")
    void analyze_whenFgShortButMaterialOk_onlyProductionSuggested() {
        LineItemMatch shortFg = lineItem("PROD-A", "Product A", new BigDecimal("100"), new BigDecimal("30"));
        when(inventoryMatchingService.checkAvailability(FACTORY, SALES_ORDER))
                .thenReturn(stockCheck(false, List.of(shortFg)));

        MaterialRequirement need = requirement("M1", "面粉", new BigDecimal("50"));
        when(bomExpansionService.expandBOM(eq(FACTORY), eq("PROD-A"), eq(new BigDecimal("70"))))
                .thenReturn(List.of(need));

        when(bomExpansionService.checkMaterialAvailability(eq(FACTORY), anyList()))
                .thenReturn(materialCheck(true, Collections.emptyList()));

        ShortageReport report = service.analyzeForSalesOrder(FACTORY, SALES_ORDER);

        assertEquals("COMPLETED", report.getAnalysisStatus());
        assertFalse(report.isFullySatisfied(), "FG 缺口未补 → 总体仍不满足");
        assertEquals(1, report.getTotalRequired().size());
        assertTrue(report.getMaterialShortages().isEmpty());

        List<ProcurementSuggestion> proc = service.suggestProcurement(FACTORY, report);
        assertTrue(proc.isEmpty(), "原料充足时不应生成采购建议");

        List<ProductionPlanSuggestion> prod = service.suggestProduction(FACTORY, report);
        assertEquals(1, prod.size());
        assertEquals("PROD-A", prod.get(0).getProductId());
        assertEquals(new BigDecimal("70"), prod.get(0).getPlannedQty());
    }

    @Test
    @DisplayName("多 SKU 共用原料 → 聚合后 checkMaterialAvailability 仅传一条 M1, 生成同时 procurement + production")
    void analyze_whenMultiSkuShareMaterial_aggregatesBeforeBomCheck() {
        LineItemMatch shortA = lineItem("PROD-A", "Product A", new BigDecimal("60"), new BigDecimal("10"));
        LineItemMatch shortB = lineItem("PROD-B", "Product B", new BigDecimal("40"), new BigDecimal("0"));
        when(inventoryMatchingService.checkAvailability(FACTORY, SALES_ORDER))
                .thenReturn(stockCheck(false, List.of(shortA, shortB)));

        // 两个 SKU 都用到 M1
        when(bomExpansionService.expandBOM(eq(FACTORY), eq("PROD-A"), eq(new BigDecimal("50"))))
                .thenReturn(List.of(requirement("M1", "面粉", new BigDecimal("20"))));
        when(bomExpansionService.expandBOM(eq(FACTORY), eq("PROD-B"), eq(new BigDecimal("40"))))
                .thenReturn(List.of(requirement("M1", "面粉", new BigDecimal("30"))));

        // 聚合后传入应只有 1 条 M1, requiredQty=50
        MaterialShortfall sf = new MaterialShortfall("M1", "面粉",
                new BigDecimal("50"), new BigDecimal("15"), new BigDecimal("35"));
        when(bomExpansionService.checkMaterialAvailability(eq(FACTORY), anyList()))
                .thenReturn(materialCheck(false, List.of(sf)));

        ShortageReport report = service.analyzeForSalesOrder(FACTORY, SALES_ORDER);

        assertEquals(1, report.getTotalRequired().size(), "M1 聚合后应只剩 1 条");
        assertEquals(new BigDecimal("50"), report.getTotalRequired().get(0).getRequiredQuantity());

        List<ProcurementSuggestion> proc = service.suggestProcurement(FACTORY, report);
        assertEquals(1, proc.size());
        assertEquals("M1", proc.get(0).getMaterialId());
        assertEquals(new BigDecimal("35"), proc.get(0).getSuggestedQty());

        List<ProductionPlanSuggestion> prod = service.suggestProduction(FACTORY, report);
        assertEquals(2, prod.size(), "两个 FG 短缺 SKU 各一条生产建议");

        verify(bomExpansionService, times(2)).expandBOM(anyString(), anyString(), any(BigDecimal.class));
        verify(bomExpansionService, times(1)).checkMaterialAvailability(anyString(), anyList());
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private LineItemMatch lineItem(String productId, String name, BigDecimal required, BigDecimal available) {
        LineItemMatch m = new LineItemMatch();
        m.setProductTypeId(productId);
        m.setProductTypeName(name);
        m.setRequiredQuantity(required);
        m.setAvailableQuantity(available);
        m.setShortfallQuantity(required.subtract(available).max(BigDecimal.ZERO));
        return m;
    }

    private StockCheckResult stockCheck(boolean allSatisfied, List<LineItemMatch> items) {
        StockCheckResult r = new StockCheckResult();
        r.setSalesOrderId(SALES_ORDER);
        r.setAllSatisfied(allSatisfied);
        r.setLineItems(items);
        return r;
    }

    private MaterialRequirement requirement(String mid, String name, BigDecimal qty) {
        MaterialRequirement m = new MaterialRequirement();
        m.setMaterialTypeId(mid);
        m.setMaterialTypeName(name);
        m.setRequiredQuantity(qty);
        return m;
    }

    private MaterialCheckResult materialCheck(boolean allSatisfied, List<MaterialShortfall> shortfalls) {
        MaterialCheckResult r = new MaterialCheckResult();
        r.setAllSatisfied(allSatisfied);
        r.setShortfalls(shortfalls);
        r.setAllocations(Collections.emptyList());
        return r;
    }
}
