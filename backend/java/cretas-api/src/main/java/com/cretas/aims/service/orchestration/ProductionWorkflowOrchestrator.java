package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.dto.orchestration.MaterialCheckResult;
import com.cretas.aims.dto.orchestration.MaterialRequirement;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.enums.TransferItemType;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.service.ProductionPlanService;
import com.cretas.aims.repository.inventory.InternalTransferRepository;
import com.cretas.aims.service.inventory.TransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 生产流程编排器
 *
 * 一期：硬编码步骤调用
 * 二期：从 WorkflowDefinition JSON 读取步骤，驱动 ToolRegistry 执行
 *
 * 当前编排流程：
 *   排产确认 → BOM展开 → 库存校验 → 创建调拨单 → 自动提交
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionWorkflowOrchestrator {

    private final BomExpansionService bomExpansionService;
    private final TransferService transferService;
    private final ProductionPlanService productionPlanService;
    private final RawMaterialTypeRepository rawMaterialTypeRepository;
    private final InternalTransferRepository transferRepository;

    /**
     * 排产确认 → 自动生成调拨单
     *
     * @param factoryId 工厂ID (调出方=物流仓 factoryId)
     * @param planId 生产计划ID
     * @param targetFactoryId 调入方工厂ID (工厂仓)，null 则默认同 factoryId
     * @param userId 操作人
     * @return 创建的调拨单
     */
    @Transactional
    public InternalTransfer generateTransferFromPlan(
            String factoryId, String planId, String targetFactoryId, Long userId) {

        // Step 1: 加载计划 — FUTURE TOOL: production_plan_query
        ProductionPlanDTO plan = productionPlanService.getProductionPlanById(factoryId, planId);
        if (plan == null) {
            throw new BusinessException("生产计划不存在: " + planId);
        }
        log.info("开始为生产计划生成调拨单: planId={}, product={}, qty={}",
                planId, plan.getProductTypeId(), plan.getPlannedQuantity());

        // Step 2: BOM展开 — FUTURE TOOL: bom_expansion_calculate
        List<MaterialRequirement> requirements = bomExpansionService.expandBOM(
                factoryId, plan.getProductTypeId(), plan.getPlannedQuantity());

        if (requirements.isEmpty()) {
            throw new BusinessException("该产品未配置转换率，无法生成调拨单。请在 [生产管理 → BOM 成本管理 → 转换率 tab] 为该产品添加原料 → 产品的转换率配置（conversionRate）。");
        }

        // Step 3: 库存校验 (可选，记录日志但不阻断)
        MaterialCheckResult check = bomExpansionService.checkMaterialAvailability(factoryId, requirements);
        if (!check.isAllSatisfied()) {
            log.warn("部分原料库存不足，仍生成调拨单: planId={}, shortfalls={}",
                    planId, check.getShortfalls().size());
        }

        // Step 4: 构建调拨单 — FUTURE TOOL: transfer_create
        String target = targetFactoryId != null ? targetFactoryId : factoryId;
        CreateTransferRequest request = buildTransferRequest(factoryId, target, plan, requirements);
        InternalTransfer transfer = transferService.createTransfer(factoryId, request, userId);

        // Step 4.5: 设置 production_plan_id 关联 — 必须先持久化再调 requestTransfer
        transfer.setProductionPlanId(planId);
        transferRepository.save(transfer);

        // Step 5: 自动提交申请 — FUTURE TOOL: transfer_approve (action=request)
        transfer = transferService.requestTransfer(factoryId, transfer.getId(), userId);

        log.info("调拨单生成成功: transferId={}, planId={}, items={}",
                transfer.getId(), planId, requirements.size());
        return transfer;
    }

    private CreateTransferRequest buildTransferRequest(
            String sourceFactoryId, String targetFactoryId,
            ProductionPlanDTO plan, List<MaterialRequirement> requirements) {

        CreateTransferRequest request = new CreateTransferRequest();
        request.setTransferType("HQ_TO_BRANCH");
        request.setTargetFactoryId(targetFactoryId);
        request.setTransferDate(LocalDate.now().plusDays(1)); // 默认次日调拨
        request.setExpectedArrivalDate(LocalDate.now().plusDays(1));
        request.setRemark(String.format("生产计划自动生成 | 计划号: %s | 产品: %s | 计划量: %s",
                plan.getPlanNumber(), plan.getProductTypeId(), plan.getPlannedQuantity()));

        List<CreateTransferRequest.TransferItemDTO> items = new ArrayList<>();
        for (MaterialRequirement req : requirements) {
            CreateTransferRequest.TransferItemDTO item = new CreateTransferRequest.TransferItemDTO();
            item.setItemType(TransferItemType.RAW_MATERIAL.name());
            item.setMaterialTypeId(req.getMaterialTypeId());
            item.setItemName(req.getMaterialTypeName());
            item.setQuantity(req.getRequiredQuantity());

            // 从 RawMaterialType 获取单位
            String unit = "kg"; // 默认
            try {
                RawMaterialType mt = rawMaterialTypeRepository.findById(req.getMaterialTypeId()).orElse(null);
                if (mt != null && mt.getUnit() != null) {
                    unit = mt.getUnit();
                }
            } catch (Exception e) {
                log.debug("获取原料单位失败: {}", req.getMaterialTypeId());
            }
            item.setUnit(unit);

            items.add(item);
        }
        request.setItems(items);
        return request;
    }
}
