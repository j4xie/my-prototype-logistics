package com.cretas.aims.service.restaurant;

import com.cretas.aims.entity.restaurant.PerformanceRule;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

public interface PerformanceRuleService {
    PerformanceRule createOrUpdate(String factoryId, String storeId, LocalDate month,
                                   Map<String, Object> kpiWeights, Map<String, Object> nonControllable,
                                   String modifyRole, String createdBy);
    Optional<PerformanceRule> getActiveRule(String factoryId, String storeId, LocalDate month);
}
