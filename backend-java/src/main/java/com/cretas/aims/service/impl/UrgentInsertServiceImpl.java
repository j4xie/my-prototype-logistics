package com.cretas.aims.service.impl;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.InsertSlot;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.PlanSourceType;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.ProductionPlanType;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.mapper.ProductionPlanMapper;
import com.cretas.aims.repository.InsertSlotRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.DecisionAuditService;
import com.cretas.aims.service.ImpactAnalysisService;
import com.cretas.aims.service.ImpactAnalysisService.*;
import com.cretas.aims.service.PushNotificationService;
import com.cretas.aims.service.UrgentInsertService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 紧急插单服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UrgentInsertServiceImpl implements UrgentInsertService {

    private final InsertSlotRepository insertSlotRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final ProductTypeRepository productTypeRepository;
    private final UserRepository userRepository;
    private final ProductionPlanMapper productionPlanMapper;
    private final ObjectMapper objectMapper;
    private final DecisionAuditService decisionAuditService;
    private final ImpactAnalysisService impactAnalysisService;
    private final ApprovalChainService approvalChainService;
    private final PushNotificationService pushNotificationService;

    @Override
    @Transactional
    public List<InsertSlotDTO> getAvailableSlots(String factoryId, GetInsertSlotsRequest request) {
        log.info("获取可用插单时段: factoryId={}, productTypeId={}, quantity={}",
                factoryId, request.getProductTypeId(), request.getRequiredQuantity());

        // 先清理过期时段
        cleanupExpiredSlots(factoryId);

        List<InsertSlot> slots;

        if (Boolean.TRUE.equals(request.getNoImpactOnly())) {
            // 只获取无影响的时段
            slots = insertSlotRepository.findNoImpactSlots(factoryId);
        } else if (request.getMinRecommendScore() != null && request.getMinRecommendScore() > 0) {
            // 按最低推荐分数筛选
            slots = insertSlotRepository.findHighScoreSlots(factoryId, request.getMinRecommendScore());
        } else {
            // 获取所有可用时段
            slots = insertSlotRepository.findByFactoryIdAndStatus(factoryId, "available");
        }

        // 根据产能需求过滤 (仅当指定了产能需求时)
        BigDecimal requiredCapacity = request.getRequiredQuantity();
        if (requiredCapacity != null && requiredCapacity.compareTo(BigDecimal.ZERO) > 0) {
            slots = slots.stream()
                    .filter(s -> s.getAvailableCapacity() == null ||
                            s.getAvailableCapacity().compareTo(requiredCapacity) >= 0)
                    .collect(Collectors.toList());
        }

        // 如果指定了产线，优先返回该产线的时段
        if (request.getPreferredProductionLineId() != null) {
            slots.sort((a, b) -> {
                boolean aMatch = request.getPreferredProductionLineId().equals(a.getProductionLineId());
                boolean bMatch = request.getPreferredProductionLineId().equals(b.getProductionLineId());
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return Integer.compare(b.getRecommendScore(), a.getRecommendScore());
            });
        }

        // 转换为DTO
        return slots.stream()
                .map(this::toSlotDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> analyzeInsertImpact(String factoryId, String slotId, GetInsertSlotsRequest request) {
        log.info("分析插单影响: factoryId={}, slotId={}, productTypeId={}, quantity={}",
                factoryId, slotId, request.getProductTypeId(), request.getRequiredQuantity());

        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", slotId));

        // 使用 ImpactAnalysisService 进行详细链式影响分析
        ChainImpactResult chainImpact = impactAnalysisService.calculateChainImpact(
                factoryId,
                slot.getStartTime(),
                slot.getEndTime(),
                request.getProductTypeId(),
                request.getRequiredQuantity()
        );

        // 计算多维度推荐评分
        RecommendScoreResult scoreResult = impactAnalysisService.calculateRecommendScore(
                factoryId,
                slot.getStartTime(),
                slot.getEndTime(),
                request.getRequiredQuantity(),
                request.getProductTypeId(),
                request.getDeadline()
        );

        // 资源检查
        ResourceCheckResult materialCheck = impactAnalysisService.checkMaterialAvailability(
                factoryId, request.getProductTypeId(), request.getRequiredQuantity());
        ResourceCheckResult equipmentCheck = impactAnalysisService.checkEquipmentAvailability(
                factoryId, slot.getStartTime(), slot.getEndTime(), null);

        Map<String, Object> result = new HashMap<>();

        // 基本信息
        result.put("slotId", slotId);
        result.put("startTime", slot.getStartTime());
        result.put("endTime", slot.getEndTime());
        result.put("availableCapacity", slot.getAvailableCapacity());
        result.put("requiredCapacity", request.getRequiredQuantity());

        // 影响等级 (使用链式分析结果)
        result.put("impactLevel", chainImpact.getImpactLevel());
        result.put("impactLevelDisplayName", chainImpact.getImpactLevelDisplayName());
        result.put("impactScore", chainImpact.getImpactScore());

        // 链式影响详情
        Map<String, Object> chainDetails = new HashMap<>();
        chainDetails.put("directConflicts", chainImpact.getDirectConflicts());
        chainDetails.put("cascadeDelays", chainImpact.getCascadeDelays());
        chainDetails.put("totalAffectedPlans", chainImpact.getTotalAffectedPlans());
        chainDetails.put("maxDelayMinutes", chainImpact.getMaxDelayMinutes());
        chainDetails.put("averageDelayMinutes", chainImpact.getAverageDelayMinutes());
        chainDetails.put("totalDelayMinutes", chainImpact.getTotalDelayMinutes());
        chainDetails.put("affectedVipCustomers", chainImpact.getAffectedVipCustomers());
        chainDetails.put("criticalCrPlans", chainImpact.getCriticalCrPlans());
        chainDetails.put("exceedingDeadlinePlans", chainImpact.getExceedingDeadlinePlans());
        result.put("chainImpactDetails", chainDetails);

        // 受影响计划列表
        result.put("impactedPlans", chainImpact.getAffectedPlans());
        result.put("impactedPlanCount", chainImpact.getTotalAffectedPlans());

        // 推荐评分详情
        Map<String, Object> scoreDetails = new HashMap<>();
        scoreDetails.put("totalScore", scoreResult.getTotalScore());
        scoreDetails.put("capacityFactor", scoreResult.getCapacityFactor());
        scoreDetails.put("workerFactor", scoreResult.getWorkerFactor());
        scoreDetails.put("deadlineFactor", scoreResult.getDeadlineFactor());
        scoreDetails.put("impactFactor", scoreResult.getImpactFactor());
        scoreDetails.put("switchCostFactor", scoreResult.getSwitchCostFactor());
        result.put("recommendScore", scoreResult.getTotalScore());
        result.put("recommendationReason", scoreResult.getRecommendationReason());
        result.put("scoreBreakdown", scoreDetails);

        // 资源状态
        Map<String, Object> resourceStatus = new HashMap<>();
        resourceStatus.put("materialAvailable", materialCheck.isAvailable());
        resourceStatus.put("materialMessage", materialCheck.getMessage());
        resourceStatus.put("equipmentAvailable", equipmentCheck.isAvailable());
        resourceStatus.put("equipmentMessage", equipmentCheck.getMessage());
        resourceStatus.put("hasEnoughWorkers", slot.hasEnoughWorkers());
        resourceStatus.put("requiredWorkers", slot.getRequiredWorkers());
        resourceStatus.put("availableWorkers", slot.getAvailableWorkers());
        result.put("resourceStatus", resourceStatus);

        // 风险评估
        String riskLevel = determineRiskLevel(chainImpact, materialCheck, equipmentCheck, slot);
        result.put("riskLevel", riskLevel);
        result.put("riskWarnings", chainImpact.getRiskWarnings());

        // 审批要求
        result.put("requiresApproval", chainImpact.getRequiresApproval());
        result.put("approvalLevel", chainImpact.getApprovalLevel());

        // 可行性 (处理 null 值)
        boolean capacityOk = true;  // 默认通过
        if (slot.getAvailableCapacity() != null && request.getRequiredQuantity() != null) {
            capacityOk = slot.getAvailableCapacity().compareTo(request.getRequiredQuantity()) >= 0;
        }
        boolean isFeasible = materialCheck.isAvailable() && equipmentCheck.isAvailable() &&
                slot.hasEnoughWorkers() && capacityOk;
        result.put("isFeasible", isFeasible);
        if (!isFeasible) {
            result.put("infeasibleReason", buildInfeasibleReason(materialCheck, equipmentCheck, slot, request));
        }

        return result;
    }

    /**
     * 确定风险等级
     */
    private String determineRiskLevel(ChainImpactResult chainImpact,
                                      ResourceCheckResult materialCheck,
                                      ResourceCheckResult equipmentCheck,
                                      InsertSlot slot) {
        // 资源不可用 = 高风险
        if (!materialCheck.isAvailable() || !equipmentCheck.isAvailable() || !slot.hasEnoughWorkers()) {
            return "critical";
        }
        // 使用链式影响的风险等级
        String impactLevel = chainImpact.getImpactLevel();
        if ("critical".equals(impactLevel)) return "critical";
        if ("high".equals(impactLevel)) return "high";
        if ("medium".equals(impactLevel)) return "medium";
        return "low";
    }

    /**
     * 构建不可行原因
     */
    private String buildInfeasibleReason(ResourceCheckResult materialCheck,
                                         ResourceCheckResult equipmentCheck,
                                         InsertSlot slot,
                                         GetInsertSlotsRequest request) {
        StringBuilder reasons = new StringBuilder();
        if (!materialCheck.isAvailable()) {
            reasons.append("原料不足: ").append(materialCheck.getMessage()).append("; ");
        }
        if (!equipmentCheck.isAvailable()) {
            reasons.append("设备不可用: ").append(equipmentCheck.getMessage()).append("; ");
        }
        if (!slot.hasEnoughWorkers()) {
            reasons.append("人员不足: 需要").append(slot.getRequiredWorkers())
                    .append("人，可用").append(slot.getAvailableWorkers()).append("人; ");
        }
        if (slot.getAvailableCapacity() != null && request.getRequiredQuantity() != null
                && slot.getAvailableCapacity().compareTo(request.getRequiredQuantity()) < 0) {
            reasons.append("产能不足: 需要").append(request.getRequiredQuantity())
                    .append("kg，可用").append(slot.getAvailableCapacity()).append("kg; ");
        }
        return reasons.toString();
    }

    @Override
    @Transactional
    public ProductionPlanDTO confirmInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request) {
        log.info("确认紧急插单: factoryId={}, slotId={}, quantity={}",
                factoryId, request.getSlotId(), request.getPlannedQuantity());

        // 验证时段
        InsertSlot slot = insertSlotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", request.getSlotId()));

        if (!"available".equals(slot.getStatus())) {
            throw new RuntimeException("时段不可用，当前状态: " + slot.getStatus());
        }

        // 检查是否强制插入
        if (!Boolean.TRUE.equals(request.getForceInsert())) {
            // 非强制插入，检查影响等级
            if ("high".equals(slot.getImpactLevel())) {
                throw new RuntimeException("该时段影响等级高，请使用强制插入或选择其他时段");
            }
        }

        // 创建生产计划
        ProductionPlan plan = createProductionPlanFromSlot(factoryId, userId, slot, request);

        // 标记时段为已选中
        slot.setStatus("selected");
        insertSlotRepository.save(slot);

        // 保存计划
        ProductionPlan savedPlan = productionPlanRepository.save(plan);

        log.info("紧急插单创建成功: planId={}, planNumber={}", savedPlan.getId(), savedPlan.getPlanNumber());

        // 发送紧急插单推送通知
        try {
            pushNotificationService.sendUrgentInsertNotification(
                    userId,
                    Long.valueOf(savedPlan.getId()),
                    String.format("紧急插单已创建: %s，计划数量: %s",
                            savedPlan.getPlanNumber(), request.getPlannedQuantity())
            );
            log.info("紧急插单推送通知已发送: planId={}", savedPlan.getId());
        } catch (Exception e) {
            log.error("发送紧急插单推送通知失败: planId={}", savedPlan.getId(), e);
            // 不阻塞主流程
        }

        return productionPlanMapper.toDTO(savedPlan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO forceInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request) {
        log.info("强制紧急插单: factoryId={}, slotId={}", factoryId, request.getSlotId());

        // 验证时段
        InsertSlot slot = insertSlotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", request.getSlotId()));

        if (!"available".equals(slot.getStatus())) {
            throw new RuntimeException("时段不可用，当前状态: " + slot.getStatus());
        }

        // 获取操作用户信息
        User operator = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));

        // 构建审批上下文，包含影响分析结果
        Map<String, Object> approvalContext = buildForceInsertApprovalContext(slot, request);

        // 使用配置化的审批链判断是否需要审批
        boolean needsApproval = approvalChainService.requiresApproval(
                factoryId, DecisionType.FORCE_INSERT, approvalContext);

        log.debug("强制插单审批判断: factoryId={}, impactLevel={}, affectedPlans={}, needsApproval={}",
                factoryId, slot.getImpactLevel(),
                approvalContext.get("affectedPlanCount"), needsApproval);

        // 创建生产计划
        ProductionPlan plan = createProductionPlanFromSlot(factoryId, userId, slot, request);

        // 标记为强制插单
        plan.markAsForceInsert(userId, request.getNotes(), needsApproval);

        // 如果需要审批，状态设置为待审批
        if (needsApproval) {
            plan.setStatus(ProductionPlanStatus.PENDING);
            log.info("强制插单需要审批: planId={}, impactLevel={}", plan.getId(), slot.getImpactLevel());
        }

        // 标记时段为已选中
        slot.setStatus("selected");
        insertSlotRepository.save(slot);

        // 保存计划
        ProductionPlan savedPlan = productionPlanRepository.save(plan);

        // 准备审计日志上下文
        Map<String, Object> inputContext = new HashMap<>();
        inputContext.put("slotId", request.getSlotId());
        inputContext.put("productTypeId", request.getProductTypeId());
        inputContext.put("plannedQuantity", request.getPlannedQuantity());
        inputContext.put("priority", request.getPriority());
        inputContext.put("impactLevel", slot.getImpactLevel());
        inputContext.put("impactedPlans", parseImpactedPlans(slot.getImpactedPlans()));
        inputContext.put("customerOrderNumber", request.getCustomerOrderNumber());
        inputContext.put("forceInsertReason", request.getNotes());

        // 创建决策审计记录（含规则版本追踪）
        Optional<ApprovalChainConfig> matchedConfig = approvalChainService.findMatchingConfig(
                factoryId, DecisionType.FORCE_INSERT, approvalContext);

        if (matchedConfig.isPresent()) {
            ApprovalChainConfig config = matchedConfig.get();
            decisionAuditService.logForceInsertWithRuleConfig(
                    factoryId,
                    "ProductionPlan",
                    savedPlan.getId(),
                    inputContext,
                    request.getNotes(),
                    needsApproval,
                    userId,
                    operator.getFullName(),
                    operator.getRole() != null ? operator.getRole() : "UNKNOWN",
                    config.getId(),
                    config.getVersion(),
                    config.getName()
            );
            log.debug("审计日志记录匹配规则: configId={}, version={}, name={}",
                    config.getId(), config.getVersion(), config.getName());
        } else {
            // 无匹配规则时使用基础日志方法
            decisionAuditService.logForceInsert(
                    factoryId,
                    "ProductionPlan",
                    savedPlan.getId(),
                    inputContext,
                    request.getNotes(),
                    needsApproval,
                    userId,
                    operator.getFullName(),
                    operator.getRole() != null ? operator.getRole() : "UNKNOWN"
            );
        }

        log.info("强制插单创建成功: planId={}, planNumber={}, needsApproval={}",
                savedPlan.getId(), savedPlan.getPlanNumber(), needsApproval);

        // 发送强制插单推送通知
        try {
            String message = needsApproval
                    ? String.format("强制插单已提交审批: %s，计划数量: %s", savedPlan.getPlanNumber(), request.getPlannedQuantity())
                    : String.format("强制插单已创建: %s，计划数量: %s", savedPlan.getPlanNumber(), request.getPlannedQuantity());

            pushNotificationService.sendUrgentInsertNotification(
                    userId,
                    Long.valueOf(savedPlan.getId()),
                    message
            );

            // 如果需要审批，同时发送到工厂通知审批人
            if (needsApproval) {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "force_insert_approval");
                pushData.put("planId", savedPlan.getId());
                pushData.put("planNumber", savedPlan.getPlanNumber());
                pushData.put("impactLevel", slot.getImpactLevel());
                pushData.put("screen", "ForceInsertApprovalScreen");
                pushNotificationService.sendToFactory(
                        factoryId,
                        "强制插单待审批",
                        String.format("强制插单 %s 需要审批，影响等级: %s",
                                savedPlan.getPlanNumber(), slot.getImpactLevel()),
                        pushData
                );
            }
            log.info("强制插单推送通知已发送: planId={}, needsApproval={}", savedPlan.getId(), needsApproval);
        } catch (Exception e) {
            log.error("发送强制插单推送通知失败: planId={}", savedPlan.getId(), e);
            // 不阻塞主流程
        }

        return productionPlanMapper.toDTO(savedPlan);
    }

    /**
     * 审批强制插单
     *
     * @param factoryId   工厂ID
     * @param planId      计划ID
     * @param approverId  审批人ID
     * @param approved    是否批准
     * @param comment     审批备注
     * @return 更新后的计划
     */
    @Override
    @Transactional
    public ProductionPlanDTO approveForceInsert(
            String factoryId, String planId, Long approverId, boolean approved, String comment) {

        log.info("审批强制插单: planId={}, approved={}", planId, approved);

        ProductionPlan plan = productionPlanRepository.findById(planId)
                .orElseThrow(() -> new EntityNotFoundException("ProductionPlan", planId));

        // 验证工厂归属
        if (!factoryId.equals(plan.getFactoryId())) {
            throw new RuntimeException("无权审批该计划");
        }

        // 验证计划状态
        if (!plan.isPendingApproval()) {
            throw new RuntimeException("该计划不在待审批状态");
        }

        // 获取审批人信息
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new EntityNotFoundException("User", approverId));

        if (approved) {
            // 批准
            plan.approve(approverId, approver.getFullName(), comment);
            // 批准后可以开始执行
            plan.setStatus(ProductionPlanStatus.PENDING);
            log.info("强制插单已批准: planId={}", planId);
        } else {
            // 拒绝
            plan.reject(approverId, approver.getFullName(), comment);
            plan.setStatus(ProductionPlanStatus.CANCELLED);

            // 释放时段
            insertSlotRepository.findByFactoryIdAndStatus(factoryId, "selected").stream()
                    .filter(s -> s.getStartTime().equals(plan.getStartTime()))
                    .findFirst()
                    .ifPresent(slot -> {
                        slot.setStatus("available");
                        insertSlotRepository.save(slot);
                    });

            log.info("强制插单已拒绝: planId={}", planId);
        }

        // 保存更新
        ProductionPlan updatedPlan = productionPlanRepository.save(plan);

        // 记录审批决策
        decisionAuditService.logApproval(
                factoryId,
                "ProductionPlan",
                planId,
                approved ?
                        com.cretas.aims.entity.DecisionAuditLog.ApprovalStatus.APPROVED :
                        com.cretas.aims.entity.DecisionAuditLog.ApprovalStatus.REJECTED,
                comment,
                approverId,
                approver.getFullName()
        );

        // 发送审批结果推送通知给申请人
        try {
            Long applicantId = plan.getCreatedBy();
            if (applicantId != null) {
                String resultText = approved ? "已批准" : "已拒绝";
                pushNotificationService.sendApprovalNotification(
                        applicantId,
                        "FORCE_INSERT",
                        Long.valueOf(planId),
                        String.format("强制插单 %s %s: %s",
                                plan.getPlanNumber(), resultText,
                                comment != null ? comment : (approved ? "审批通过" : "审批拒绝"))
                );
                log.info("强制插单审批结果推送通知已发送: planId={}, applicantId={}, approved={}",
                        planId, applicantId, approved);
            }
        } catch (Exception e) {
            log.error("发送强制插单审批结果推送通知失败: planId={}", planId, e);
            // 不阻塞主流程
        }

        return productionPlanMapper.toDTO(updatedPlan);
    }

    /**
     * 获取待审批的强制插单列表
     *
     * @param factoryId 工厂ID
     * @return 待审批计划列表
     */
    @Override
    public List<ProductionPlanDTO> getPendingForceInsertApprovals(String factoryId) {
        return productionPlanRepository.findAll().stream()
                .filter(p -> factoryId.equals(p.getFactoryId()))
                .filter(p -> Boolean.TRUE.equals(p.getIsForceInserted()))
                .filter(ProductionPlan::isPendingApproval)
                .map(productionPlanMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public int generateInsertSlots(String factoryId, int hoursAhead) {
        log.info("生成插单时段: factoryId={}, hoursAhead={}", factoryId, hoursAhead);

        // 清理旧的可用时段
        insertSlotRepository.deleteAvailableSlotsByFactoryId(factoryId);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endTime = now.plusHours(hoursAhead);

        // 获取工厂产能配置
        FactoryCapacityConfig capacityConfig = impactAnalysisService.getFactoryCapacityConfig(factoryId);
        BigDecimal hourlyCapacity = capacityConfig.getHourlyCapacity();
        int standardWorkers = capacityConfig.getStandardShiftWorkers();
        int maxWorkers = capacityConfig.getMaxWorkers();

        List<InsertSlot> newSlots = new ArrayList<>();

        // 按2小时间隔生成时段
        LocalDateTime slotStart = now.truncatedTo(ChronoUnit.HOURS).plusHours(1);
        while (slotStart.isBefore(endTime)) {
            LocalDateTime slotEnd = slotStart.plusHours(2);

            // 计算该时段的可用产能 (2小时 × 时产能)
            BigDecimal slotCapacity = hourlyCapacity.multiply(new BigDecimal("2"));

            // 检查工人可用性
            ResourceCheckResult workerCheck = impactAnalysisService.checkWorkerAvailability(
                    factoryId, slotStart, slotEnd, standardWorkers);
            int availableWorkers = workerCheck.isAvailable() ?
                    (workerCheck.getAvailableAmount() != null ?
                            workerCheck.getAvailableAmount().intValue() : maxWorkers) : standardWorkers;

            // 检查设备可用性
            ResourceCheckResult equipmentCheck = impactAnalysisService.checkEquipmentAvailability(
                    factoryId, slotStart, slotEnd, null);

            // 初步影响分析 (使用默认产品类型做快速评估)
            ChainImpactResult impactResult = impactAnalysisService.calculateChainImpact(
                    factoryId, slotStart, slotEnd, null, slotCapacity);

            // 计算多维度推荐评分
            RecommendScoreResult scoreResult = impactAnalysisService.calculateRecommendScore(
                    factoryId, slotStart, slotEnd, slotCapacity, null, null);

            InsertSlot slot = InsertSlot.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .productionLineId("default")  // 动态分配模式，无固定产线
                    .productionLineName("动态分配")
                    .startTime(slotStart)
                    .endTime(slotEnd)
                    .availableCapacity(slotCapacity)
                    .impactLevel(impactResult.getImpactLevel())
                    .requiredWorkers(standardWorkers)
                    .availableWorkers(availableWorkers)
                    .switchCostMinutes(capacityConfig.getSwitchCostMinutes())
                    .recommendScore(scoreResult.getTotalScore())
                    .recommendationReason(scoreResult.getRecommendationReason())
                    .status("available")
                    .build();

            // 存储详细影响分析结果 (JSON)
            try {
                if (impactResult.getAffectedPlans() != null && !impactResult.getAffectedPlans().isEmpty()) {
                    String impactedPlansJson = objectMapper.writeValueAsString(
                            impactResult.getAffectedPlans().stream()
                                    .map(ap -> InsertSlotDTO.ImpactedPlanDTO.builder()
                                            .planId(ap.getPlanId())
                                            .planNumber(ap.getPlanNumber())
                                            .planName(ap.getProductName())
                                            .delayMinutes(ap.getDelayMinutes())
                                            .originalEndTime(ap.getOriginalEndTime())
                                            .delayedEndTime(ap.getDelayedEndTime())
                                            .isVipCustomer(ap.getIsVipCustomer())
                                            .impactType(ap.getImpactType())
                                            .impactLevel(ap.getImpactLevel())
                                            .build())
                                    .collect(Collectors.toList()));
                    slot.setImpactedPlans(impactedPlansJson);
                }
            } catch (Exception e) {
                log.warn("序列化受影响计划失败: {}", e.getMessage());
            }

            newSlots.add(slot);
            slotStart = slotEnd;
        }

        insertSlotRepository.saveAll(newSlots);

        log.info("生成了 {} 个插单时段 (使用科学影响分析)", newSlots.size());
        return newSlots.size();
    }

    @Override
    public InsertSlotDTO getSlotDetail(String factoryId, String slotId) {
        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", slotId));

        if (!factoryId.equals(slot.getFactoryId())) {
            throw new RuntimeException("无权访问该时段");
        }

        return toSlotDTO(slot);
    }

    @Override
    @Transactional
    public void markSlotAsSelected(String factoryId, String slotId) {
        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", slotId));

        if (!factoryId.equals(slot.getFactoryId())) {
            throw new RuntimeException("无权操作该时段");
        }

        slot.setStatus("selected");
        insertSlotRepository.save(slot);
    }

    @Override
    @Transactional
    public void releaseSlot(String factoryId, String slotId) {
        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new EntityNotFoundException("InsertSlot", slotId));

        if (!factoryId.equals(slot.getFactoryId())) {
            throw new RuntimeException("无权操作该时段");
        }

        // 只有已选中的时段才能释放
        if ("selected".equals(slot.getStatus())) {
            slot.setStatus("available");
            insertSlotRepository.save(slot);
        }
    }

    @Override
    @Transactional
    public int cleanupExpiredSlots(String factoryId) {
        LocalDateTime now = LocalDateTime.now();
        return insertSlotRepository.markExpiredSlots(factoryId, now);
    }

    @Override
    public Map<String, Object> getUrgentInsertStatistics(String factoryId) {
        Map<String, Object> stats = new HashMap<>();

        long availableCount = insertSlotRepository.countByFactoryIdAndStatus(factoryId, "available");
        long selectedCount = insertSlotRepository.countByFactoryIdAndStatus(factoryId, "selected");
        long expiredCount = insertSlotRepository.countByFactoryIdAndStatus(factoryId, "expired");

        stats.put("availableSlots", availableCount);
        stats.put("selectedSlots", selectedCount);
        stats.put("expiredSlots", expiredCount);
        stats.put("totalSlots", availableCount + selectedCount + expiredCount);

        // 统计紧急插单计划数量
        long urgentPlanCount = productionPlanRepository.countByFactoryIdAndStatus(
                factoryId, ProductionPlanStatus.IN_PROGRESS);
        stats.put("activeUrgentPlans", urgentPlanCount);

        return stats;
    }

    // ==================== 私有辅助方法 ====================

    private InsertSlotDTO toSlotDTO(InsertSlot slot) {
        InsertSlotDTO dto = InsertSlotDTO.builder()
                .id(slot.getId())
                .factoryId(slot.getFactoryId())
                .productionLineId(slot.getProductionLineId())
                .productionLineName(slot.getProductionLineName())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .durationHours(slot.getDurationHours())
                .availableCapacity(slot.getAvailableCapacity())
                .impactLevel(slot.getImpactLevel())
                .impactLevelDisplayName(slot.getImpactLevelDisplayName())
                .impactedPlans(parseImpactedPlans(slot.getImpactedPlans()))
                .requiredWorkers(slot.getRequiredWorkers())
                .availableWorkers(slot.getAvailableWorkers())
                .hasEnoughWorkers(slot.hasEnoughWorkers())
                .switchCostMinutes(slot.getSwitchCostMinutes())
                .recommendScore(slot.getRecommendScore())
                .recommendationReason(slot.getRecommendationReason())
                .status(slot.getStatus())
                .isAvailable(slot.isAvailable())
                .build();

        // 填充评分详情 (如需要可以重新计算)
        if (slot.getRecommendScore() != null) {
            FactoryCapacityConfig config = impactAnalysisService.getFactoryCapacityConfig(slot.getFactoryId());

            // 计算各因子
            double capacityFactor = slot.getAvailableCapacity() != null ?
                    Math.min(1.0, slot.getAvailableCapacity().doubleValue() / config.getHourlyCapacity().doubleValue() / 2) : 0.5;
            double workerFactor = slot.getAvailableWorkers() != null && slot.getRequiredWorkers() != null ?
                    Math.min(1.0, (double) slot.getAvailableWorkers() / slot.getRequiredWorkers()) : 0.5;
            double impactFactor = calculateImpactFactor(slot.getImpactLevel());
            double switchCostFactor = calculateSwitchCostFactor(slot.getSwitchCostMinutes(), config.getSwitchCostMinutes());

            InsertSlotDTO.ScoreBreakdown scoreBreakdown = InsertSlotDTO.ScoreBreakdown.builder()
                    .capacityFactor(capacityFactor)
                    .workerFactor(workerFactor)
                    .deadlineFactor(0.5)  // 默认中等紧迫度
                    .impactFactor(impactFactor)
                    .switchCostFactor(switchCostFactor)
                    .build();
            scoreBreakdown.calculateScores();
            dto.setScoreBreakdown(scoreBreakdown);
        }

        // 填充影响详情
        List<InsertSlotDTO.ImpactedPlanDTO> impactedPlans = dto.getImpactedPlans();
        if (impactedPlans != null && !impactedPlans.isEmpty()) {
            int directConflicts = (int) impactedPlans.stream()
                    .filter(p -> "DIRECT".equals(p.getImpactType()))
                    .count();
            int cascadeDelays = (int) impactedPlans.stream()
                    .filter(p -> "CASCADE".equals(p.getImpactType()))
                    .count();
            int maxDelayMinutes = impactedPlans.stream()
                    .mapToInt(p -> p.getDelayMinutes() != null ? p.getDelayMinutes() : 0)
                    .max()
                    .orElse(0);
            double avgDelayMinutes = impactedPlans.stream()
                    .mapToInt(p -> p.getDelayMinutes() != null ? p.getDelayMinutes() : 0)
                    .average()
                    .orElse(0);
            int vipCount = (int) impactedPlans.stream()
                    .filter(p -> Boolean.TRUE.equals(p.getIsVipCustomer()))
                    .count();

            InsertSlotDTO.ImpactDetails impactDetails = InsertSlotDTO.ImpactDetails.builder()
                    .directConflicts(directConflicts)
                    .cascadeDelays(cascadeDelays)
                    .totalAffectedPlans(impactedPlans.size())
                    .maxDelayHours(maxDelayMinutes / 60.0)
                    .averageDelayHours(avgDelayMinutes / 60.0)
                    .affectsVipCustomer(vipCount > 0)
                    .affectedVipCustomerCount(vipCount)
                    .impactScore(calculateImpactScore(impactedPlans))
                    .requiresApproval("high".equals(slot.getImpactLevel()) || "critical".equals(slot.getImpactLevel()))
                    .approvalLevel(determineApprovalLevel(slot.getImpactLevel(), vipCount))
                    .build();
            dto.setImpactDetails(impactDetails);
        }

        // 检查锁定状态 (TODO: 从 insert_slot_locks 表查询)
        dto.setIsLocked(false);
        dto.setIsFeasible(true);

        return dto;
    }

    /**
     * 根据影响等级计算影响因子 (0-1, 越高影响越小)
     */
    private double calculateImpactFactor(String impactLevel) {
        if (impactLevel == null || "none".equals(impactLevel)) {
            return 1.0;
        }
        switch (impactLevel) {
            case "low": return 0.8;
            case "medium": return 0.5;
            case "high": return 0.2;
            case "critical": return 0.0;
            default: return 0.5;
        }
    }

    /**
     * 根据换线成本计算因子 (0-1, 越高换线成本越低)
     */
    private double calculateSwitchCostFactor(Integer actualCost, int standardCost) {
        if (actualCost == null || actualCost == 0) {
            return 1.0;  // 无需换线
        }
        if (standardCost <= 0) {
            return 0.5;
        }
        double ratio = (double) actualCost / standardCost;
        if (ratio <= 0.5) return 0.9;
        if (ratio <= 1.0) return 0.7;
        if (ratio <= 1.5) return 0.5;
        return 0.3;
    }

    /**
     * 计算影响评分 (0-100)
     */
    private int calculateImpactScore(List<InsertSlotDTO.ImpactedPlanDTO> impactedPlans) {
        if (impactedPlans == null || impactedPlans.isEmpty()) {
            return 0;
        }
        int score = 0;
        score += Math.min(30, impactedPlans.size() * 10);  // 受影响计划数 (最多30分)
        int maxDelay = impactedPlans.stream()
                .mapToInt(p -> p.getDelayMinutes() != null ? p.getDelayMinutes() : 0)
                .max().orElse(0);
        score += Math.min(30, maxDelay / 30);  // 最大延误 (最多30分)
        long vipCount = impactedPlans.stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsVipCustomer()))
                .count();
        score += Math.min(40, (int) vipCount * 20);  // VIP客户 (最多40分)
        return Math.min(100, score);
    }

    /**
     * 确定审批级别
     */
    private String determineApprovalLevel(String impactLevel, int vipCount) {
        if ("critical".equals(impactLevel) || vipCount >= 2) {
            return "DIRECTOR";
        }
        if ("high".equals(impactLevel) || vipCount >= 1) {
            return "MANAGER";
        }
        if ("medium".equals(impactLevel)) {
            return "SUPERVISOR";
        }
        return null;
    }

    private List<InsertSlotDTO.ImpactedPlanDTO> parseImpactedPlans(String json) {
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<InsertSlotDTO.ImpactedPlanDTO>>() {});
        } catch (Exception e) {
            log.warn("解析受影响计划JSON失败: {}", json, e);
            return new ArrayList<>();
        }
    }

    private ProductionPlan createProductionPlanFromSlot(
            String factoryId, Long userId, InsertSlot slot, ConfirmUrgentInsertRequest request) {

        ProductionPlan plan = new ProductionPlan();
        plan.setId(UUID.randomUUID().toString());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber("URGENT-" + System.currentTimeMillis() + "-" +
                UUID.randomUUID().toString().substring(0, 4).toUpperCase());
        plan.setProductTypeId(request.getProductTypeId());
        plan.setPlannedQuantity(request.getPlannedQuantity());
        plan.setStartTime(slot.getStartTime());
        plan.setEndTime(slot.getEndTime());
        plan.setExpectedCompletionDate(slot.getEndTime().toLocalDate());
        plan.setStatus(ProductionPlanStatus.PENDING);
        plan.setPlanType(ProductionPlanType.FROM_INVENTORY);
        plan.setCustomerOrderNumber(request.getCustomerOrderNumber());
        plan.setPriority(request.getPriority() != null ? request.getPriority() : 9);
        plan.setNotes(request.getNotes());
        plan.setCreatedBy(userId);

        // 设置调度员扩展字段
        plan.setSourceType(PlanSourceType.URGENT_INSERT);
        plan.setSourceOrderId(request.getCustomerOrderNumber());
        plan.setSourceCustomerName(request.getCustomerName());

        // 计算CR值（紧急插单通常CR值较低）
        plan.setCrValue(plan.calculateCrValue(1));  // 假设1天工期

        return plan;
    }

    private int calculateRecommendScore(LocalDateTime slotStart) {
        // 基于时间计算推荐分数
        // 越接近当前时间，分数越高（更容易安排）
        long hoursFromNow = ChronoUnit.HOURS.between(LocalDateTime.now(), slotStart);

        if (hoursFromNow <= 2) {
            return 95;  // 最近2小时，高分
        } else if (hoursFromNow <= 4) {
            return 85;
        } else if (hoursFromNow <= 8) {
            return 75;
        } else if (hoursFromNow <= 24) {
            return 65;
        } else {
            return 50;
        }
    }

    private String generateRecommendationReason(LocalDateTime slotStart) {
        long hoursFromNow = ChronoUnit.HOURS.between(LocalDateTime.now(), slotStart);

        if (hoursFromNow <= 2) {
            return "时段即将开始，人员和设备已就位，无需等待";
        } else if (hoursFromNow <= 4) {
            return "时段较近，可快速开始生产";
        } else if (hoursFromNow <= 8) {
            return "当日时段，便于安排人员";
        } else {
            return "正常时段，可提前准备原料和设备";
        }
    }

    /**
     * 构建强制插单审批上下文
     * 包含影响分析结果、受影响计划、VIP客户等信息
     * 用于 ApprovalChainService 判断是否需要审批
     *
     * @param slot    插单时段
     * @param request 插单请求
     * @return 审批上下文Map
     */
    private Map<String, Object> buildForceInsertApprovalContext(
            InsertSlot slot, ConfirmUrgentInsertRequest request) {

        Map<String, Object> context = new HashMap<>();

        // 基本影响信息
        context.put("impactLevel", slot.getImpactLevel());

        // 解析受影响计划
        List<InsertSlotDTO.ImpactedPlanDTO> impactedPlans = parseImpactedPlans(slot.getImpactedPlans());
        context.put("affectedPlanCount", impactedPlans.size());

        // 计算受影响产线数
        Set<String> affectedLines = new HashSet<>();
        int maxDelayMinutes = 0;
        int totalDelayMinutes = 0;
        int vipCustomerCount = 0;

        for (InsertSlotDTO.ImpactedPlanDTO plan : impactedPlans) {
            // 统计延误时间
            if (plan.getDelayMinutes() != null) {
                maxDelayMinutes = Math.max(maxDelayMinutes, plan.getDelayMinutes());
                totalDelayMinutes += plan.getDelayMinutes();
            }
            // 统计VIP客户
            if (Boolean.TRUE.equals(plan.getIsVipCustomer())) {
                vipCustomerCount++;
            }
        }

        // 从影响分析服务获取更详细的链式影响
        ChainImpactResult chainImpact = impactAnalysisService.calculateChainImpact(
                slot.getFactoryId(),
                slot.getStartTime(),
                slot.getEndTime(),
                request.getProductTypeId(),
                request.getPlannedQuantity()
        );

        // 使用链式影响分析的精确数据
        // 注：affectedLines 使用 totalAffectedPlans 作为近似值（每个计划通常对应一条产线）
        context.put("affectedLines", chainImpact.getTotalAffectedPlans());
        context.put("directConflicts", chainImpact.getDirectConflicts());
        context.put("cascadeDelays", chainImpact.getCascadeDelays());
        context.put("maxDelayMinutes", chainImpact.getMaxDelayMinutes());
        context.put("totalDelayMinutes", chainImpact.getTotalDelayMinutes());
        context.put("vipCustomerCount", chainImpact.getAffectedVipCustomers());
        context.put("criticalCrPlans", chainImpact.getCriticalCrPlans());
        context.put("exceedingDeadlinePlans", chainImpact.getExceedingDeadlinePlans());
        context.put("impactScore", chainImpact.getImpactScore());

        // 请求相关信息
        context.put("priority", request.getPriority());
        context.put("plannedQuantity", request.getPlannedQuantity());
        context.put("hasCustomerOrder", request.getCustomerOrderNumber() != null);

        // 时间紧迫性
        long hoursFromNow = ChronoUnit.HOURS.between(LocalDateTime.now(), slot.getStartTime());
        context.put("hoursFromNow", hoursFromNow);
        context.put("isUrgent", hoursFromNow <= 4);

        return context;
    }
}
