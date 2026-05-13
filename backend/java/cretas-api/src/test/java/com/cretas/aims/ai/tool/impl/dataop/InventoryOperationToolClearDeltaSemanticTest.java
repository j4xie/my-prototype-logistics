package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.service.MaterialBatchService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * T-R5-4: InventoryOperationTool CLEAR semantics — the action explicitly
 * computes {@code currentQty.negate()} and expects DELTA math
 * ({@code newQuantity = current + (-current) = 0}). Post-rename it must call
 * {@code applyBatchQuantityDelta}, NOT the absolute overload.
 *
 * <p>Without the rename, an inattentive future refactor could swap to the
 * absolute overload and silently set the batch quantity to negative current
 * (which would either crash or zero-out via the W-03 guard — neither is the
 * desired clear behavior).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("InventoryOperationTool CLEAR uses delta semantics (T-R5-4)")
class InventoryOperationToolClearDeltaSemanticTest {

    @Mock MaterialBatchService materialBatchService;

    @InjectMocks InventoryOperationTool tool;

    @Test
    @DisplayName("CLEAR → applyBatchQuantityDelta(-current); absolute overload never called")
    void clearCallsDeltaOverload() throws Exception {
        MaterialBatchDTO existing = new MaterialBatchDTO();
        existing.setId("B-1");
        existing.setBatchNumber("BN-1");
        existing.setCurrentQuantity(new BigDecimal("12.5"));
        when(materialBatchService.getMaterialBatchById(eq("F001"), eq("B-1"))).thenReturn(existing);

        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B-1");
        params.put("operationType", "CLEAR");
        params.put("confirmed", Boolean.TRUE);

        Method doExecute = tool.getClass().getDeclaredMethod(
                "doExecute", String.class, Map.class, Map.class);
        doExecute.setAccessible(true);
        doExecute.invoke(tool, "F001", params, new HashMap<>());

        verify(materialBatchService, times(1)).applyBatchQuantityDelta(
                eq("F001"), eq("B-1"), eq(new BigDecimal("-12.5")), anyString());
        verify(materialBatchService, never()).adjustBatchQuantity(
                anyString(), anyString(), any(BigDecimal.class), anyString(), any());
    }
}
