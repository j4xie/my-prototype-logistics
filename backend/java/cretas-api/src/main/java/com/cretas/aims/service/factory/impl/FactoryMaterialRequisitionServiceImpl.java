package com.cretas.aims.service.factory.impl;

import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.bom.BomItem;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition;
import com.cretas.aims.entity.factory.FactoryMaterialRequisition.Status;
import com.cretas.aims.entity.factory.FactoryMaterialRequisitionItem;
import com.cretas.aims.entity.factory.FactoryMaterialRequisitionItem.MaterialCategory;
import com.cretas.aims.entity.factory.FactoryWarehouse;
import com.cretas.aims.entity.factory.FactoryWarehouse.WarehouseType;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.bom.BomItemRepository;
import com.cretas.aims.repository.factory.FactoryMaterialRequisitionItemRepository;
import com.cretas.aims.repository.factory.FactoryMaterialRequisitionRepository;
import com.cretas.aims.repository.factory.FactoryWarehouseRepository;
import com.cretas.aims.service.factory.FactoryMaterialRequisitionService;
import com.cretas.aims.service.inventory.TransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 工厂物料需求单 Service 实现 (P0-5, W2-3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FactoryMaterialRequisitionServiceImpl implements FactoryMaterialRequisitionService {

    private final FactoryMaterialRequisitionRepository repository;
    private final FactoryMaterialRequisitionItemRepository itemRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final BomItemRepository bomItemRepository;
    private final TransferService transferService;
    private final FactoryWarehouseRepository warehouseRepository;

    /** Canvas V2: DB-driven validation rules */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.engine.ValidationRuleEvaluator validationRuleEvaluator;

    private void runConfiguredValidation(String factoryId, String operation, java.util.Map<String, Object> context) {
        if (validationRuleEvaluator == null) return;
        try {
            validationRuleEvaluator.validate(factoryId, "material_requisition", operation, context);
        } catch (com.cretas.aims.exception.BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Canvas validation non-blocking error: {}", e.getMessage());
        }
    }

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Override
    @Transactional
    public FactoryMaterialRequisition generateFromPlan(String factoryId, String productionPlanId, Long requestedBy) {
        runConfiguredValidation(factoryId, "CREATE", java.util.Map.of(
            "status", "PENDING",
            "planId", productionPlanId != null ? productionPlanId : ""));
        ProductionPlan plan = productionPlanRepository.findByIdAndFactoryId(productionPlanId, factoryId)
                .orElseThrow(() -> new BusinessException("生产计划不存在: " + productionPlanId));

        // 按 BOM 展开
        List<BomItem> bomItems = bomItemRepository
                .findByFactoryIdAndProductTypeIdAndDeletedAtIsNullOrderBySortOrderAsc(factoryId, plan.getProductTypeId());
        if (bomItems.isEmpty()) {
            throw new BusinessException("产品 BOM 未配置, 无法生成物料需求单: productTypeId=" + plan.getProductTypeId());
        }

        FactoryMaterialRequisition mr = new FactoryMaterialRequisition();
        mr.setFactoryId(factoryId);
        mr.setRequisitionNo(generateRequisitionNo(factoryId));
        mr.setProductionPlanId(productionPlanId);
        mr.setStatus(Status.PENDING);
        mr.setRequiredDate(plan.getExpectedCompletionDate());
        mr.setRequestedBy(requestedBy);

        // P1-4: auto-populate source (物流仓) + target (鲜棉仓) from FactoryWarehouse lookup
        // 为 B1 InternalTransfer 流水提供 warehouse 上下文 (之前是 null).
        List<FactoryWarehouse> logisticsList = warehouseRepository
                .findByFactoryIdAndTypeAndDeletedAtIsNullOrderByCodeAsc(factoryId, WarehouseType.LOGISTICS);
        List<FactoryWarehouse> workshopList = warehouseRepository
                .findByFactoryIdAndTypeAndDeletedAtIsNullOrderByCodeAsc(factoryId, WarehouseType.WORKSHOP);
        if (!logisticsList.isEmpty()) {
            mr.setSourceWarehouseId(logisticsList.get(0).getId());
        }
        if (!workshopList.isEmpty()) {
            mr.setTargetWarehouseId(workshopList.get(0).getId());
        }

        BigDecimal plannedQty = plan.getPlannedQuantity() != null ? plan.getPlannedQuantity() : BigDecimal.ZERO;
        for (BomItem bom : bomItems) {
            FactoryMaterialRequisitionItem item = new FactoryMaterialRequisitionItem();
            item.setRequisition(mr);
            item.setMaterialTypeId(bom.getMaterialTypeId());
            item.setMaterialName(bom.getMaterialName());
            // P0-14: 从 BOM 透传物料分类 (RAW/AUXILIARY/PACKAGING)
            MaterialCategory category = MaterialCategory.RAW;
            if (bom.getMaterialCategory() != null) {
                try {
                    category = MaterialCategory.valueOf(bom.getMaterialCategory());
                } catch (IllegalArgumentException ex) {
                    log.warn("未知的 BOM materialCategory={}, 降级为 RAW", bom.getMaterialCategory());
                }
            }
            item.setMaterialCategory(category);
            item.setBomItemId(bom.getId());
            // required_qty = planned_quantity * actual_quantity (按出成率调整)
            BigDecimal perUnit = bom.getActualQuantity();
            item.setRequiredQty(plannedQty.multiply(perUnit));
            item.setUnit(bom.getUnit());
            mr.getItems().add(item);
        }

        FactoryMaterialRequisition saved = repository.save(mr);
        log.info("✅ 生成物料需求单: {} factory={} plan={} items={}",
                saved.getRequisitionNo(), factoryId, productionPlanId, saved.getItems().size());
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public FactoryMaterialRequisition getById(String factoryId, String id) {
        FactoryMaterialRequisition mr = repository.findByIdAndFactoryIdAndDeletedAtIsNull(id, factoryId)
                .orElseThrow(() -> new BusinessException("物料需求单不存在: " + id));
        // 触发懒加载
        mr.getItems().size();
        return mr;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FactoryMaterialRequisition> list(String factoryId, Status status, Pageable pageable) {
        if (status == null) {
            return repository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
        }
        return repository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, status, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FactoryMaterialRequisition> listByPlan(String factoryId, String productionPlanId) {
        return repository.findByFactoryIdAndProductionPlanIdAndDeletedAtIsNull(factoryId, productionPlanId);
    }

    @Override
    @Transactional
    public FactoryMaterialRequisition startPicking(String factoryId, String id, Long operatorId) {
        runConfiguredValidation(factoryId, "UPDATE", java.util.Map.of(
            "status", "PICKING",
            "planId", id != null ? id : ""));
        FactoryMaterialRequisition mr = getById(factoryId, id);
        assertStatus(mr, Status.PENDING);
        mr.setStatus(Status.PICKING);
        mr.setPickedBy(operatorId);
        return repository.save(mr);
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public FactoryMaterialRequisition confirmPicking(String factoryId, String id, Long operatorId, List<Map<String, Object>> items) {
        FactoryMaterialRequisition mr = getById(factoryId, id);
        assertStatus(mr, Status.PICKING);

        Map<String, FactoryMaterialRequisitionItem> byId = new HashMap<>();
        for (FactoryMaterialRequisitionItem it : mr.getItems()) {
            byId.put(it.getId(), it);
        }

        for (Map<String, Object> input : items) {
            String itemId = (String) input.get("itemId");
            FactoryMaterialRequisitionItem item = byId.get(itemId);
            if (item == null) continue;
            Object pickedQty = input.get("pickedQty");
            if (pickedQty != null) {
                item.setPickedQty(new BigDecimal(pickedQty.toString()));
            }
            Object batches = input.get("batchNumbers");
            if (batches instanceof List) {
                item.setBatchNumbers((List<Map<String, Object>>) batches);
            }
        }

        mr.setPickedBy(operatorId);
        mr.setPickedAt(LocalDateTime.now());
        return repository.save(mr);
    }

    @Override
    @Transactional
    public FactoryMaterialRequisition transferToFactory(String factoryId, String id, Long operatorId) {
        FactoryMaterialRequisition mr = getById(factoryId, id);
        assertStatus(mr, Status.PICKING);
        // 所有行 issued_qty = picked_qty
        for (FactoryMaterialRequisitionItem it : mr.getItems()) {
            it.setIssuedQty(it.getPickedQty());
        }
        mr.setStatus(Status.TRANSFERRED);
        mr.setTransferredBy(operatorId);
        mr.setTransferredAt(LocalDateTime.now());

        // P0-5: 创建备料调出 InternalTransfer (物流仓 → 工厂鲜棉仓)
        List<CreateTransferRequest.TransferItemDTO> outboundItems = new ArrayList<>();
        for (FactoryMaterialRequisitionItem it : mr.getItems()) {
            BigDecimal issued = it.getIssuedQty();
            if (issued != null && issued.compareTo(BigDecimal.ZERO) > 0) {
                outboundItems.add(new CreateTransferRequest.TransferItemDTO(
                        "RAW_MATERIAL",
                        it.getMaterialTypeId(),
                        null,
                        it.getMaterialName(),
                        issued,
                        it.getUnit() != null ? it.getUnit() : "kg",
                        null,
                        "备料调出: " + mr.getRequisitionNo()
                ));
            }
        }
        if (!outboundItems.isEmpty()) {
            CreateTransferRequest req = new CreateTransferRequest();
            req.setTransferType("FACTORY_TO_FACTORY");
            req.setTargetFactoryId(factoryId);
            req.setSourceWarehouseId(mr.getSourceWarehouseId());
            req.setTargetWarehouseId(mr.getTargetWarehouseId());
            req.setTransferDate(LocalDate.now());
            req.setRemark("物料需求单 " + mr.getRequisitionNo() + " 备料调出");
            req.setItems(outboundItems);
            InternalTransfer outbound = transferService.createTransfer(factoryId, req, operatorId);
            mr.setOutboundTransferId(outbound.getId());
            log.info("✅ 物料需求单 {} 备料调出 InternalTransfer 已创建: {}",
                    mr.getRequisitionNo(), outbound.getId());
        }

        return repository.save(mr);
    }

    @Override
    @Transactional
    public FactoryMaterialRequisition receive(String factoryId, String id, Long operatorId) {
        FactoryMaterialRequisition mr = getById(factoryId, id);
        assertStatus(mr, Status.TRANSFERRED);
        mr.setStatus(Status.ISSUED);
        mr.setReceivedBy(operatorId);
        mr.setReceivedAt(LocalDateTime.now());
        return repository.save(mr);
    }

    @Override
    @Transactional
    public FactoryMaterialRequisition close(String factoryId, String id, Long operatorId) {
        FactoryMaterialRequisition mr = getById(factoryId, id);
        if (mr.getStatus() != Status.ISSUED && mr.getStatus() != Status.IN_USE) {
            throw new BusinessException("状态 " + mr.getStatus() + " 不允许关单");
        }
        // 自动计算退料 returned = issued - consumed
        for (FactoryMaterialRequisitionItem it : mr.getItems()) {
            BigDecimal issued = it.getIssuedQty() != null ? it.getIssuedQty() : BigDecimal.ZERO;
            BigDecimal consumed = it.getConsumedQty() != null ? it.getConsumedQty() : BigDecimal.ZERO;
            BigDecimal returned = issued.subtract(consumed);
            if (returned.compareTo(BigDecimal.ZERO) < 0) returned = BigDecimal.ZERO;
            it.setReturnedQty(returned);
        }
        mr.setStatus(Status.CLOSED);
        mr.setClosedBy(operatorId);
        mr.setClosedAt(LocalDateTime.now());

        // P0-5: 创建退料调入 InternalTransfer (工厂鲜棉仓 → 物流仓), 仅在有退料时
        List<CreateTransferRequest.TransferItemDTO> returnItems = new ArrayList<>();
        for (FactoryMaterialRequisitionItem it : mr.getItems()) {
            BigDecimal returned = it.getReturnedQty();
            if (returned != null && returned.compareTo(BigDecimal.ZERO) > 0) {
                returnItems.add(new CreateTransferRequest.TransferItemDTO(
                        "RAW_MATERIAL",
                        it.getMaterialTypeId(),
                        null,
                        it.getMaterialName(),
                        returned,
                        it.getUnit() != null ? it.getUnit() : "kg",
                        null,
                        "退料调入: " + mr.getRequisitionNo()
                ));
            }
        }
        if (!returnItems.isEmpty()) {
            CreateTransferRequest req = new CreateTransferRequest();
            req.setTransferType("FACTORY_TO_FACTORY");
            req.setTargetFactoryId(factoryId);
            req.setSourceWarehouseId(mr.getTargetWarehouseId());
            req.setTargetWarehouseId(mr.getSourceWarehouseId());
            req.setTransferDate(LocalDate.now());
            req.setRemark("物料需求单 " + mr.getRequisitionNo() + " 退料调入");
            req.setItems(returnItems);
            InternalTransfer returnTransfer = transferService.createTransfer(factoryId, req, operatorId);
            mr.setReturnTransferId(returnTransfer.getId());
            log.info("✅ 物料需求单 {} 退料调入 InternalTransfer 已创建: {}",
                    mr.getRequisitionNo(), returnTransfer.getId());
        }

        return repository.save(mr);
    }

    @Override
    @Transactional
    public FactoryMaterialRequisition cancel(String factoryId, String id, Long operatorId, String reason) {
        FactoryMaterialRequisition mr = getById(factoryId, id);
        if (mr.getStatus() == Status.CLOSED || mr.getStatus() == Status.CANCELLED) {
            throw new BusinessException("状态 " + mr.getStatus() + " 不允许取消");
        }
        mr.setStatus(Status.CANCELLED);
        mr.setRemarks((mr.getRemarks() == null ? "" : mr.getRemarks() + " | ") + "取消原因: " + reason);
        return repository.save(mr);
    }

    // ---------- helpers ----------

    private String generateRequisitionNo(String factoryId) {
        String datePart = LocalDateTime.now().format(DATE_FMT);
        String prefix = "MR" + datePart;
        long count = repository.countByFactoryIdAndRequisitionNoPrefix(factoryId, prefix);
        return String.format("%s-%04d", prefix, count + 1);
    }

    private void assertStatus(FactoryMaterialRequisition mr, Status expected) {
        if (mr.getStatus() != expected) {
            throw new BusinessException("状态不匹配: 需要 " + expected + ", 当前 " + mr.getStatus());
        }
    }
}
