package com.cretas.aims.ai.tool.impl.dataop;

import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.service.MaterialBatchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * T-R5-4 (R5 audit §3 BUG#2): BatchUpdateTool exposes its quantity param
 * as "更新后的数量" (absolute / final quantity). Before the fix it called the
 * 4-arg delta overload, so LLM passing {@code quantity=50} ran
 * {@code current + 50} instead of {@code newQuantity = 50}.
 *
 * Post-fix invariant: BatchUpdateTool calls the 5-arg
 * {@code adjustBatchQuantity(factoryId, batchId, newQuantity, reason, userId)}
 * overload (ABSOLUTE math), never the renamed delta overload.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("BatchUpdateTool quantity semantics (T-R5-4)")
class BatchUpdateToolQuantitySemanticTest {

    @Mock MaterialBatchService materialBatchService;

    @InjectMocks BatchUpdateTool tool;

    @BeforeEach
    void wireServiceField() throws Exception {
        // BatchUpdateTool uses @Autowired field injection; @InjectMocks handles it.
        // No additional wiring needed but verify the mock is set.
        Field f = BatchUpdateTool.class.getDeclaredField("materialBatchService");
        f.setAccessible(true);
        // Ensure mock got injected — sanity check, not a behavioral test.
        if (f.get(tool) == null) f.set(tool, materialBatchService);
    }

    @Test
    @DisplayName("doExecute(quantity=50) → calls 5-arg adjustBatchQuantity (ABSOLUTE), not 4-arg delta")
    void quantityUpdateRoutesToAbsoluteOverload() throws Exception {
        MaterialBatchDTO existing = new MaterialBatchDTO();
        existing.setId("B-1");
        existing.setBatchNumber("BN-1");
        when(materialBatchService.getMaterialBatchById(eq("F001"), eq("B-1"))).thenReturn(existing);

        MaterialBatchDTO updated = new MaterialBatchDTO();
        updated.setId("B-1");
        updated.setBatchNumber("BN-1");
        when(materialBatchService.adjustBatchQuantity(eq("F001"), eq("B-1"),
                eq(new BigDecimal("50")), anyString(), any()))
                .thenReturn(updated);

        Map<String, Object> params = new HashMap<>();
        params.put("batchId", "B-1");
        params.put("quantity", new BigDecimal("50"));
        params.put("reason", "盘点调整");

        // Invoke via reflection to bypass the ToolCall wrapper.
        Method doExecute = tool.getClass().getDeclaredMethod(
                "doExecute", String.class, Map.class, Map.class);
        doExecute.setAccessible(true);
        doExecute.invoke(tool, "F001", params, new HashMap<>());

        // 5-arg ABSOLUTE overload must be the one called.
        verify(materialBatchService, times(1)).adjustBatchQuantity(
                eq("F001"), eq("B-1"), eq(new BigDecimal("50")), anyString(), any());
        // Delta overload (now applyBatchQuantityDelta) must NOT be called.
        verify(materialBatchService, never()).applyBatchQuantityDelta(
                anyString(), anyString(), any(BigDecimal.class), anyString());
    }
}
