package com.cretas.aims.service.restaurant;

import com.cretas.aims.entity.restaurant.SalesPlan;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface SalesPlanService {
    SalesPlan createOrUpdate(String factoryId, String storeId, LocalDate month,
                             BigDecimal targetRevenue, Integer targetOrderCount,
                             Map<String, Object> dailyAdjustments,
                             Map<String, Object> holidayAdjustments, String notes);

    Optional<SalesPlan> getPlan(String factoryId, String storeId, LocalDate month);

    List<SalesPlan> getActivePlans(String factoryId, LocalDate month);

    Map<String, Object> getCompletionRate(String factoryId, String storeId, LocalDate month,
                                           BigDecimal actualRevenue, Integer actualOrders);
}
