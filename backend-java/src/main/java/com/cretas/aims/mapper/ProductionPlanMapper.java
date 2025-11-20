package com.cretas.aims.mapper;

import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.util.UUID;
/**
 * 生产计划实体映射器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Component
public class ProductionPlanMapper {
    /**
     * Entity 转 DTO
     */
    public ProductionPlanDTO toDTO(ProductionPlan plan) {
        if (plan == null) {
            return null;
        }
        ProductionPlanDTO dto = ProductionPlanDTO.builder()
                .id(plan.getId())
                .factoryId(plan.getFactoryId())
                .planNumber(plan.getPlanNumber())
                .productTypeId(plan.getProductTypeId())
                .plannedQuantity(plan.getPlannedQuantity())
                .actualQuantity(plan.getActualQuantity())
                // .plannedDate(plan.getPlannedDate())  // 暂时注释 - 数据库表中没有此字段
                .startTime(plan.getStartTime())
                .endTime(plan.getEndTime())
                .status(plan.getStatus())
                .statusDisplayName(plan.getStatus() != null ? plan.getStatus().getDisplayName() : null)
                .customerOrderNumber(plan.getCustomerOrderNumber())
                .priority(plan.getPriority())
                .estimatedMaterialCost(plan.getEstimatedMaterialCost())
                .actualMaterialCost(plan.getActualMaterialCost())
                .estimatedLaborCost(plan.getEstimatedLaborCost())
                .actualLaborCost(plan.getActualLaborCost())
                .estimatedEquipmentCost(plan.getEstimatedEquipmentCost())
                .actualEquipmentCost(plan.getActualEquipmentCost())
                .estimatedOtherCost(plan.getEstimatedOtherCost())
                .actualOtherCost(plan.getActualOtherCost())
                .notes(plan.getNotes())
                .createdBy(plan.getCreatedBy())
                .createdAt(plan.getCreatedAt())
                .updatedAt(plan.getUpdatedAt())
                .build();
        // 设置产品信息
        if (plan.getProductType() != null) {
            dto.setProductName(plan.getProductType().getName());
            dto.setProductUnit(plan.getProductType().getUnit());
        }
        // 设置创建人姓名
        if (plan.getCreatedByUser() != null) {
            dto.setCreatedByName(plan.getCreatedByUser().getFullName());
        }
        // 计算总成本
        dto.setTotalCost(calculateTotalCost(plan));
        return dto;
    }

    /**
     * CreateRequest 转 Entity
     */
    public ProductionPlan toEntity(CreateProductionPlanRequest request, String factoryId, Integer createdBy) {
        if (request == null) {
            return null;
        }
        ProductionPlan plan = new ProductionPlan();
        plan.setFactoryId(factoryId);
        plan.setPlanNumber(generatePlanNumber());
        plan.setProductTypeId(request.getProductTypeId());
        plan.setPlannedQuantity(request.getPlannedQuantity());
        // plan.setPlannedDate(request.getPlannedDate());  // 暂时注释 - 数据库表中没有此字段
        plan.setStatus(ProductionPlanStatus.PENDING);
        plan.setCustomerOrderNumber(request.getCustomerOrderNumber());
        plan.setPriority(request.getPriority() != null ? request.getPriority() : 5);
        plan.setEstimatedMaterialCost(request.getEstimatedMaterialCost());
        plan.setEstimatedLaborCost(request.getEstimatedLaborCost());
        plan.setEstimatedEquipmentCost(request.getEstimatedEquipmentCost());
        plan.setEstimatedOtherCost(request.getEstimatedOtherCost());
        plan.setNotes(request.getNotes());
        plan.setCreatedBy(createdBy);
        return plan;
    }

    /**
     * 更新实体
     */
    public void updateEntity(ProductionPlan plan, CreateProductionPlanRequest request) {
        if (request.getProductTypeId() != null) {
            plan.setProductTypeId(request.getProductTypeId());
        }
        if (request.getPlannedQuantity() != null) {
            plan.setPlannedQuantity(request.getPlannedQuantity());
        }
        // if (request.getPlannedDate() != null) {  // 暂时注释 - 数据库表中没有此字段
        //     plan.setPlannedDate(request.getPlannedDate());
        // }
        if (request.getCustomerOrderNumber() != null) {
            plan.setCustomerOrderNumber(request.getCustomerOrderNumber());
        }
        if (request.getPriority() != null) {
            plan.setPriority(request.getPriority());
        }
        if (request.getEstimatedMaterialCost() != null) {
            plan.setEstimatedMaterialCost(request.getEstimatedMaterialCost());
        }
        if (request.getEstimatedLaborCost() != null) {
            plan.setEstimatedLaborCost(request.getEstimatedLaborCost());
        }
        if (request.getEstimatedEquipmentCost() != null) {
            plan.setEstimatedEquipmentCost(request.getEstimatedEquipmentCost());
        }
        if (request.getEstimatedOtherCost() != null) {
            plan.setEstimatedOtherCost(request.getEstimatedOtherCost());
        }
        if (request.getNotes() != null) {
            plan.setNotes(request.getNotes());
        }
    }

    /**
     * 生成计划编号
     */
    private String generatePlanNumber() {
        return "PLAN-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * 计算总成本
     */
    private BigDecimal calculateTotalCost(ProductionPlan plan) {
        BigDecimal total = BigDecimal.ZERO;
        if (plan.getActualMaterialCost() != null) {
            total = total.add(plan.getActualMaterialCost());
        } else if (plan.getEstimatedMaterialCost() != null) {
            total = total.add(plan.getEstimatedMaterialCost());
        }
        if (plan.getActualLaborCost() != null) {
            total = total.add(plan.getActualLaborCost());
        } else if (plan.getEstimatedLaborCost() != null) {
            total = total.add(plan.getEstimatedLaborCost());
        }
        if (plan.getActualEquipmentCost() != null) {
            total = total.add(plan.getActualEquipmentCost());
        } else if (plan.getEstimatedEquipmentCost() != null) {
            total = total.add(plan.getEstimatedEquipmentCost());
        }
        if (plan.getActualOtherCost() != null) {
            total = total.add(plan.getActualOtherCost());
        } else if (plan.getEstimatedOtherCost() != null) {
            total = total.add(plan.getEstimatedOtherCost());
        }
        return total;
    }
}
