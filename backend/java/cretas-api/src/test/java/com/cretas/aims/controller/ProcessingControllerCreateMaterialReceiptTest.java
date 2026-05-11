package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.processing.CreateMaterialReceiptRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
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
import java.time.LocalDate;
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
 * Rule 17.1 cleanup verification for
 * {@link ProcessingController#createMaterialReceipt} (Issue #384 batch 4,
 * follows PR #383 batch 1, PR #388 batch 2, PR #390 batch 3).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link CreateMaterialReceiptRequest} instead of the
 *       {@link MaterialBatch} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps the DTO to the Entity at the controller boundary, leaving
 *       service-owned defaults (factoryId / status / usedQuantity /
 *       reservedQuantity / quantityUnit fallback / weightPerUnit /
 *       unitPrice / purchaseDate) untouched by the mapper</li>
 *   <li>Resolves FE-wire {@code @JsonAlias} field-name variants
 *       (quantity → receiptQuantity, receivedDate → receiptDate,
 *       unit → quantityUnit) onto the canonical entity field names</li>
 *   <li>Does NOT duplicate service-owned defaults (single source of truth
 *       lives in {@code ProcessingServiceImpl.createMaterialReceipt})</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class ProcessingControllerCreateMaterialReceiptTest {

    @Mock ProcessingService processingService;
    @Mock MobileService mobileService;
    @Mock AIEnterpriseService aiEnterpriseService;
    @Mock ProcessingStageRecordService stageRecordService;
    @Mock QualityDispositionRuleService qualityDispositionRuleService;
    @Mock SpecialApprovalService specialApprovalService;
    @Mock QualityInspectionRepository qualityInspectionRepository;

    @InjectMocks ProcessingController controller;

    @Test
    void createMaterialReceipt_minimumBody_filledDefaults_noServiceDefaultsLeakedToMapper() {
        // Minimum wire body per CreateMaterialReceiptRequest: only the
        // truly required fields. NO factoryId (path-variable). NO status
        // (service forces AVAILABLE). NO usedQuantity/reservedQuantity
        // (service forces ZERO). NO quantityUnit (service falls back to
        // materialType.unit or "公斤"). NO weightPerUnit (service defaults 1).
        // NO unitPrice (service defaults 0). NO purchaseDate (service syncs
        // from receiptDate).
        CreateMaterialReceiptRequest req = new CreateMaterialReceiptRequest();
        req.setBatchNumber("MB-F001-MINIMAL");
        req.setMaterialTypeId("MT-001");
        req.setReceiptQuantity(new BigDecimal("100.00"));

        when(processingService.createMaterialReceipt(anyString(), any(MaterialBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        ApiResponse<MaterialBatch> resp = controller.createMaterialReceipt("F001", null, req);

        ArgumentCaptor<MaterialBatch> captor = ArgumentCaptor.forClass(MaterialBatch.class);
        Mockito.verify(processingService).createMaterialReceipt(Mockito.eq("F001"), captor.capture());
        MaterialBatch mapped = captor.getValue();

        assertNotNull(resp);
        // Wire-side fields propagated
        assertEquals("MB-F001-MINIMAL", mapped.getBatchNumber());
        assertEquals("MT-001", mapped.getMaterialTypeId());
        assertEquals(new BigDecimal("100.00"), mapped.getReceiptQuantity());
        // Mapper does NOT pre-fill service-owned defaults (single source of truth)
        assertNull(mapped.getFactoryId(), "factoryId is set inside service from @PathVariable, not by mapper");
        assertNull(mapped.getPurchaseDate(), "purchaseDate sync (from receiptDate) belongs to service");
        assertNull(mapped.getWeightPerUnit(), "weightPerUnit default 1.0 belongs to service");
        assertNull(mapped.getUnitPrice(), "unitPrice default 0 belongs to service");
        assertNull(mapped.getQuantityUnit(), "quantityUnit default '公斤' / materialType-derived belongs to service");
        // Auto-managed fields stay null on create
        assertNull(mapped.getId(), "id must remain null on create — DB IDENTITY assigns");
        assertNull(mapped.getCreatedBy(), "createdBy set later by JWT path (null when no authorization header)");
        assertNull(mapped.getLastUsedAt());
        // Entity field-level defaults preserved by mapper not overwriting them
        // (MaterialBatch.java lines 102 / 106 / 112: usedQuantity=0, reservedQuantity=0, status=AVAILABLE)
        // Service later re-applies status=AVAILABLE and usedQuantity/reservedQuantity=ZERO as defensive overwrites;
        // the entity field defaults align with the service's intent, so the mapper not touching them is correct.
        assertEquals(BigDecimal.ZERO, mapped.getUsedQuantity(), "entity field default usedQuantity=0 preserved");
        assertEquals(BigDecimal.ZERO, mapped.getReservedQuantity(), "entity field default reservedQuantity=0 preserved");
        assertEquals(MaterialBatchStatus.AVAILABLE, mapped.getStatus(),
                "entity field default status=AVAILABLE preserved (mapper leaves it; service re-sets defensively)");
    }

    @Test
    void createMaterialReceipt_happyPath_allFieldsPropagatedToEntity() {
        CreateMaterialReceiptRequest req = new CreateMaterialReceiptRequest();
        req.setBatchNumber("MB-F006-FULL");
        req.setMaterialTypeId("MT-PORK-001");
        req.setSupplierId("SUP-001");
        req.setReceiptDate(LocalDate.of(2026, 5, 11));
        req.setProductionDate(LocalDate.of(2026, 5, 10));
        req.setExpireDate(LocalDate.of(2026, 6, 11));
        req.setReceiptQuantity(new BigDecimal("500.00"));
        req.setQuantityUnit("kg");
        req.setWeightPerUnit(new BigDecimal("1.000"));
        req.setUnitPrice(new BigDecimal("30.00"));
        req.setStorageLocation("冷库A-3");
        req.setQualityCertificate("A级");
        req.setNotes("加急到货");
        req.setWarehouseId("WH-LOG");
        Map<String, Object> custom = new HashMap<>();
        custom.put("organic_cert_no", "ORG-2026-0511");
        custom.put("supplier_grade", "AAA");
        req.setCustomFields(custom);

        when(processingService.createMaterialReceipt(anyString(), any(MaterialBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createMaterialReceipt("F006", null, req);

        ArgumentCaptor<MaterialBatch> captor = ArgumentCaptor.forClass(MaterialBatch.class);
        Mockito.verify(processingService).createMaterialReceipt(Mockito.eq("F006"), captor.capture());
        MaterialBatch mapped = captor.getValue();

        assertEquals("MB-F006-FULL", mapped.getBatchNumber());
        assertEquals("MT-PORK-001", mapped.getMaterialTypeId());
        assertEquals("SUP-001", mapped.getSupplierId());
        assertEquals(LocalDate.of(2026, 5, 11), mapped.getReceiptDate());
        assertEquals(LocalDate.of(2026, 5, 10), mapped.getProductionDate());
        assertEquals(LocalDate.of(2026, 6, 11), mapped.getExpireDate());
        assertEquals(new BigDecimal("500.00"), mapped.getReceiptQuantity());
        assertEquals("kg", mapped.getQuantityUnit());
        assertEquals(new BigDecimal("1.000"), mapped.getWeightPerUnit());
        assertEquals(new BigDecimal("30.00"), mapped.getUnitPrice());
        assertEquals("冷库A-3", mapped.getStorageLocation());
        assertEquals("A级", mapped.getQualityCertificate());
        assertEquals("加急到货", mapped.getNotes());
        assertEquals("WH-LOG", mapped.getWarehouseId());
        assertNotNull(mapped.getCustomFields());
        assertEquals("ORG-2026-0511", mapped.getCustomFields().get("organic_cert_no"));
        assertEquals("AAA", mapped.getCustomFields().get("supplier_grade"));
    }

    @Test
    void createMaterialReceipt_optionalQuantityUnit_nullStaysNull_noOverrideForServiceFallback() {
        // When the FE omits `unit` / `quantityUnit`, the service should
        // fall back to materialType.unit or "公斤". Mapper must NOT call
        // setQuantityUnit(null) — that would force the service's null-check
        // path even when the entity could have a valid prior value.
        // (Guard symmetric to batch-3 photoRequired / customFields guards.)
        CreateMaterialReceiptRequest req = new CreateMaterialReceiptRequest();
        req.setBatchNumber("MB-F001-NOUNIT");
        req.setMaterialTypeId("MT-001");
        req.setReceiptQuantity(new BigDecimal("50.00"));
        // req.quantityUnit left null
        // req.warehouseId left null
        // req.customFields left null

        when(processingService.createMaterialReceipt(anyString(), any(MaterialBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createMaterialReceipt("F001", null, req);

        ArgumentCaptor<MaterialBatch> captor = ArgumentCaptor.forClass(MaterialBatch.class);
        Mockito.verify(processingService).createMaterialReceipt(anyString(), captor.capture());
        MaterialBatch mapped = captor.getValue();

        assertNull(mapped.getQuantityUnit(),
                "null DTO quantityUnit must NOT overwrite entity field — service computes from materialType-or-'公斤'");
        assertNull(mapped.getWarehouseId(),
                "null DTO warehouseId must NOT overwrite entity field — service / @Column not-null handles fallback");
        // customFields entity default is empty HashMap (line 273 of MaterialBatch.java)
        assertNotNull(mapped.getCustomFields(),
                "null DTO customFields must NOT overwrite entity default (empty HashMap)");
        assertTrue(mapped.getCustomFields().isEmpty(),
                "entity default empty HashMap preserved when DTO field absent");
    }

    @Test
    void createMaterialReceipt_feWireAliases_quantityAndReceivedDateAndUnit_resolveToEntityFieldNames() {
        // FE legacy wire format (per processingApiClient.recordMaterialReceipt
        // and BatchOperationsTestScreen) uses `quantity` / `unit` /
        // `receivedDate` instead of canonical `receiptQuantity` / `quantityUnit`
        // / `receiptDate`. The DTO @JsonAlias declarations resolve them,
        // and the mapper just propagates the resolved fields. This test
        // exercises the resolved DTO state — Jackson binding is covered by
        // the existing DTO unit tests in dto/ package.
        CreateMaterialReceiptRequest req = new CreateMaterialReceiptRequest();
        req.setBatchNumber("MB-WIRE-ALIAS");
        req.setMaterialTypeId("MT-001");
        // Simulate post-Jackson-binding: @JsonAlias("quantity") resolved
        // the wire `quantity` field into the DTO `receiptQuantity` setter.
        req.setReceiptQuantity(new BigDecimal("500.00"));
        // Simulate post-Jackson-binding: @JsonAlias("receivedDate") resolved
        // wire `receivedDate` → DTO `receiptDate`.
        req.setReceiptDate(LocalDate.of(2026, 5, 11));
        // Simulate post-Jackson-binding: @JsonAlias("unit") resolved
        // wire `unit` → DTO `quantityUnit`.
        req.setQuantityUnit("kg");
        req.setSupplierId("SUP-WIRE");

        when(processingService.createMaterialReceipt(anyString(), any(MaterialBatch.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        controller.createMaterialReceipt("F001", null, req);

        ArgumentCaptor<MaterialBatch> captor = ArgumentCaptor.forClass(MaterialBatch.class);
        Mockito.verify(processingService).createMaterialReceipt(anyString(), captor.capture());
        MaterialBatch mapped = captor.getValue();

        // Resolved FE wire aliases → canonical entity field names
        assertEquals(new BigDecimal("500.00"), mapped.getReceiptQuantity(),
                "wire `quantity` → DTO receiptQuantity → entity receiptQuantity");
        assertEquals(LocalDate.of(2026, 5, 11), mapped.getReceiptDate(),
                "wire `receivedDate` → DTO receiptDate → entity receiptDate");
        assertEquals("kg", mapped.getQuantityUnit(),
                "wire `unit` → DTO quantityUnit → entity quantityUnit");
        assertEquals("SUP-WIRE", mapped.getSupplierId());
    }
}
