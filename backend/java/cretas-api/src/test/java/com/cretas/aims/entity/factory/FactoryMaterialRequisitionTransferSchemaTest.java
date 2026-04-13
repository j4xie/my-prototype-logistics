package com.cretas.aims.entity.factory;

import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.inventory.InternalTransfer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * V3 P0-5 / W2 Phase A — InternalTransfer 双仓调拨字段 + FMR 关联字段.
 *
 * <p>客户 v1 §2.3 / 会议 3128s 原话: 物料需求单 → 仓库备料 → 工厂调拨 → 报工 → 退料.
 * 需要 InternalTransfer 支持工厂内跨仓 (sourceWarehouseId/targetWarehouseId).
 * FactoryMaterialRequisition 需关联 2 个 transfer (outbound 调出 + return 退料).
 */
class FactoryMaterialRequisitionTransferSchemaTest {

    @Test
    void internalTransfer_shouldHaveSourceWarehouseIdField() {
        assertDoesNotThrow(() -> InternalTransfer.class.getDeclaredField("sourceWarehouseId"));
    }

    @Test
    void internalTransfer_shouldHaveTargetWarehouseIdField() {
        assertDoesNotThrow(() -> InternalTransfer.class.getDeclaredField("targetWarehouseId"));
    }

    @Test
    void createTransferRequest_shouldHaveSourceWarehouseIdField() {
        assertDoesNotThrow(() -> CreateTransferRequest.class.getDeclaredField("sourceWarehouseId"));
    }

    @Test
    void createTransferRequest_shouldHaveTargetWarehouseIdField() {
        assertDoesNotThrow(() -> CreateTransferRequest.class.getDeclaredField("targetWarehouseId"));
    }

    @Test
    void factoryMaterialRequisition_shouldHaveOutboundTransferIdField() {
        assertDoesNotThrow(() -> FactoryMaterialRequisition.class.getDeclaredField("outboundTransferId"));
    }

    @Test
    void factoryMaterialRequisition_shouldHaveReturnTransferIdField() {
        assertDoesNotThrow(() -> FactoryMaterialRequisition.class.getDeclaredField("returnTransferId"));
    }
}
