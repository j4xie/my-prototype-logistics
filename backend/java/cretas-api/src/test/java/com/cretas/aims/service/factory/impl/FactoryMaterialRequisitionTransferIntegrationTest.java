package com.cretas.aims.service.factory.impl;

import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition.Status;
import com.cretas.aims.entity.factory.FactoryMaterialRequisitionItem;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.bom.BomItemRepository;
import com.cretas.aims.repository.factory.FactoryMaterialRequisitionItemRepository;
import com.cretas.aims.repository.factory.FactoryMaterialRequisitionRepository;
import com.cretas.aims.service.inventory.TransferService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * V3 P0-5 / W2 Phase B — FMR ↔ TransferService 双向集成.
 *
 * <p>客户 v1 §2.3 / 会议 3128s: 物料需求单 → 备料 → 调拨 → 报工 → 退料.
 *
 * <ul>
 *   <li>transferToFactory: 创建 outbound InternalTransfer (物流仓 → 工厂鲜棉仓)</li>
 *   <li>close (returned>0): 创建 reverse InternalTransfer (工厂鲜棉仓 → 物流仓)</li>
 *   <li>close (returned=0): 不创建 transfer (无退料)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FactoryMaterialRequisition ↔ TransferService 集成")
class FactoryMaterialRequisitionTransferIntegrationTest {

    private static final String FACTORY_ID = "F001";
    private static final String MR_ID = "mr-001";
    private static final String WH_LOGISTICS = "wh-logistics";
    private static final String WH_WORKSHOP = "wh-workshop";
    private static final Long OPERATOR = 99L;

    @Mock
    private FactoryMaterialRequisitionRepository repository;
    @Mock
    private FactoryMaterialRequisitionItemRepository itemRepository;
    @Mock
    private ProductionPlanRepository productionPlanRepository;
    @Mock
    private BomItemRepository bomItemRepository;
    @Mock
    private TransferService transferService;

    @InjectMocks
    private FactoryMaterialRequisitionServiceImpl service;

    private FactoryMaterialRequisition buildMrInPicking() {
        FactoryMaterialRequisition mr = new FactoryMaterialRequisition();
        mr.setId(MR_ID);
        mr.setFactoryId(FACTORY_ID);
        mr.setRequisitionNo("MR-20260411-0001");
        mr.setStatus(Status.PICKING);
        mr.setSourceWarehouseId(WH_LOGISTICS);
        mr.setTargetWarehouseId(WH_WORKSHOP);

        FactoryMaterialRequisitionItem it1 = new FactoryMaterialRequisitionItem();
        it1.setId("it-1");
        it1.setRequisition(mr);
        it1.setMaterialTypeId("MAT-001");
        it1.setMaterialName("带鱼段");
        it1.setPickedQty(new BigDecimal("10.00"));
        it1.setUnit("kg");

        FactoryMaterialRequisitionItem it2 = new FactoryMaterialRequisitionItem();
        it2.setId("it-2");
        it2.setRequisition(mr);
        it2.setMaterialTypeId("MAT-002");
        it2.setMaterialName("盐");
        it2.setPickedQty(new BigDecimal("0.50"));
        it2.setUnit("kg");

        List<FactoryMaterialRequisitionItem> items = new ArrayList<>();
        items.add(it1);
        items.add(it2);
        mr.setItems(items);
        return mr;
    }

    private FactoryMaterialRequisition buildMrInIssued(BigDecimal it1Issued, BigDecimal it1Consumed,
                                                         BigDecimal it2Issued, BigDecimal it2Consumed) {
        FactoryMaterialRequisition mr = buildMrInPicking();
        mr.setStatus(Status.ISSUED);
        mr.getItems().get(0).setIssuedQty(it1Issued);
        mr.getItems().get(0).setConsumedQty(it1Consumed);
        mr.getItems().get(1).setIssuedQty(it2Issued);
        mr.getItems().get(1).setConsumedQty(it2Consumed);
        return mr;
    }

    @BeforeEach
    void setup() {
        InternalTransfer stubTransfer = new InternalTransfer();
        stubTransfer.setId("tr-stub-1");
        lenient().when(transferService.createTransfer(any(), any(), any())).thenReturn(stubTransfer);
    }

    @Test
    @DisplayName("transferToFactory 应创建调出 InternalTransfer (物流仓→工厂仓)")
    void transferToFactory_shouldCreateOutboundTransfer() {
        FactoryMaterialRequisition mr = buildMrInPicking();
        when(repository.findByIdAndFactoryIdAndDeletedAtIsNull(MR_ID, FACTORY_ID))
                .thenReturn(Optional.of(mr));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.transferToFactory(FACTORY_ID, MR_ID, OPERATOR);

        ArgumentCaptor<CreateTransferRequest> captor = ArgumentCaptor.forClass(CreateTransferRequest.class);
        verify(transferService).createTransfer(eq(FACTORY_ID), captor.capture(), eq(OPERATOR));
        CreateTransferRequest req = captor.getValue();

        assertEquals(FACTORY_ID, req.getTargetFactoryId(), "intra-factory transfer 必须 target=自己 factoryId");
        assertEquals(WH_LOGISTICS, req.getSourceWarehouseId(), "调出仓应为物流仓");
        assertEquals(WH_WORKSHOP, req.getTargetWarehouseId(), "调入仓应为工厂鲜棉仓");
        assertEquals(2, req.getItems().size(), "2 个物料行应全部透传");
        assertEquals("tr-stub-1", mr.getOutboundTransferId(), "outboundTransferId 应回填");
    }

    @Test
    @DisplayName("close 若有退料 (returned>0) 应创建反向 InternalTransfer (工厂仓→物流仓)")
    void close_withReturnedQty_shouldCreateReverseTransfer() {
        // it1: issued=10, consumed=8 → returned=2
        // it2: issued=0.5, consumed=0.5 → returned=0
        FactoryMaterialRequisition mr = buildMrInIssued(
                new BigDecimal("10.00"), new BigDecimal("8.00"),
                new BigDecimal("0.50"), new BigDecimal("0.50"));
        when(repository.findByIdAndFactoryIdAndDeletedAtIsNull(MR_ID, FACTORY_ID))
                .thenReturn(Optional.of(mr));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.close(FACTORY_ID, MR_ID, OPERATOR);

        ArgumentCaptor<CreateTransferRequest> captor = ArgumentCaptor.forClass(CreateTransferRequest.class);
        verify(transferService).createTransfer(eq(FACTORY_ID), captor.capture(), eq(OPERATOR));
        CreateTransferRequest req = captor.getValue();

        assertEquals(WH_WORKSHOP, req.getSourceWarehouseId(), "退料调出仓应为工厂鲜棉仓 (反向)");
        assertEquals(WH_LOGISTICS, req.getTargetWarehouseId(), "退料调入仓应为物流仓 (反向)");
        assertEquals(1, req.getItems().size(), "只有 1 个物料退料, 应只透传 1 行");
        assertEquals("tr-stub-1", mr.getReturnTransferId(), "returnTransferId 应回填");
    }

    @Test
    @DisplayName("close 若无退料 (returned=0) 不应创建 InternalTransfer")
    void close_withoutReturnedQty_shouldNotCreateTransfer() {
        // it1: issued=10, consumed=10 → returned=0
        // it2: issued=0.5, consumed=0.5 → returned=0
        FactoryMaterialRequisition mr = buildMrInIssued(
                new BigDecimal("10.00"), new BigDecimal("10.00"),
                new BigDecimal("0.50"), new BigDecimal("0.50"));
        when(repository.findByIdAndFactoryIdAndDeletedAtIsNull(MR_ID, FACTORY_ID))
                .thenReturn(Optional.of(mr));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.close(FACTORY_ID, MR_ID, OPERATOR);

        verify(transferService, never()).createTransfer(any(), any(), any());
        assertNull(mr.getReturnTransferId(), "无退料时 returnTransferId 应为 null");
    }
}
