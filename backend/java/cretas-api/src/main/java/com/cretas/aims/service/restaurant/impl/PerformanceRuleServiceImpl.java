package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.entity.restaurant.PerformanceRule;
import com.cretas.aims.repository.restaurant.PerformanceRuleRepository;
import com.cretas.aims.service.restaurant.PerformanceRuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

@Slf4j @Service @RequiredArgsConstructor
public class PerformanceRuleServiceImpl implements PerformanceRuleService {
    private final PerformanceRuleRepository repo;

    @Override
    public PerformanceRule createOrUpdate(String factoryId, String storeId, LocalDate month,
                                          Map<String, Object> kpiWeights, Map<String, Object> nonControllable,
                                          String modifyRole, String createdBy) {
        LocalDate m = month.withDayOfMonth(1);
        PerformanceRule rule = repo.findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(factoryId, storeId, m)
            .orElse(PerformanceRule.builder().factoryId(factoryId).storeId(storeId).effectiveMonth(m).build());
        rule.setKpiWeights(kpiWeights);
        rule.setNonControllableItems(nonControllable);
        rule.setModifyRole(modifyRole != null ? modifyRole : "OWNER");
        rule.setCreatedBy(createdBy);
        rule.setIsActive(true);
        return repo.save(rule);
    }

    @Override
    public Optional<PerformanceRule> getActiveRule(String factoryId, String storeId, LocalDate month) {
        return repo.findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(factoryId, storeId, month.withDayOfMonth(1));
    }
}
