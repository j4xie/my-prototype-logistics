package com.cretas.aims.controller;

import com.cretas.aims.dto.batch.UpdateBatchRelationRequest;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for
 * {@link BatchRelationController#updateBatchRelation} (Issue #384 batch 5).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link UpdateBatchRelationRequest} instead of the
 *       {@link BatchRelation} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps the DTO to a partial Entity, passing only the 4 mutable fields
 *       (quantityUsed / unit / stage / remarks) per the service's update logic</li>
 *   <li>Leaves unprovided fields as null so the service's {@code if (... != null)}
 *       guards preserve existing DB values</li>
 *   <li>Does NOT touch traceability-critical fields (productionBatchId,
 *       materialBatchId, relationType, verification state) — preserves link
 *       integrity</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class BatchRelationControllerUpdateTest {

    @Mock BatchRelationService batchRelationService;

    @InjectMocks BatchRelationController controller;

    @Test
    void updateBatchRelation_minimumBody_unprovidedFieldsRemainNull() {
        // Empty wire body — every field is optional per UpdateBatchRelationRequest.
        UpdateBatchRelationRequest req = new UpdateBatchRelationRequest();

        when(batchRelationService.updateBatchRelation(eq("rel-001"), any(BatchRelation.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        ResponseEntity<?> resp = controller.updateBatchRelation("F001", "rel-001", req);

        ArgumentCaptor<BatchRelation> captor = ArgumentCaptor.forClass(BatchRelation.class);
        Mockito.verify(batchRelationService).updateBatchRelation(eq("rel-001"), captor.capture());
        BatchRelation mapped = captor.getValue();

        assertNotNull(resp);
        // All 4 mutable fields stay null — service's if(...!=null) guards skip them
        assertNull(mapped.getQuantityUsed());
        assertNull(mapped.getUnit());
        assertNull(mapped.getStage());
        assertNull(mapped.getRemarks());
        // Traceability-critical fields NEVER touched by mapper
        assertNull(mapped.getId(), "id stays null — service uses path variable");
        assertNull(mapped.getFactoryId(), "factoryId immutable through this endpoint");
        assertNull(mapped.getProductionBatchId(), "productionBatchId immutable — preserves trace");
        assertNull(mapped.getMaterialBatchId(), "materialBatchId immutable — preserves trace");
        assertNull(mapped.getRelationType(), "relationType immutable through this endpoint");
        assertNull(mapped.getUsedAt(), "usedAt immutable through this endpoint");
        assertNull(mapped.getOperatorId(), "operatorId immutable through this endpoint");
        assertNull(mapped.getVerified(), "verified state managed via verifyRelation only");
        assertNull(mapped.getVerifiedAt(), "verifiedAt managed via verifyRelation only");
        assertNull(mapped.getVerifiedBy(), "verifiedBy managed via verifyRelation only");
    }

    @Test
    void updateBatchRelation_happyPath_fourMutableFieldsPropagatedByMapper() {
        // All 4 mutable fields set per the service's update list.
        UpdateBatchRelationRequest req = new UpdateBatchRelationRequest();
        req.setQuantityUsed(new BigDecimal("75.250"));
        req.setUnit("g");
        req.setStage("品控检查");
        req.setRemarks("数量更正");

        when(batchRelationService.updateBatchRelation(eq("rel-001"), any(BatchRelation.class)))
                .thenAnswer(inv -> inv.getArgument(1));

        ResponseEntity<?> resp = controller.updateBatchRelation("F001", "rel-001", req);

        ArgumentCaptor<BatchRelation> captor = ArgumentCaptor.forClass(BatchRelation.class);
        Mockito.verify(batchRelationService).updateBatchRelation(eq("rel-001"), captor.capture());
        BatchRelation mapped = captor.getValue();

        assertNotNull(resp);
        assertEquals(new BigDecimal("75.250"), mapped.getQuantityUsed());
        assertEquals("g", mapped.getUnit());
        assertEquals("品控检查", mapped.getStage());
        assertEquals("数量更正", mapped.getRemarks());
    }
}
