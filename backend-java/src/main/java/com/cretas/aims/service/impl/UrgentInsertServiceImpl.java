package com.cretas.aims.service.impl;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.ConfirmUrgentInsertRequest;
import com.cretas.aims.dto.scheduling.GetInsertSlotsRequest;
import com.cretas.aims.dto.scheduling.InsertSlotDTO;
import com.cretas.aims.entity.InsertSlot;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.enums.PlanSourceType;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.ProductionPlanType;
import com.cretas.aims.mapper.ProductionPlanMapper;
import com.cretas.aims.repository.InsertSlotRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.ProductTypeRepository;
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
    private final ProductionPlanMapper productionPlanMapper;
    private final ObjectMapper objectMapper;

    @Override
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

        // 根据产能需求过滤
        BigDecimal requiredCapacity = request.getRequiredQuantity();
        slots = slots.stream()
                .filter(s -> s.getAvailableCapacity() == null ||
                        s.getAvailableCapacity().compareTo(requiredCapacity) >= 0)
                .collect(Collectors.toList());

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
        log.info("分析插单影响: factoryId={}, slotId={}", factoryId, slotId);

        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("时段不存在: " + slotId));

        Map<String, Object> result = new HashMap<>();
        result.put("slotId", slotId);
        result.put("impactLevel", slot.getImpactLevel());
        result.put("impactLevelDisplayName", slot.getImpactLevelDisplayName());
        result.put("switchCostMinutes", slot.getSwitchCostMinutes());
        result.put("hasEnoughWorkers", slot.hasEnoughWorkers());
        result.put("requiredWorkers", slot.getRequiredWorkers());
        result.put("availableWorkers", slot.getAvailableWorkers());
        result.put("availableCapacity", slot.getAvailableCapacity());
        result.put("requiredCapacity", request.getRequiredQuantity());

        // 解析受影响计划
        List<InsertSlotDTO.ImpactedPlanDTO> impactedPlans = parseImpactedPlans(slot.getImpactedPlans());
        result.put("impactedPlans", impactedPlans);
        result.put("impactedPlanCount", impactedPlans.size());

        // 计算总延迟时间
        int totalDelayMinutes = impactedPlans.stream()
                .mapToInt(p -> p.getDelayMinutes() != null ? p.getDelayMinutes() : 0)
                .sum();
        result.put("totalDelayMinutes", totalDelayMinutes);

        // 推荐信息
        result.put("recommendScore", slot.getRecommendScore());
        result.put("recommendationReason", slot.getRecommendationReason());

        // 风险评估
        String riskLevel = "low";
        if ("high".equals(slot.getImpactLevel()) || !slot.hasEnoughWorkers()) {
            riskLevel = "high";
        } else if ("medium".equals(slot.getImpactLevel())) {
            riskLevel = "medium";
        }
        result.put("riskLevel", riskLevel);

        return result;
    }

    @Override
    @Transactional
    public ProductionPlanDTO confirmInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request) {
        log.info("确认紧急插单: factoryId={}, slotId={}, quantity={}",
                factoryId, request.getSlotId(), request.getPlannedQuantity());

        // 验证时段
        InsertSlot slot = insertSlotRepository.findById(request.getSlotId())
                .orElseThrow(() -> new RuntimeException("时段不存在: " + request.getSlotId()));

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

        return productionPlanMapper.toDTO(savedPlan);
    }

    @Override
    @Transactional
    public ProductionPlanDTO forceInsert(String factoryId, Long userId, ConfirmUrgentInsertRequest request) {
        log.info("强制紧急插单: factoryId={}, slotId={}", factoryId, request.getSlotId());

        // 设置强制插入标记
        request.setForceInsert(true);

        // 调用确认插单
        ProductionPlanDTO plan = confirmInsert(factoryId, userId, request);

        // TODO: 创建审批记录（如果需要审批流程）

        return plan;
    }

    @Override
    @Transactional
    public int generateInsertSlots(String factoryId, int hoursAhead) {
        log.info("生成插单时段: factoryId={}, hoursAhead={}", factoryId, hoursAhead);

        // 清理旧的可用时段
        insertSlotRepository.deleteAvailableSlotsByFactoryId(factoryId);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endTime = now.plusHours(hoursAhead);

        List<InsertSlot> newSlots = new ArrayList<>();

        // 按2小时间隔生成时段
        LocalDateTime slotStart = now.truncatedTo(ChronoUnit.HOURS).plusHours(1);
        while (slotStart.isBefore(endTime)) {
            LocalDateTime slotEnd = slotStart.plusHours(2);

            InsertSlot slot = InsertSlot.builder()
                    .id(UUID.randomUUID().toString())
                    .factoryId(factoryId)
                    .productionLineId("default")  // 动态分配模式，无固定产线
                    .productionLineName("动态分配")
                    .startTime(slotStart)
                    .endTime(slotEnd)
                    .availableCapacity(new BigDecimal("500"))  // 默认500kg产能
                    .impactLevel("none")
                    .requiredWorkers(4)
                    .availableWorkers(6)
                    .switchCostMinutes(0)
                    .recommendScore(calculateRecommendScore(slotStart))
                    .recommendationReason(generateRecommendationReason(slotStart))
                    .status("available")
                    .build();

            newSlots.add(slot);
            slotStart = slotEnd;
        }

        insertSlotRepository.saveAll(newSlots);

        log.info("生成了 {} 个插单时段", newSlots.size());
        return newSlots.size();
    }

    @Override
    public InsertSlotDTO getSlotDetail(String factoryId, String slotId) {
        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("时段不存在: " + slotId));

        if (!factoryId.equals(slot.getFactoryId())) {
            throw new RuntimeException("无权访问该时段");
        }

        return toSlotDTO(slot);
    }

    @Override
    @Transactional
    public void markSlotAsSelected(String factoryId, String slotId) {
        InsertSlot slot = insertSlotRepository.findById(slotId)
                .orElseThrow(() -> new RuntimeException("时段不存在: " + slotId));

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
                .orElseThrow(() -> new RuntimeException("时段不存在: " + slotId));

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
        return InsertSlotDTO.builder()
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
}
