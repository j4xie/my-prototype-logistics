package com.cretas.aims.engine;

import com.cretas.aims.entity.config.FactoryFormula;
import com.cretas.aims.repository.config.FactoryFormulaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class FormulaEngine {

    private final FactoryFormulaRepository formulaRepo;
    private final SpelConditionEvaluator spelEvaluator;
    private final AggregateFormulaExecutor aggregateExecutor;

    public BigDecimal evaluate(String factoryId, String moduleCode, String formulaCode,
                                Map<String, Object> variables) {
        Optional<FactoryFormula> formula = formulaRepo
                .findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, moduleCode, formulaCode);
        if (formula.isEmpty()) {
            formula = formulaRepo.findGlobalFormula(moduleCode, formulaCode);
        }
        if (formula.isEmpty()) return null;

        FactoryFormula f = formula.get();
        return spelEvaluator.evaluateFormula(f.getExpression(), variables, f.getPrecisionVal());
    }

    public Object evaluateAny(String factoryId, String moduleCode, String formulaCode, Map<String, Object> variables) {
        Optional<FactoryFormula> formula = formulaRepo.findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, moduleCode, formulaCode);
        if (formula.isEmpty()) {
            formula = formulaRepo.findByFactoryIdAndModuleCodeAndFormulaCode(null, moduleCode, formulaCode);
        }
        if (formula.isEmpty()) return null;

        FactoryFormula f = formula.get();
        if ("AGGREGATE".equals(f.getResultType())) {
            return aggregateExecutor.execute(f.getExpression(), variables);
        }
        return spelEvaluator.evaluateFormula(f.getExpression(), variables, f.getPrecisionVal());
    }

    public BigDecimal evaluateExpression(String expression, Map<String, Object> variables, int precision) {
        return spelEvaluator.evaluateFormula(expression, variables, precision);
    }

    public List<FactoryFormula> listFormulas(String factoryId, String moduleCode) {
        return formulaRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode);
    }
}
