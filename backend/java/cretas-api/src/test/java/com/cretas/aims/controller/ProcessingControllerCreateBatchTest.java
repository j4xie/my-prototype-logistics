package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.processing.CreateProductionBatchRequest;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.service.AIEnterpriseService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.service.ProcessingStageRecordService;
import com.cretas.aims.service.QualityDispositionRuleService;
import com.cretas.aims.service.SpecialApprovalService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for {@link ProcessingController#createBatch}
 * (Issue #384 batch 3, follows PRs #383 batch 1 and #388 batch 2).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link CreateProductionBatchRequest} instead of the
 *       {@code ProductionBatch} entity directly</li>
 *   <li>Maps the DTO to the Entity at the controller boundary, leaving
 *       service-owned defaults (status / quantity / unit / productName /
 *       factoryId / createdAt) untouched by the mapper</li>
 *   <li>Accepts the "minimum body" without the FE having to provide the
 *       entity's hard {@code @NotNull quantity} / {@code @NotBlank unit}
 *       defaults — those used to 400-reject because Bean Validation runs
 *       on the entity BEFORE the service defaulting logic could fill them</li>
 *   <li>Does NOT duplicate the service-owned defaults (single source of
 *       truth lives in {@code ProcessingServiceImpl.createBatch})</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class ProcessingControllerCreateBatchTest {

    @Mock ProcessingService processingService;
    @Mock MobileService mobileService;
    @Mock AIEnterpriseService aiEnterpriseService;
    @Mock ProcessingStageRecordService stageRecordService;
    @Mock QualityDispositionRuleService qualityDispositionRuleService;
    @Mock SpecialApprovalService specialApprovalService;
    @Mock QualityInspectionRepository qualityInspectionRepository;

    @InjectMocks ProcessingController controller;

    @Test
    void createBatch_minimumBody_factoryIdFromPath_noServiceDefaultsLeakedToMapper() {
        // Minimum wire body per CreateProductionBatchRequest: only the
        // truly required fields. NO factoryId (path-variable). NO quantity
        // (service fills from plannedQuantity-or-ZERO). NO unit (service
        // fills "kg"). NO productName (service fills "待设置产品名称").
        // NO status (service forces PLANNED).
        CreateProductionBatchRequest req = new CreateProductionBatchRequest();
        req.setBatchNumber("BATCH-001");
        req.setProductTypeId("PT-001");

        when(processingService.createBatch(anyString(), any(ProductionBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        ApiResponse<ProductionBatch> resp = controller.createBatch("F001", req);

        ArgumentCaptor<ProductionBatch> captor = ArgumentCaptor.forClass(ProductionBatch.class);
        Mockito.verify(processingService).createBatch(Mockito.eq("F001"), captor.capture());
        ProductionBatch mapped = captor.getValue();

        assertNotNull(resp);
        // Wire-side fields propagated
        assertEquals("BATCH-001", mapped.getBatchNumber());
        assertEquals("PT-001", mapped.getProductTypeId());
        // Mapper does NOT pre-fill service-owned defaults (single source of truth)
        assertNull(mapped.getFactoryId(), "factoryId is set inside service, not by mapper");
        assertNull(mapped.getStatus(), "status PLANNED is set inside service, not by mapper");
        assertNull(mapped.getProductName(), "productName default '待设置产品名称' belongs to service");
        assertNull(mapped.getQuantity(), "quantity default belongs to service");
        assertNull(mapped.getUnit(), "unit default 'kg' belongs to service");
        // Auto-managed fields stay null on create
        assertNull(mapped.getId(), "id must remain null on create — DB IDENTITY assigns");
        assertNull(mapped.getActualQuantity(), "actualQuantity set later by completeProduction");
        assertNull(mapped.getStartTime());
        assertNull(mapped.getEndTime());
    }

    @Test
    void createBatch_happyPath_allFieldsPropagatedToEntity() {
        CreateProductionBatchRequest req = new CreateProductionBatchRequest();
        req.setBatchNumber("BATCH-2026-001");
        req.setProductionPlanId("PP-100");
        req.setProductTypeId("PT-100");
        req.setProductName("黑椒牛肉粒");
        req.setPlannedQuantity(new BigDecimal("1000.00"));
        req.setQuantity(new BigDecimal("1000.00"));
        req.setUnit("kg");
        req.setEquipmentId(7L);
        req.setEquipmentName("生产线-A");
        req.setSupervisorId(22L);
        req.setSupervisorName("张师傅");
        req.setWorkerCount(5);
        req.setMaterialCost(new BigDecimal("3500.00"));
        req.setLaborCost(new BigDecimal("800.00"));
        req.setEquipmentCost(new BigDecimal("200.00"));
        req.setOtherCost(new BigDecimal("100.00"));
        req.setNotes("加急订单");
        req.setPhotoRequired(true);
        req.setSopConfigId("SOP-001");
        Map<String, Object> custom = new HashMap<>();
        custom.put("drying_temp", 85);
        custom.put("seasoning_code", "A-003");
        req.setCustomFields(custom);

        when(processingService.createBatch(anyString(), any(ProductionBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createBatch("F006", req);

        ArgumentCaptor<ProductionBatch> captor = ArgumentCaptor.forClass(ProductionBatch.class);
        Mockito.verify(processingService).createBatch(Mockito.eq("F006"), captor.capture());
        ProductionBatch mapped = captor.getValue();

        assertEquals("BATCH-2026-001", mapped.getBatchNumber());
        assertEquals("PP-100", mapped.getProductionPlanId());
        assertEquals("PT-100", mapped.getProductTypeId());
        assertEquals("黑椒牛肉粒", mapped.getProductName());
        assertEquals(new BigDecimal("1000.00"), mapped.getPlannedQuantity());
        assertEquals(new BigDecimal("1000.00"), mapped.getQuantity());
        assertEquals("kg", mapped.getUnit());
        assertEquals(7L, mapped.getEquipmentId());
        assertEquals("生产线-A", mapped.getEquipmentName());
        assertEquals(22L, mapped.getSupervisorId());
        assertEquals("张师傅", mapped.getSupervisorName());
        assertEquals(5, mapped.getWorkerCount());
        assertEquals(new BigDecimal("3500.00"), mapped.getMaterialCost());
        assertEquals(new BigDecimal("800.00"), mapped.getLaborCost());
        assertEquals(new BigDecimal("200.00"), mapped.getEquipmentCost());
        assertEquals(new BigDecimal("100.00"), mapped.getOtherCost());
        assertEquals("加急订单", mapped.getNotes());
        assertTrue(mapped.getPhotoRequired(), "photoRequired flag propagated");
        assertEquals("SOP-001", mapped.getSopConfigId());
        assertNotNull(mapped.getCustomFields());
        assertEquals(85, mapped.getCustomFields().get("drying_temp"));
        assertEquals("A-003", mapped.getCustomFields().get("seasoning_code"));
    }

    @Test
    void createBatch_optionalPhotoRequired_nullStaysFalse_noOverrideOfBuilderDefault() {
        // ProductionBatch entity has @Builder.Default photoRequired = false.
        // Mapper must NOT call setPhotoRequired(null) — that would overwrite
        // the default with null and break downstream "photo capture" gating.
        CreateProductionBatchRequest req = new CreateProductionBatchRequest();
        req.setBatchNumber("BATCH-002");
        req.setProductTypeId("PT-001");
        // req.photoRequired left null

        when(processingService.createBatch(anyString(), any(ProductionBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createBatch("F001", req);

        ArgumentCaptor<ProductionBatch> captor = ArgumentCaptor.forClass(ProductionBatch.class);
        Mockito.verify(processingService).createBatch(anyString(), captor.capture());
        ProductionBatch mapped = captor.getValue();

        // photoRequired default (false from @Builder.Default) preserved because
        // mapper guards: `if (r.getPhotoRequired() != null) b.setPhotoRequired(...)`
        assertEquals(Boolean.FALSE, mapped.getPhotoRequired(),
                "null DTO field must NOT overwrite entity @Builder.Default false");
    }

    @Test
    void createBatch_optionalCustomFields_nullStaysEmptyMap_noOverrideOfBuilderDefault() {
        // Same defensive guard: customFields entity default is empty HashMap.
        // Mapper must NOT setCustomFields(null) when DTO field is null.
        CreateProductionBatchRequest req = new CreateProductionBatchRequest();
        req.setBatchNumber("BATCH-003");
        req.setProductTypeId("PT-001");
        // req.customFields left null

        when(processingService.createBatch(anyString(), any(ProductionBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createBatch("F001", req);

        ArgumentCaptor<ProductionBatch> captor = ArgumentCaptor.forClass(ProductionBatch.class);
        Mockito.verify(processingService).createBatch(anyString(), captor.capture());
        ProductionBatch mapped = captor.getValue();

        assertNotNull(mapped.getCustomFields(),
                "null DTO field must NOT overwrite entity @Builder.Default empty map");
        assertTrue(mapped.getCustomFields().isEmpty(),
                "customFields default empty HashMap preserved");
    }
}
