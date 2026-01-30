package com.cretas.aims.service.impl;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.DetectMixedBatchRequest;
import com.cretas.aims.dto.scheduling.MixedBatchGroupDTO;
import com.cretas.aims.dto.scheduling.MixedBatchRuleDTO;
import com.cretas.aims.entity.MixedBatchGroup;
import com.cretas.aims.entity.MixedBatchRule;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.enums.MixedBatchType;
import com.cretas.aims.entity.enums.PlanSourceType;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.mapper.ProductionPlanMapper;
import com.cretas.aims.repository.MixedBatchGroupRepository;
import com.cretas.aims.repository.MixedBatchRuleRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.service.MixedBatchService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 混批排产服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MixedBatchServiceImpl implements MixedBatchService {

    private final MixedBatchGroupRepository groupRepository;
    private final MixedBatchRuleRepository ruleRepository;
    private final ProductionPlanRepository planRepository;
    private final ProductionPlanMapper planMapper;
    private final ObjectMapper objectMapper;

    // ==================== 混批检测 ====================

    @Override
    @Transactional
    public List<MixedBatchGroupDTO> detectMixedBatches(String factoryId, DetectMixedBatchRequest request) {
        log.info("检测可合批订单: factoryId={}, orderCount={}", factoryId, request.getOrderIds().size());

        List<MixedBatchGroupDTO> results = new ArrayList<>();

        // 获取启用的规则
        List<MixedBatchRule> rules = ruleRepository.findByFactoryIdAndIsEnabledTrue(factoryId);
        if (rules.isEmpty()) {
            log.warn("工厂 {} 没有启用的混批规则", factoryId);
            return results;
        }

        // 模拟检测逻辑 - 实际应该根据订单数据分析
        // TODO: 接入真实订单数据后完善检测算法

        // 检测同原料类型
        if (!Boolean.TRUE.equals(request.getSameProcessOnly())) {
            Optional<MixedBatchRule> sameMaterialRule = rules.stream()
                    .filter(r -> r.getRuleType() == MixedBatchType.SAME_MATERIAL)
                    .findFirst();

            if (sameMaterialRule.isPresent()) {
                List<MixedBatchGroupDTO> sameMaterialGroups = detectSameMaterialGroups(
                        factoryId, request.getOrderIds(), sameMaterialRule.get());
                results.addAll(sameMaterialGroups);
            }
        }

        // 检测同工艺类型
        if (!Boolean.TRUE.equals(request.getSameMaterialOnly())) {
            Optional<MixedBatchRule> sameProcessRule = rules.stream()
                    .filter(r -> r.getRuleType() == MixedBatchType.SAME_PROCESS)
                    .findFirst();

            if (sameProcessRule.isPresent()) {
                List<MixedBatchGroupDTO> sameProcessGroups = detectSameProcessGroups(
                        factoryId, request.getOrderIds(), sameProcessRule.get());
                results.addAll(sameProcessGroups);
            }
        }

        // 过滤低分结果
        if (request.getMinRecommendScore() != null && request.getMinRecommendScore() > 0) {
            results = results.stream()
                    .filter(g -> g.getRecommendScore() >= request.getMinRecommendScore())
                    .collect(Collectors.toList());
        }

        // 过滤低节省时间结果
        if (request.getMinSavingMinutes() != null && request.getMinSavingMinutes() > 0) {
            results = results.stream()
                    .filter(g -> g.getEstimatedSwitchSaving() >= request.getMinSavingMinutes())
                    .collect(Collectors.toList());
        }

        // 按推荐分数排序
        results.sort((a, b) -> Integer.compare(b.getRecommendScore(), a.getRecommendScore()));

        return results;
    }

    /**
     * 检测同原料混批组
     */
    private List<MixedBatchGroupDTO> detectSameMaterialGroups(String factoryId, List<String> orderIds,
                                                               MixedBatchRule rule) {
        // 模拟实现 - 实际应该根据订单的原料批次进行分组
        List<MixedBatchGroupDTO> groups = new ArrayList<>();

        // 创建示例混批组
        if (orderIds.size() >= 2) {
            MixedBatchGroupDTO group = MixedBatchGroupDTO.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .groupType(MixedBatchType.SAME_MATERIAL)
                    .groupTypeDisplayName("同原料不同客户")
                    .materialBatchNumber("MB-DEMO-001")
                    .materialName("示例原料")
                    .orderCount(Math.min(orderIds.size(), 3))
                    .totalQuantity(new BigDecimal("500.00"))
                    .quantityUnit("kg")
                    .estimatedSwitchSaving(20)
                    .earliestDeadline(LocalDateTime.now().plusDays(1))
                    .latestDeadline(LocalDateTime.now().plusDays(2))
                    .deadlineGapHours(24)
                    .status("pending")
                    .statusDisplayName("待确认")
                    .recommendScore(85)
                    .recommendationReason("原料批次相同，合并可减少20分钟换型时间")
                    .createdAt(LocalDateTime.now())
                    .build();

            groups.add(group);
        }

        return groups;
    }

    /**
     * 检测同工艺混批组
     */
    private List<MixedBatchGroupDTO> detectSameProcessGroups(String factoryId, List<String> orderIds,
                                                              MixedBatchRule rule) {
        // 模拟实现 - 实际应该根据订单的工艺类型进行分组
        List<MixedBatchGroupDTO> groups = new ArrayList<>();

        // 创建示例混批组
        if (orderIds.size() >= 2) {
            MixedBatchGroupDTO group = MixedBatchGroupDTO.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .groupType(MixedBatchType.SAME_PROCESS)
                    .groupTypeDisplayName("同工艺不同产品")
                    .processType("slicing")
                    .processName("切片工艺")
                    .orderCount(Math.min(orderIds.size(), 4))
                    .totalQuantity(new BigDecimal("800.00"))
                    .quantityUnit("kg")
                    .estimatedSwitchSaving(30)
                    .processSimilarity(new BigDecimal("0.92"))
                    .earliestDeadline(LocalDateTime.now().plusDays(1))
                    .latestDeadline(LocalDateTime.now().plusDays(3))
                    .deadlineGapHours(48)
                    .status("pending")
                    .statusDisplayName("待确认")
                    .recommendScore(78)
                    .recommendationReason("工艺相似度92%，合并可减少30分钟换型时间")
                    .createdAt(LocalDateTime.now())
                    .build();

            groups.add(group);
        }

        return groups;
    }

    @Override
    @Transactional
    public int autoDetectAndCreate(String factoryId) {
        log.info("自动检测并创建混批建议: factoryId={}", factoryId);

        // 获取自动合并规则
        List<MixedBatchRule> autoRules = ruleRepository.findByFactoryIdAndIsEnabledTrue(factoryId)
                .stream()
                .filter(r -> Boolean.TRUE.equals(r.getAutoMerge()))
                .collect(Collectors.toList());

        if (autoRules.isEmpty()) {
            return 0;
        }

        // TODO: 实现自动检测逻辑
        // 1. 获取待处理订单
        // 2. 按规则分组检测
        // 3. 创建混批组记录

        return 0;
    }

    // ==================== 混批组管理 ====================

    @Override
    public Page<MixedBatchGroupDTO> getMixedBatchGroups(String factoryId, String status,
                                                         MixedBatchType groupType, Pageable pageable) {
        Page<MixedBatchGroup> groups;

        if (status != null && groupType != null) {
            // 同时按状态和类型筛选
            groups = groupRepository.findByFactoryIdAndStatus(factoryId, status, pageable);
            // 再在内存中过滤类型
            List<MixedBatchGroup> filtered = groups.getContent().stream()
                    .filter(g -> g.getGroupType() == groupType)
                    .collect(Collectors.toList());
            groups = new PageImpl<>(filtered, pageable, filtered.size());
        } else if (status != null) {
            groups = groupRepository.findByFactoryIdAndStatus(factoryId, status, pageable);
        } else if (groupType != null) {
            groups = groupRepository.findByFactoryIdAndGroupType(factoryId, groupType, pageable);
        } else {
            groups = groupRepository.findByFactoryId(factoryId, pageable);
        }

        return groups.map(this::toDTO);
    }

    @Override
    public List<MixedBatchGroupDTO> getPendingGroups(String factoryId) {
        return groupRepository.findPendingGroups(factoryId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public MixedBatchGroupDTO getGroupDetail(String factoryId, String groupId) {
        MixedBatchGroup group = groupRepository.findByIdAndFactoryId(groupId, factoryId)
                .orElseThrow(() -> new BusinessException("混批组不存在: " + groupId));

        return toDTO(group);
    }

    @Override
    @Transactional
    public ProductionPlanDTO confirmMixedBatch(String factoryId, String groupId, Long userId) {
        log.info("确认混批: factoryId={}, groupId={}, userId={}", factoryId, groupId, userId);

        MixedBatchGroup group = groupRepository.findByIdAndFactoryId(groupId, factoryId)
                .orElseThrow(() -> new BusinessException("混批组不存在: " + groupId));

        if (!group.isPending()) {
            throw new BusinessException("混批组状态不是待确认，当前状态: " + group.getStatusDisplayName());
        }

        // 创建混批生产计划
        ProductionPlan plan = createMixedBatchPlan(factoryId, group, userId);
        plan = planRepository.save(plan);

        // 更新混批组状态
        group.setStatus("confirmed");
        group.setConfirmedBy(userId);
        group.setConfirmedAt(LocalDateTime.now());
        group.setProductionPlanId(plan.getId());
        groupRepository.save(group);

        log.info("混批确认成功，创建生产计划: {}", plan.getId());

        return planMapper.toDTO(plan);
    }

    /**
     * 创建混批生产计划
     */
    private ProductionPlan createMixedBatchPlan(String factoryId, MixedBatchGroup group, Long userId) {
        ProductionPlan plan = new ProductionPlan();
        plan.setId(UUID.randomUUID().toString());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber("PP-MIX-" + System.currentTimeMillis());

        // 设置产品类型ID和描述 (使用混批组的信息)
        // 注意：实际应该关联具体的产品类型
        String description = group.getGroupType() == MixedBatchType.SAME_MATERIAL
                ? group.getMaterialName() + " - 混批"
                : group.getProcessName() + " - 混批";
        plan.setNotes("混批生产: " + description);

        plan.setPlannedQuantity(group.getTotalQuantity());
        plan.setStatus(ProductionPlanStatus.PENDING);
        plan.setPriority(8);

        // 设置调度员模块扩展字段
        plan.setSourceType(PlanSourceType.MANUAL);
        plan.setIsMixedBatch(true);
        plan.setMixedBatchType(group.getGroupType());
        plan.setRelatedOrders(group.getOrderIds());

        // 设置时间
        plan.setStartTime(LocalDateTime.now());
        plan.setEndTime(group.getLatestDeadline());
        if (group.getLatestDeadline() != null) {
            plan.setExpectedCompletionDate(group.getLatestDeadline().toLocalDate());
        }

        plan.setCreatedBy(userId);

        return plan;
    }

    @Override
    @Transactional
    public void rejectMixedBatch(String factoryId, String groupId, Long userId, String reason) {
        log.info("拒绝混批: factoryId={}, groupId={}, userId={}", factoryId, groupId, userId);

        MixedBatchGroup group = groupRepository.findByIdAndFactoryId(groupId, factoryId)
                .orElseThrow(() -> new BusinessException("混批组不存在: " + groupId));

        if (!group.isPending()) {
            throw new BusinessException("混批组状态不是待确认，当前状态: " + group.getStatusDisplayName());
        }

        group.setStatus("rejected");
        group.setConfirmedBy(userId);
        group.setConfirmedAt(LocalDateTime.now());
        group.setRejectionReason(reason);
        groupRepository.save(group);

        log.info("混批已拒绝: {}", groupId);
    }

    @Override
    @Transactional
    public MixedBatchGroupDTO updateGroupOrders(String factoryId, String groupId, List<String> orderIds) {
        MixedBatchGroup group = groupRepository.findByIdAndFactoryId(groupId, factoryId)
                .orElseThrow(() -> new BusinessException("混批组不存在: " + groupId));

        if (!group.isPending()) {
            throw new BusinessException("只能修改待确认的混批组");
        }

        try {
            group.setOrderIds(objectMapper.writeValueAsString(orderIds));
            group.setOrderCount(orderIds.size());
        } catch (JsonProcessingException e) {
            throw new BusinessException("序列化订单ID失败", e);
        }

        group = groupRepository.save(group);
        return toDTO(group);
    }

    // ==================== 规则管理 ====================

    @Override
    public List<MixedBatchRuleDTO> getRules(String factoryId) {
        return ruleRepository.findByFactoryId(factoryId).stream()
                .map(this::toRuleDTO)
                .collect(Collectors.toList());
    }

    @Override
    public MixedBatchRuleDTO getRule(String factoryId, MixedBatchType ruleType) {
        return ruleRepository.findByFactoryIdAndRuleType(factoryId, ruleType)
                .map(this::toRuleDTO)
                .orElse(null);
    }

    @Override
    @Transactional
    public MixedBatchRuleDTO saveRule(String factoryId, MixedBatchRuleDTO ruleDTO) {
        MixedBatchRule rule = ruleRepository.findByFactoryIdAndRuleType(factoryId, ruleDTO.getRuleType())
                .orElse(new MixedBatchRule());

        rule.setFactoryId(factoryId);
        rule.setRuleType(ruleDTO.getRuleType());
        rule.setIsEnabled(ruleDTO.getIsEnabled());
        rule.setMaxDeadlineGapHours(ruleDTO.getMaxDeadlineGapHours());
        rule.setMinSwitchSavingMinutes(ruleDTO.getMinSwitchSavingMinutes());
        rule.setProcessSimilarityThreshold(ruleDTO.getProcessSimilarityThreshold());
        rule.setMaxOrdersPerGroup(ruleDTO.getMaxOrdersPerGroup());
        rule.setMaxTotalQuantity(ruleDTO.getMaxTotalQuantity());
        rule.setAutoMerge(ruleDTO.getAutoMerge());
        rule.setRequireApproval(ruleDTO.getRequireApproval());
        rule.setNotes(ruleDTO.getNotes());

        rule = ruleRepository.save(rule);
        return toRuleDTO(rule);
    }

    @Override
    @Transactional
    public void toggleRule(String factoryId, MixedBatchType ruleType, boolean enabled) {
        MixedBatchRule rule = ruleRepository.findByFactoryIdAndRuleType(factoryId, ruleType)
                .orElseThrow(() -> new BusinessException("规则不存在: " + ruleType));

        rule.setIsEnabled(enabled);
        ruleRepository.save(rule);
    }

    // ==================== 统计与清理 ====================

    @Override
    public Map<String, Object> getStatistics(String factoryId) {
        Map<String, Object> stats = new HashMap<>();

        // 各状态数量统计
        Map<String, Long> statusCounts = new HashMap<>();
        groupRepository.countByStatus(factoryId).forEach(row -> {
            statusCounts.put((String) row[0], (Long) row[1]);
        });
        stats.put("statusCounts", statusCounts);

        // 待确认数量
        stats.put("pendingCount", groupRepository.countByFactoryIdAndStatus(factoryId, "pending"));

        // 已确认节省的总时间
        stats.put("totalSwitchSaving", groupRepository.sumSwitchSavingByFactory(factoryId));

        // 规则启用状态
        List<MixedBatchRule> rules = ruleRepository.findByFactoryId(factoryId);
        Map<String, Boolean> ruleStatus = new HashMap<>();
        rules.forEach(r -> ruleStatus.put(r.getRuleType().name(), r.getIsEnabled()));
        stats.put("ruleStatus", ruleStatus);

        return stats;
    }

    @Override
    @Transactional
    public int cleanupExpiredGroups(String factoryId) {
        // 删除7天前的过期混批组
        LocalDateTime before = LocalDateTime.now().minusDays(7);
        return groupRepository.deleteExpiredGroups(factoryId, before);
    }

    @Override
    @Transactional
    public int markExpiredGroups(String factoryId) {
        return groupRepository.markExpiredGroups(factoryId, LocalDateTime.now());
    }

    // ==================== 辅助方法 ====================

    /**
     * 转换为DTO
     */
    private MixedBatchGroupDTO toDTO(MixedBatchGroup entity) {
        MixedBatchGroupDTO dto = MixedBatchGroupDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .groupType(entity.getGroupType())
                .groupTypeDisplayName(entity.getGroupTypeDisplayName())
                .materialBatchId(entity.getMaterialBatchId())
                .materialBatchNumber(entity.getMaterialBatchNumber())
                .materialName(entity.getMaterialName())
                .processType(entity.getProcessType())
                .processName(entity.getProcessName())
                .orderCount(entity.getOrderCount())
                .totalQuantity(entity.getTotalQuantity())
                .quantityUnit(entity.getQuantityUnit())
                .estimatedSwitchSaving(entity.getEstimatedSwitchSaving())
                .processSimilarity(entity.getProcessSimilarity())
                .earliestDeadline(entity.getEarliestDeadline())
                .latestDeadline(entity.getLatestDeadline())
                .deadlineGapHours(entity.getDeadlineGapHours())
                .status(entity.getStatus())
                .statusDisplayName(entity.getStatusDisplayName())
                .recommendScore(entity.getRecommendScore())
                .recommendationReason(entity.getRecommendationReason())
                .confirmedBy(entity.getConfirmedBy())
                .confirmedAt(entity.getConfirmedAt())
                .rejectionReason(entity.getRejectionReason())
                .productionPlanId(entity.getProductionPlanId())
                .createdAt(entity.getCreatedAt())
                .build();

        // 解析订单列表
        if (entity.getOrderIds() != null) {
            try {
                List<String> orderIds = objectMapper.readValue(entity.getOrderIds(), new TypeReference<List<String>>() {});
                // TODO: 查询订单详情填充 OrderSummaryDTO
                dto.setOrders(new ArrayList<>());
            } catch (JsonProcessingException e) {
                log.error("解析订单ID失败", e);
                dto.setOrders(new ArrayList<>());
            }
        }

        return dto;
    }

    /**
     * 规则转换为DTO
     */
    private MixedBatchRuleDTO toRuleDTO(MixedBatchRule entity) {
        return MixedBatchRuleDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .ruleType(entity.getRuleType())
                .ruleTypeDisplayName(entity.getRuleTypeDisplayName())
                .isEnabled(entity.getIsEnabled())
                .maxDeadlineGapHours(entity.getMaxDeadlineGapHours())
                .minSwitchSavingMinutes(entity.getMinSwitchSavingMinutes())
                .processSimilarityThreshold(entity.getProcessSimilarityThreshold())
                .maxOrdersPerGroup(entity.getMaxOrdersPerGroup())
                .maxTotalQuantity(entity.getMaxTotalQuantity())
                .autoMerge(entity.getAutoMerge())
                .requireApproval(entity.getRequireApproval())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
