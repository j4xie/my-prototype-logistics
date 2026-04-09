package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryValidationRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.FactoryValidationRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ValidationRuleEvaluator {

    private final FactoryValidationRuleRepository ruleRepo;
    private final SpelConditionEvaluator spelEvaluator;

    public List<String> validate(String factoryId, String moduleCode, String operation,
                                  Map<String, Object> context) {
        List<FactoryValidationRule> rules = ruleRepo
                .findByFactoryIdAndModuleCodeAndOperationAndEnabledTrueOrderBySortOrder(
                        factoryId, moduleCode, operation);
        if (rules.isEmpty()) {
            rules = ruleRepo.findGlobalRules(moduleCode, operation);
        }

        List<String> warnings = new ArrayList<>();
        for (FactoryValidationRule rule : rules) {
            boolean conditionMet = spelEvaluator.evaluateCondition(rule.getCondition(), context);
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
