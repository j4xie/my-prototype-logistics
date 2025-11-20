package com.cretas.aims.service.impl;

import com.cretas.aims.dto.factory.FactoryAIUsageDTO;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.AIUsageLogRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.FactoryAIService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.Locale;

/**
 * 工厂AI配额服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Service
@RequiredArgsConstructor
public class FactoryAIServiceImpl implements FactoryAIService {

    private final FactoryRepository factoryRepository;
    private final AIUsageLogRepository aiUsageLogRepository;

    @Override
    public FactoryAIUsageDTO getFactoryAIUsage(String factoryId) {
        // 查找工厂
        Factory factory = factoryRepository.findById(factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("工厂不存在: " + factoryId));

        // 获取当前周次
        String currentWeek = getCurrentWeekNumber();

        // 获取配额（默认50）
        Integer weeklyQuota = factory.getAiWeeklyQuota() != null ? factory.getAiWeeklyQuota() : 50;

        // 查询本周使用次数
        Long weeklyUsed = aiUsageLogRepository.countByFactoryIdAndWeekNumber(factoryId, currentWeek);
        if (weeklyUsed == null) {
            weeklyUsed = 0L;
        }

        // 计算剩余次数
        long weeklyRemaining = Math.max(0, weeklyQuota - weeklyUsed);

        // 计算利用率（保留2位小数）
        String utilization = "0.00";
        if (weeklyQuota > 0) {
            BigDecimal rate = BigDecimal.valueOf(weeklyUsed)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(weeklyQuota), 2, RoundingMode.HALF_UP);
            utilization = rate.toString();
        }

        // 查询历史总使用次数
        Long totalUsed = aiUsageLogRepository.countByFactoryId(factoryId);
        if (totalUsed == null) {
            totalUsed = 0L;
        }

        // 确定配额状态
        FactoryAIUsageDTO.QuotaStatus status = determineQuotaStatus(weeklyUsed, weeklyQuota);

        return FactoryAIUsageDTO.builder()
                .factoryId(factory.getId())
                .factoryName(factory.getName())
                .weeklyQuota(weeklyQuota)
                .currentWeek(currentWeek)
                .weeklyUsed(weeklyUsed)
                .weeklyRemaining(weeklyRemaining)
                .utilization(utilization)
                .totalUsed(totalUsed)
                .status(status)
                .build();
    }

    /**
     * 确定配额状态
     */
    private FactoryAIUsageDTO.QuotaStatus determineQuotaStatus(Long used, Integer quota) {
        if (quota == 0) {
            return FactoryAIUsageDTO.QuotaStatus.EXHAUSTED;
        }

        double usageRate = (double) used / quota;

        if (usageRate >= 1.0) {
            return FactoryAIUsageDTO.QuotaStatus.EXHAUSTED;
        } else if (usageRate >= 0.8) {
            return FactoryAIUsageDTO.QuotaStatus.WARNING;
        } else {
            return FactoryAIUsageDTO.QuotaStatus.NORMAL;
        }
    }

    /**
     * 获取当前周次编号（ISO 8601格式）
     */
    private String getCurrentWeekNumber() {
        LocalDate now = LocalDate.now();
        // 使用中国周计算规则（周一为一周的第一天）
        WeekFields weekFields = WeekFields.of(Locale.CHINA);
        int year = now.get(weekFields.weekBasedYear());
        int week = now.get(weekFields.weekOfWeekBasedYear());
        return String.format("%d-W%02d", year, week);
    }
}
