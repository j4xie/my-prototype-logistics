package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.entity.restaurant.SalesPlan;
import com.cretas.aims.repository.restaurant.SalesPlanRepository;
import com.cretas.aims.service.restaurant.SalesPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalesPlanServiceImpl implements SalesPlanService {

    private final SalesPlanRepository repository;

    @Override
    public SalesPlan createOrUpdate(String factoryId, String storeId, LocalDate month,
                                     BigDecimal targetRevenue, Integer targetOrderCount,
                                     Map<String, Object> dailyAdjustments,
                                     Map<String, Object> holidayAdjustments, String notes) {
        LocalDate planMonth = month.withDayOfMonth(1);
        SalesPlan plan = repository.findByFactoryIdAndStoreIdAndPlanMonth(factoryId, storeId, planMonth)
                .orElse(SalesPlan.builder()
                        .factoryId(factoryId)
                        .storeId(storeId)
                        .planMonth(planMonth)
                        .build());

        plan.setTargetRevenue(targetRevenue);
        plan.setTargetOrderCount(targetOrderCount);
        plan.setDailyAdjustments(dailyAdjustments);
        plan.setHolidayAdjustments(holidayAdjustments);
        plan.setNotes(notes);
        plan.setIsActive(true);

        return repository.save(plan);
    }

    @Override
    public Optional<SalesPlan> getPlan(String factoryId, String storeId, LocalDate month) {
        return repository.findByFactoryIdAndStoreIdAndPlanMonth(factoryId, storeId, month.withDayOfMonth(1));
    }

    @Override
    public List<SalesPlan> getActivePlans(String factoryId, LocalDate month) {
        return repository.findActivePlans(factoryId, month.withDayOfMonth(1));
    }

    @Override
    public Map<String, Object> getCompletionRate(String factoryId, String storeId, LocalDate month,
                                                   BigDecimal actualRevenue, Integer actualOrders) {
        Optional<SalesPlan> planOpt = getPlan(factoryId, storeId, month);
        if (planOpt.isEmpty()) {
            return Map.of("hasPlan", false, "message", "该门店当月未设置销售计划");
        }

        SalesPlan plan = planOpt.get();
        BigDecimal target = plan.getTargetRevenue();
        BigDecimal revenuePct = target.compareTo(BigDecimal.ZERO) > 0
                ? actualRevenue.multiply(BigDecimal.valueOf(100)).divide(target, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        int dayOfMonth = month.getDayOfMonth();
        int totalDays = month.lengthOfMonth();
        BigDecimal expectedPct = BigDecimal.valueOf(dayOfMonth * 100.0 / totalDays)
                .setScale(1, RoundingMode.HALF_UP);

        String status;
        if (revenuePct.compareTo(expectedPct) >= 0) {
            status = "ON_TRACK";
        } else if (revenuePct.compareTo(expectedPct.multiply(BigDecimal.valueOf(0.85))) >= 0) {
            status = "SLIGHT_BEHIND";
        } else {
            status = "BEHIND";
        }

        BigDecimal gap = target.subtract(actualRevenue);
        int remainingDays = totalDays - dayOfMonth;
        BigDecimal dailyNeeded = remainingDays > 0
                ? gap.divide(BigDecimal.valueOf(remainingDays), 0, RoundingMode.CEILING)
                : BigDecimal.ZERO;

        Map<String, Object> result = new HashMap<>();
        result.put("hasPlan", true);
        result.put("targetRevenue", target);
        result.put("actualRevenue", actualRevenue);
        result.put("completionPct", revenuePct);
        result.put("expectedPct", expectedPct);
        result.put("status", status);
        result.put("gap", gap.max(BigDecimal.ZERO));
        result.put("remainingDays", remainingDays);
        result.put("dailyNeeded", dailyNeeded);
        result.put("dayOfMonth", dayOfMonth);
        result.put("totalDays", totalDays);
        return result;
    }
}
