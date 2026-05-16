package com.cretas.aims.service.voucher.impl;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.service.voucher.AbstractVoucherGenerator;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 库存调拨凭证 generator.
 *
 * 借: 1405 库存商品 / cost_center=target_warehouse
 * 贷: 1405 库存商品 / cost_center=source_warehouse
 *
 * 同科目调拨: 借贷同 1405, 通过 cost_center 区分仓库.
 * 跨工厂调拨可通过 cost_center 内嵌 factory_id 实现 (此实现先用 warehouse 兼容).
 */
@Component
public class InventoryTransferVoucherGenerator extends AbstractVoucherGenerator<InternalTransfer> {

    public static final String BUSINESS_TYPE = "INTERNAL_TRANSFER";

    @Override
    public VoucherType getType() {
        return VoucherType.INVENTORY_TRANSFER;
    }

    @Override
    public boolean supports(String businessType) {
        return BUSINESS_TYPE.equals(businessType);
    }

    @Override
    protected String extractSourceBusinessType() {
        return BUSINESS_TYPE;
    }

    @Override
    protected String extractSourceBusinessId(InternalTransfer t) {
        return t.getId();
    }

    @Override
    protected LocalDate extractVoucherDate(InternalTransfer t) {
        return t.getTransferDate();
    }

    @Override
    protected String extractDescription(InternalTransfer t) {
        return "调拨单 " + t.getTransferNumber();
    }

    @Override
    public List<VoucherEntry> buildEntries(InternalTransfer t) {
        BigDecimal amount = nullToZero(t.getTotalAmount());
        VoucherEntry debit = debitEntry(1, "1405", "库存商品", amount, "调入: " + t.getTransferNumber());
        VoucherEntry credit = creditEntry(2, "1405", "库存商品", amount, "调出: " + t.getTransferNumber());
        // cost_center 区分调入/调出方
        debit.setCostCenter(buildCostCenter(t.getTargetFactoryId(), t.getTargetWarehouseId(), "调入"));
        credit.setCostCenter(buildCostCenter(t.getSourceFactoryId(), t.getSourceWarehouseId(), "调出"));
        return List.of(debit, credit);
    }

    private String buildCostCenter(String factoryId, String warehouseId, String label) {
        return label + ":" + (factoryId != null ? factoryId : "?") +
                (warehouseId != null ? "/" + warehouseId : "");
    }
}
