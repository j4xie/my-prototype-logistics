package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryDefaultValue;
import com.cretas.aims.repository.config.FactoryDefaultValueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultValueResolver {

    private final FactoryDefaultValueRepository defaultValueRepo;
    private final SpelConditionEvaluator spelEvaluator;

    public Object resolve(String factoryId, String moduleCode, String fieldCode,
                          Map<String, Object> context) {
        List<FactoryDefaultValue> factoryDefaults = defaultValueRepo
                .findByFactoryIdAndModuleCodeAndFieldCode(factoryId, moduleCode, fieldCode);
        Object result = matchDefault(factoryDefaults, context);
        if (result != null) return result;

        List<FactoryDefaultValue> globalDefaults = defaultValueRepo
                .findGlobalDefaults(moduleCode, fieldCode);
        return matchDefault(globalDefaults, context);
    }

    public Map<String, Object> resolveAll(String factoryId, String moduleCode,
                                           Map<String, Object> context) {
        List<FactoryDefaultValue> allDefaults = defaultValueRepo
                .findByFactoryIdAndModuleCode(factoryId, moduleCode);
        Map<String, Object> result = new LinkedHashMap<>();
        for (FactoryDefaultValue dv : allDefaults) {
            if (dv.getCondition() == null || dv.getCondition().isBlank() ||
                spelEvaluator.evaluateCondition(dv.getCondition(), context)) {
                result.putIfAbsent(dv.getFieldCode(), dv.getDefaultValue());
            }
        }
        return result;
    }

    private Object matchDefault(List<FactoryDefaultValue> defaults, Map<String, Object> context) {
        for (FactoryDefaultValue dv : defaults) {
            if (dv.getCondition() != null && !dv.getCondition().isBlank()) {
                if (spelEvaluator.evaluateCondition(dv.getCondition(), context)) {
                    return dv.getDefaultValue();
                }
            }
        }
        for (FactoryDefaultValue dv : defaults) {
            if (dv.getCondition() == null || dv.getCondition().isBlank()) {
                return dv.getDefaultValue();
            }
        }
        return null;
    }
}
