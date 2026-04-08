package com.cretas.aims.service.warehouse;

import com.cretas.aims.entity.warehouse.ReusableContainer;
import com.cretas.aims.entity.warehouse.ReusableContainerTransaction;
import com.cretas.aims.entity.warehouse.ReusableContainerTransaction.TransactionType;
import com.cretas.aims.repository.warehouse.ReusableContainerRepository;
import com.cretas.aims.repository.warehouse.ReusableContainerTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 周转耗材业务服务 — C4 周转框进销存管理
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReusableContainerService {

    private final ReusableContainerRepository containerRepo;
    private final ReusableContainerTransactionRepository txRepo;

    @Transactional
    public ReusableContainer createContainer(String factoryId, ReusableContainer dto) {
        containerRepo.findByFactoryIdAndContainerCode(factoryId, dto.getContainerCode())
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("周转耗材编号已存在: " + dto.getContainerCode());
                });
        dto.setFactoryId(factoryId);
        if (dto.getTotalQuantity() == null) dto.setTotalQuantity(0);
        // 初始: 全部在库
        dto.setInWarehouseQuantity(dto.getTotalQuantity());
        dto.setInTransitQuantity(0);
        return containerRepo.save(dto);
    }

    public Page<ReusableContainer> listContainers(String factoryId, Pageable pageable) {
        return containerRepo.findByFactoryId(factoryId, pageable);
    }

    public ReusableContainer getContainer(String factoryId, String id) {
        return containerRepo.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new IllegalArgumentException("周转耗材不存在: " + id));
    }

    @Transactional
    public ReusableContainerTransaction shipOut(String factoryId, String containerId,
                                                Integer quantity, String customerId,
                                                String customerName, String salesDeliveryId,
                                                String remark) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("发出数量必须大于 0");
        }
        ReusableContainer c = getContainer(factoryId, containerId);
        if (c.getInWarehouseQuantity() < quantity) {
            throw new IllegalArgumentException("在库数量不足: 当前 " + c.getInWarehouseQuantity()
                    + " 需要 " + quantity);
        }
        c.setInWarehouseQuantity(c.getInWarehouseQuantity() - quantity);
        c.setInTransitQuantity(c.getInTransitQuantity() + quantity);
        containerRepo.save(c);

        ReusableContainerTransaction tx = new ReusableContainerTransaction();
        tx.setFactoryId(factoryId);
        tx.setContainerId(containerId);
        tx.setTransactionType(TransactionType.SHIP_OUT);
        tx.setQuantity(-quantity); // 负数表示发出
        tx.setCustomerId(customerId);
        tx.setCustomerName(customerName);
        tx.setSalesDeliveryId(salesDeliveryId);
        tx.setRemark(remark);
        return txRepo.save(tx);
    }

    @Transactional
    public ReusableContainerTransaction returnIn(String factoryId, String containerId,
                                                 Integer quantity, String customerId,
                                                 String customerName, String remark) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("归还数量必须大于 0");
        }
        ReusableContainer c = getContainer(factoryId, containerId);
        if (c.getInTransitQuantity() < quantity) {
            throw new IllegalArgumentException("在途(客户处)数量不足: 当前 "
                    + c.getInTransitQuantity() + " 归还 " + quantity);
        }
        c.setInTransitQuantity(c.getInTransitQuantity() - quantity);
        c.setInWarehouseQuantity(c.getInWarehouseQuantity() + quantity);
        containerRepo.save(c);

        ReusableContainerTransaction tx = new ReusableContainerTransaction();
        tx.setFactoryId(factoryId);
        tx.setContainerId(containerId);
        tx.setTransactionType(TransactionType.RETURN_IN);
        tx.setQuantity(quantity);
        tx.setCustomerId(customerId);
        tx.setCustomerName(customerName);
        tx.setRemark(remark);
        return txRepo.save(tx);
    }

    @Transactional
    public ReusableContainerTransaction markLoss(String factoryId, String containerId,
                                                 Integer quantity, String customerId,
                                                 String customerName,
                                                 BigDecimal compensationAmount, String remark) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("丢失数量必须大于 0");
        }
        ReusableContainer c = getContainer(factoryId, containerId);
        if (c.getInTransitQuantity() < quantity) {
            throw new IllegalArgumentException("在途数量不足以登记丢失: 当前 "
                    + c.getInTransitQuantity() + " 丢失 " + quantity);
        }
        c.setInTransitQuantity(c.getInTransitQuantity() - quantity);
        c.setTotalQuantity(c.getTotalQuantity() - quantity);
        containerRepo.save(c);

        ReusableContainerTransaction tx = new ReusableContainerTransaction();
        tx.setFactoryId(factoryId);
        tx.setContainerId(containerId);
        tx.setTransactionType(TransactionType.LOSS);
        tx.setQuantity(-quantity);
        tx.setCustomerId(customerId);
        tx.setCustomerName(customerName);
        tx.setCompensationAmount(compensationAmount);
        tx.setRemark(remark);
        return txRepo.save(tx);
    }

    public List<ReusableContainerTransaction> listTransactions(String factoryId, String containerId) {
        return txRepo.findByFactoryIdAndContainerIdOrderByCreatedAtDesc(factoryId, containerId);
    }

    public List<Map<String, Object>> customerBalances(String factoryId) {
        var rows = txRepo.findCustomerBalances(factoryId);
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (var row : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("customerId", row.getCustomerId());
            m.put("customerName", row.getCustomerName());
            m.put("containerId", row.getContainerId());
            m.put("inUseQuantity", row.getInUseQuantity());
            out.add(m);
        }
        return out;
    }
}
