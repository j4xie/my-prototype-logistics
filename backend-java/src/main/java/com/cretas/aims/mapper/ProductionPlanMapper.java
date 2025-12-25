package com.cretas.aims.mapper;

import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.ProductionPlanType;
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
                // plannedDate 从 startTime 推导，保持API兼容性
                .plannedDate(plan.getStartTime() != null ? plan.getStartTime().toLocalDate() : null)
                .startTime(plan.getStartTime())
                .endTime(plan.getEndTime())
                .expectedCompletionDate(plan.getExpectedCompletionDate())
                .status(plan.getStatus())
                .statusDisplayName(plan.getStatus() != null ? plan.getStatus().getDisplayName() : null)
                .planType(plan.getPlanType())
                .planTypeDisplayName(getPlanTypeDisplayName(plan.getPlanType()))
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

        // 设置未来计划匹配相关字段
        dto.setAllocatedQuantity(plan.getAllocatedQuantity());
        dto.setIsFullyMatched(plan.getIsFullyMatched());
        dto.setMatchingProgress(plan.getMatchingProgress());
        dto.setRemainingQuantity(plan.getRemainingQuantity());

        return dto;
    }

    /**
     * CreateRequest 转 Entity
     */
    public ProductionPlan toEntity(CreateProductionPlanRequest request, String factoryId, Long createdBy) {
        if (request == null) {
            return null;
        }
        ProductionPlan plan = new ProductionPlan();
        plan.setId(UUID.randomUUID().toString());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber(generatePlanNumber());
        plan.setProductTypeId(request.getProductTypeId());
        plan.setPlannedQuantity(request.getPlannedQuantity());
        // plan.setPlannedDate(request.getPlannedDate());  // 暂时注释 - 数据库表中没有此字段
        plan.setStatus(ProductionPlanStatus.PENDING);
        plan.setPlanType(request.getPlanType() != null ? request.getPlanType() : ProductionPlanType.FROM_INVENTORY);
        plan.setCustomerOrderNumber(request.getCustomerOrderNumber());
        plan.setPriority(request.getPriority() != null ? request.getPriority() : 5);
        plan.setEstimatedMaterialCost(request.getEstimatedMaterialCost());
        plan.setEstimatedLaborCost(request.getEstimatedLaborCost());
        plan.setEstimatedEquipmentCost(request.getEstimatedEquipmentCost());
        plan.setEstimatedOtherCost(request.getEstimatedOtherCost());
        plan.setNotes(request.getNotes());
        plan.setCreatedBy(createdBy);
        // 设置预计完成日期，默认为计划日期+1天
        if (request.getExpectedCompletionDate() != null) {
            plan.setExpectedCompletionDate(request.getExpectedCompletionDate());
        } else if (request.getPlannedDate() != null) {
            plan.setExpectedCompletionDate(request.getPlannedDate().plusDays(1));
        }
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
        if (request.getExpectedCompletionDate() != null) {
            plan.setExpectedCompletionDate(request.getExpectedCompletionDate());
        }
    }

    /**
     * 生成计划编号
     */
    private String generatePlanNumber() {
        return "PLAN-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * 获取计划类型显示名称
     */
    private String getPlanTypeDisplayName(ProductionPlanType planType) {
        if (planType == null) {
            return null;
        }
        switch (planType) {
            case FUTURE:
                return "未来计划";
            case FROM_INVENTORY:
                return "基于库存";
            default:
                return planType.name();
        }
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
