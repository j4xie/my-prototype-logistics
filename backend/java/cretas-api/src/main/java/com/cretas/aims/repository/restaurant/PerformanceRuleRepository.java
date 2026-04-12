package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.PerformanceRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface PerformanceRuleRepository extends JpaRepository<PerformanceRule, String> {
    Optional<PerformanceRule> findByFactoryIdAndStoreIdAndEffectiveMonthAndIsActiveTrue(
        String factoryId, String storeId, LocalDate effectiveMonth);
}
