package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.service.inventory.impl.SalesServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Issue #786 follow-up regression test — single-item lookup for FinishedGoodsBatch.
 *
 * <p>Verifies factory-isolation enforcement (no cross-factory leak) and 404 when missing.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SalesServiceImpl 单成品批次查询 (Issue #786)")
class SalesServiceImplFinishedGoodsByIdTest {

    @Mock FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    SalesServiceImpl salesService;

    private static final String FACTORY_ID = "F001";
    private static final String OTHER_FACTORY = "F999";
    private static final String BATCH_ID = "FG-001";

    @BeforeEach
    void setUp() {
        // SalesServiceImpl 8-arg ctor (per existing SalesServiceImplSalespersonTest pattern).
        salesService = new SalesServiceImpl(
                null, null, null, finishedGoodsBatchRepository,
                null, null, null, null);
    }

    @Test
    @DisplayName("正常查询 → 返回 batch entity")
    void getFinishedGoodsBatchById_sameFactory_returns() {
        FinishedGoodsBatch batch = new FinishedGoodsBatch();
        batch.setId(BATCH_ID);
        batch.setFactoryId(FACTORY_ID);
        batch.setBatchNumber("FG-20260517-001");
        when(finishedGoodsBatchRepository.findById(BATCH_ID))
                .thenReturn(Optional.of(batch));

        FinishedGoodsBatch result = salesService.getFinishedGoodsBatchById(FACTORY_ID, BATCH_ID);
        assertEquals(BATCH_ID, result.getId());
        assertEquals("FG-20260517-001", result.getBatchNumber());
    }

    @Test
    @DisplayName("跨工厂访问 → throw BusinessException 403")
    void getFinishedGoodsBatchById_crossFactory_throwsForbidden() {
        FinishedGoodsBatch batch = new FinishedGoodsBatch();
        batch.setId(BATCH_ID);
        batch.setFactoryId(OTHER_FACTORY);  // belongs to other factory
        when(finishedGoodsBatchRepository.findById(BATCH_ID))
                .thenReturn(Optional.of(batch));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> salesService.getFinishedGoodsBatchById(FACTORY_ID, BATCH_ID));
        assertEquals(403, ex.getCode());
    }

    @Test
    @DisplayName("批次不存在 → throw ResourceNotFoundException 404")
    void getFinishedGoodsBatchById_notFound_throws404() {
        when(finishedGoodsBatchRepository.findById(BATCH_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> salesService.getFinishedGoodsBatchById(FACTORY_ID, BATCH_ID));
    }
}
