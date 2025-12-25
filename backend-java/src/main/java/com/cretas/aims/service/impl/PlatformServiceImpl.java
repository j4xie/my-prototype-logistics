package com.cretas.aims.service.impl;

import com.cretas.aims.dto.platform.FactoryAIQuotaDTO;
import com.cretas.aims.dto.platform.PlatformAIUsageStatsDTO;
import com.cretas.aims.dto.platform.PlatformStatisticsDTO;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.entity.enums.ProductionBatchStatus;
import com.cretas.aims.repository.AIUsageLogRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PlatformService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * 平台管理服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Service
@RequiredArgsConstructor
public class PlatformServiceImpl implements PlatformService {
    private static final Logger log = LoggerFactory.getLogger(PlatformServiceImpl.class);

    private final FactoryRepository factoryRepository;
    private final AIUsageLogRepository aiUsageLogRepository;
    private final UserRepository userRepository;
    private final ProductionBatchRepository productionBatchRepository;

    @Override
    public List<FactoryAIQuotaDTO> getAllFactoryAIQuotas() {
        log.info("获取所有工厂AI配额");

        // 只查询激活的工厂，避免加载已停用的工厂
        List<Factory> factories = factoryRepository.findByIsActiveTrue();

        return factories.stream()
                .map(factory -> {
                    Long totalUsage = aiUsageLogRepository.countByFactoryId(factory.getId());
                    return FactoryAIQuotaDTO.builder()
                            .id(factory.getId())
                            .name(factory.getName())
                            .aiWeeklyQuota(factory.getAiWeeklyQuota() != null ? factory.getAiWeeklyQuota() : 50)
                            ._count(FactoryAIQuotaDTO.CountInfo.builder()
                                    .aiUsageLogs(totalUsage)
                                    .build())
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public FactoryAIQuotaDTO.CountInfo updateFactoryAIQuota(String factoryId, Integer weeklyQuota) {
        log.info("更新工厂AI配额: factoryId={}, weeklyQuota={}", factoryId, weeklyQuota);

        // 验证参数
        if (weeklyQuota == null) {
            throw new BusinessException("配额不能为空");
        }
        if (weeklyQuota < 0 || weeklyQuota > 1000) {
            throw new BusinessException("配额必须在0-1000之间");
        }

        // 查找工厂
        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在: " + factoryId));

        // 更新配额
        factory.setAiWeeklyQuota(weeklyQuota);
        factoryRepository.save(factory);

        log.info("工厂AI配额已更新: factoryId={}, 新配额={}", factoryId, weeklyQuota);

        return FactoryAIQuotaDTO.CountInfo.builder()
                .aiUsageLogs(aiUsageLogRepository.countByFactoryId(factoryId))
                .build();
    }

    @Override
    public PlatformAIUsageStatsDTO getPlatformAIUsageStats() {
        log.info("获取平台AI使用统计");

        String currentWeek = getCurrentWeekNumber();
        log.debug("当前周次: {}", currentWeek);

        // 只统计激活工厂的AI使用情况
        List<Factory> factories = factoryRepository.findByIsActiveTrue();

        long totalUsed = 0;
        List<PlatformAIUsageStatsDTO.FactoryUsageInfo> factoryUsages = new java.util.ArrayList<>();

        for (Factory factory : factories) {
            Long weeklyUsed = aiUsageLogRepository.countByFactoryIdAndWeekNumber(
                    factory.getId(),
                    currentWeek
            );

            Integer quota = factory.getAiWeeklyQuota() != null ? factory.getAiWeeklyQuota() : 50;
            long used = weeklyUsed != null ? weeklyUsed : 0;
            long remaining = Math.max(0, quota - used);

            // 计算使用率（保留2位小数）
            String utilization = "0.00";
            if (quota > 0) {
                BigDecimal rate = BigDecimal.valueOf(used)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(quota), 2, RoundingMode.HALF_UP);
                utilization = rate.toString();
            }

            PlatformAIUsageStatsDTO.FactoryUsageInfo usageInfo = PlatformAIUsageStatsDTO.FactoryUsageInfo.builder()
                    .factoryId(factory.getId())
                    .factoryName(factory.getName())
                    .weeklyQuota(quota)
                    .used(used)
                    .remaining(remaining)
                    .utilization(utilization)
                    .build();

            factoryUsages.add(usageInfo);
            totalUsed += used;
        }

        return PlatformAIUsageStatsDTO.builder()
                .currentWeek(currentWeek)
                .totalUsed(totalUsed)
                .factories(factoryUsages)
                .build();
    }

    @Override
    public String getCurrentWeekNumber() {
        LocalDate now = LocalDate.now();

        // 使用ISO 8601周数计算（周一为一周的开始）
        WeekFields weekFields = WeekFields.of(Locale.CHINA);
        int year = now.get(weekFields.weekBasedYear());
        int week = now.get(weekFields.weekOfWeekBasedYear());

        return String.format("%d-W%02d", year, week);
    }

    @Override
    public PlatformStatisticsDTO getDashboardStatistics() {
        log.info("获取平台统计数据");

        // 1. 统计工厂
        long totalFactories = factoryRepository.count();
        long activeFactories = factoryRepository.countActiveFactories();
        long inactiveFactories = totalFactories - activeFactories;

        log.debug("工厂统计: 总数={}, 活跃={}, 不活跃={}", totalFactories, activeFactories, inactiveFactories);

        // 2. 统计用户
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByIsActive(true);

        log.debug("用户统计: 总数={}, 活跃={}", totalUsers, activeUsers);

        // 3. 统计批次
        long totalBatches = productionBatchRepository.count();
        long completedBatches = productionBatchRepository.countByStatus(ProductionBatchStatus.COMPLETED);

        log.debug("批次统计: 总数={}, 已完成={}", totalBatches, completedBatches);

        // 4. 统计今日产量
        LocalDate today = LocalDate.now();
        java.time.LocalDateTime startOfDay = today.atStartOfDay();
        java.time.LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        Double todayProduction = productionBatchRepository
                .findByCreatedAtBetween(startOfDay, endOfDay)
                .stream()
                .filter(batch -> ProductionBatchStatus.COMPLETED.equals(batch.getStatus()))
                .filter(batch -> batch.getQuantity() != null)
                .mapToDouble(batch -> batch.getQuantity().doubleValue())
                .sum();

        log.debug("今日产量: {}kg", todayProduction);

        // 5. 统计AI配额
        String currentWeek = getCurrentWeekNumber();
        Integer aiQuotaUsed = 0;
        try {
            // 使用findByWeekNumber查询本周所有记录，然后统计数量
            aiQuotaUsed = aiUsageLogRepository.findByWeekNumber(currentWeek).size();
        } catch (Exception e) {
            log.warn("获取AI使用量失败: {}", e.getMessage());
        }

        // 总配额 = 激活工厂的周配额之和（使用数据库聚合查询，避免加载所有工厂）
        Integer aiQuotaLimit = factoryRepository.sumActiveFactoriesAIQuota();

        log.debug("AI配额: 已使用={}, 总限制={}", aiQuotaUsed, aiQuotaLimit);

        // 6. 系统健康状态
        String systemHealth = determineSystemHealth(activeFactories, totalFactories);

        log.info("平台统计数据汇总完成: 工厂{}/{}, 用户{}/{}, 批次{}/{}, 产量{}kg, AI{}/{}",
                activeFactories, totalFactories,
                activeUsers, totalUsers,
                completedBatches, totalBatches,
                todayProduction,
                aiQuotaUsed, aiQuotaLimit);

        return PlatformStatisticsDTO.builder()
                .totalFactories((int) totalFactories)
                .activeFactories((int) activeFactories)
                .inactiveFactories((int) inactiveFactories)
                .totalUsers((int) totalUsers)
                .activeUsers((int) activeUsers)
                .totalBatches(totalBatches)
                .completedBatches(completedBatches)
                .totalProductionToday(todayProduction)
                .totalAIQuotaUsed(aiQuotaUsed)
                .totalAIQuotaLimit(aiQuotaLimit)
                .systemHealth(systemHealth)
                .build();
    }

    /**
     * 获取平台报表
     *
     * @param reportType 报表类型
     * @param period 统计周期
     * @return 平台报表数据
     */
    @Override
    public Object getPlatformReport(String reportType, String period) {
        log.info("获取平台报表: reportType={}, period={}", reportType, period);
        // 返回平台统计数据
        return getDashboardStatistics();
    }

    /**
     * 判断系统健康状态
     *
     * @param activeFactories 活跃工厂数
     * @param totalFactories 工厂总数
     * @return 健康状态: "healthy", "warning", "critical"
     */
    private String determineSystemHealth(long activeFactories, long totalFactories) {
        if (totalFactories == 0) {
            return "critical";
        }

        double ratio = (double) activeFactories / totalFactories;
        if (ratio >= 0.9) {
            return "healthy";
        } else if (ratio >= 0.7) {
            return "warning";
        } else {
            return "critical";
        }
    }
}
