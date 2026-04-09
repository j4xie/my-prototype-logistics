package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.FactoryValidationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FactoryValidationRuleRepository extends JpaRepository<FactoryValidationRule, Long> {
    List<FactoryValidationRule> findByFactoryIdAndModuleCodeAndOperationAndEnabledTrueOrderBySortOrder(
            String factoryId, String moduleCode, String operation);
    @Query("SELECT r FROM FactoryValidationRule r WHERE r.factoryId IS NULL AND r.moduleCode = :moduleCode AND r.operation = :operation AND r.enabled = true ORDER BY r.sortOrder")
    List<FactoryValidationRule> findGlobalRules(@Param("moduleCode") String moduleCode, @Param("operation") String operation);
    List<FactoryValidationRule> findByFactoryIdAndModuleCode(String factoryId, String moduleCode);
}
