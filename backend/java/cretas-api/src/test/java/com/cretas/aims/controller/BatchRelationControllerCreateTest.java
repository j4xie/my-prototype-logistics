package com.cretas.aims.controller;

import com.cretas.aims.dto.batch.CreateBatchRelationRequest;
import com.cretas.aims.entity.BatchRelation;
import com.cretas.aims.service.BatchRelationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for
 * {@link BatchRelationController#createBatchRelation} (Issue #384 batch 5).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link CreateBatchRelationRequest} instead of the
 *       {@link BatchRelation} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps the DTO to the Entity at the controller boundary, leaving
 *       service-owned defaults (id UUID-fallback, relationType INPUT-fallback,
 *       verified false, usedAt now-fallback) untouched by the mapper</li>
 *   <li>Sets {@code factoryId} from {@code @PathVariable} + {@code operatorId}
 *       from {@code @RequestAttribute("userId")} after mapping</li>
 *   <li>Does NOT duplicate service-owned defaults (single source of truth
 *       lives in {@code BatchRelationServiceImpl.createBatchRelation})</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class BatchRelationControllerCreateTest {

    @Mock BatchRelationService batchRelationService;

    @InjectMocks BatchRelationController controller;

    @Test
    void createBatchRelation_minimumBody_factoryIdAndOperatorIdFromContext_serviceDefaultsNotLeakedToMapper() {
        // Minimum wire body: required fields only. NO id (service UUID).
        // NO relationType (service "INPUT"). NO verified (service false).
        // NO usedAt (service now). NO factoryId/operatorId (controller injects).
        CreateBatchRelationRequest req = new CreateBatchRelationRequest();
        req.setProductionBatchId(12345L);
        req.setMaterialBatchId("MB-F001-ABC");

        when(batchRelationService.createBatchRelation(any(BatchRelation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.createBatchRelation("F001", 99L, req);

        ArgumentCaptor<BatchRelation> captor = ArgumentCaptor.forClass(BatchRelation.class);
        Mockito.verify(batchRelationService).createBatchRelation(captor.capture());
        BatchRelation mapped = captor.getValue();

        assertNotNull(resp);
        // Wire-side fields propagated by mapper
        assertEquals(12345L, mapped.getProductionBatchId());
        assertEquals("MB-F001-ABC", mapped.getMaterialBatchId());
        // Controller sets factoryId / operatorId AFTER mapper
        assertEquals("F001", mapped.getFactoryId());
        assertEquals(99L, mapped.getOperatorId());
        // Mapper does NOT pre-fill service-owned defaults (single source of truth)
        assertNull(mapped.getId(), "id UUID-fallback belongs to service");
        assertNull(mapped.getRelationType(), "relationType INPUT-fallback belongs to service");
        assertNull(mapped.getVerified(), "verified false-default belongs to service");
        assertNull(mapped.getUsedAt(), "usedAt now-fallback belongs to service");
        assertNull(mapped.getVerifiedAt(), "verifiedAt set later via verifyRelation");
        assertNull(mapped.getVerifiedBy(), "verifiedBy set later via verifyRelation");
        // Optional wire fields default to null
        assertNull(mapped.getQuantityUsed());
        assertNull(mapped.getUnit());
        assertNull(mapped.getStage());
        assertNull(mapped.getRemarks());
    }

    @Test
    void createBatchRelation_happyPath_allFieldsPropagatedByMapper() {
        // Full wire body
        LocalDateTime explicitUsedAt = LocalDateTime.of(2026, 5, 11, 10, 30, 0);
        CreateBatchRelationRequest req = new CreateBatchRelationRequest();
        req.setId("rel-explicit-001");
        req.setProductionBatchId(99999L);
        req.setMaterialBatchId("MB-F002-XYZ");
        req.setRelationType("OUTPUT");
        req.setQuantityUsed(new BigDecimal("50.500"));
        req.setUnit("kg");
        req.setUsedAt(explicitUsedAt);
        req.setStage("加工阶段-2");
        req.setRemarks("批次混合");

        when(batchRelationService.createBatchRelation(any(BatchRelation.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = controller.createBatchRelation("F002", 1234L, req);

        ArgumentCaptor<BatchRelation> captor = ArgumentCaptor.forClass(BatchRelation.class);
        Mockito.verify(batchRelationService).createBatchRelation(captor.capture());
        BatchRelation mapped = captor.getValue();

        assertNotNull(resp);
        assertEquals("F002", mapped.getFactoryId());
        assertEquals(1234L, mapped.getOperatorId());
        assertEquals("rel-explicit-001", mapped.getId());
        assertEquals(99999L, mapped.getProductionBatchId());
        assertEquals("MB-F002-XYZ", mapped.getMaterialBatchId());
        assertEquals("OUTPUT", mapped.getRelationType());
        assertEquals(new BigDecimal("50.500"), mapped.getQuantityUsed());
        assertEquals("kg", mapped.getUnit());
        assertEquals(explicitUsedAt, mapped.getUsedAt());
        assertEquals("加工阶段-2", mapped.getStage());
        assertEquals("批次混合", mapped.getRemarks());
    }

    @Test
    void createBatchRelation_responseEnvelope_successTrueDataPresent() {
        CreateBatchRelationRequest req = new CreateBatchRelationRequest();
        req.setProductionBatchId(1L);
        req.setMaterialBatchId("MB-001");

        BatchRelation saved = new BatchRelation();
        saved.setId("uuid-001");
        saved.setFactoryId("F001");
        when(batchRelationService.createBatchRelation(any(BatchRelation.class)))
                .thenReturn(saved);

        ResponseEntity<?> resp = controller.createBatchRelation("F001", 99L, req);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("批次关联创建成功", body.get("message"));
        assertEquals(saved, body.get("data"));
    }
}
