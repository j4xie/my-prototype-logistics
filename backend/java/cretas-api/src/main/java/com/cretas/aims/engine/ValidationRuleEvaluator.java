package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryValidationRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.FactoryValidationRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ValidationRuleEvaluator {

    private final FactoryValidationRuleRepository ruleRepo;
    private final SpelConditionEvaluator spelEvaluator;

    // Round 4 Fix P2-24: for auto-hydration
    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;
    @Autowired(required = false)
    private DDLExecutor ddlExecutor;

    public List<String> validate(String factoryId, String moduleCode, String operation,
                                  Map<String, Object> context) {
        List<FactoryValidationRule> rules = ruleRepo
                .findByFactoryIdAndModuleCodeAndOperationAndEnabledTrueOrderBySortOrder(
                        factoryId, moduleCode, operation);
        if (rules.isEmpty()) {
            rules = ruleRepo.findGlobalRules(moduleCode, operation);
        }

        // Round 4 Fix P2-24: auto-hydrate context with full record fields for UPDATE.
        // If context contains recordId but is sparse (caller only filled a few fields),
        // fetch the full row from DB and merge so SpEL rules can access any column.
        //
        // Round 6 Fix POINT-7: autoHydrate must also filter by factory_id so a rule evaluation
        // for factory A cannot accidentally load factory B's record into the SpEL context. The
        // caller is supposed to pre-verify recordId ownership, but this belt-and-braces guard
        // prevents any accidental cross-tenant read if a caller forgets.
        Map<String, Object> enrichedContext = new HashMap<>(context != null ? context : Map.of());
        Object recordIdObj = enrichedContext.get("recordId");
        if (recordIdObj != null && "UPDATE".equals(operation) && ddlExecutor != null && jdbcTemplate != null) {
            try {
                String tableName = ddlExecutor.resolveTable(moduleCode);
                // Check if the target table has factory_id — if yes, filter by it; if no, skip hydration
                // entirely (we can't safely read rows without tenant isolation).
                Integer hasFactoryIdCount = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM information_schema.columns " +
                        "WHERE table_name = ? AND column_name = 'factory_id'",
                        Integer.class, tableName);
                if (hasFactoryIdCount == null || hasFactoryIdCount == 0) {
                    log.debug("Auto-hydration skipped for {}: table has no factory_id column", tableName);
                } else {
                    String sql = "SELECT * FROM " + tableName +
                            " WHERE id::text = ? AND factory_id = ? LIMIT 1";
                    Map<String, Object> dbRow = jdbcTemplate.queryForMap(sql,
                            recordIdObj.toString(), factoryId);
                    // Merge DB columns into context, but don't overwrite explicit caller values
                    for (Map.Entry<String, Object> e : dbRow.entrySet()) {
                        enrichedContext.putIfAbsent(e.getKey(), e.getValue());
                    }
                }
            } catch (Exception e) {
                log.debug("Auto-hydration skipped for {}#{}: {}", moduleCode, recordIdObj, e.getMessage());
            }
        }

        List<String> warnings = new ArrayList<>();
        for (FactoryValidationRule rule : rules) {
            boolean conditionMet = spelEvaluator.evaluateCondition(rule.getCondition(), enrichedContext);
            if (conditionMet) {
                switch (rule.getSeverity()) {
                    case "BLOCK" -> throw new BusinessException(rule.getErrorMessage());
                    case "WARN" -> {
                        log.warn("Validation warning [{}]: {}", rule.getRuleCode(), rule.getErrorMessage());
                        warnings.add(rule.getErrorMessage());
                    }
                    case "INFO" -> log.info("Validation info [{}]: {}", rule.getRuleCode(), rule.getErrorMessage());
                }
            }
        }
        return warnings;
    }

    public boolean isRuleEnabled(String factoryId, String moduleCode, String ruleCode) {
        List<FactoryValidationRule> rules = ruleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode);
        return rules.stream()
                .filter(r -> r.getRuleCode().equals(ruleCode))
                .findFirst()
                .map(FactoryValidationRule::getEnabled)
                .orElse(true);
    }
}
