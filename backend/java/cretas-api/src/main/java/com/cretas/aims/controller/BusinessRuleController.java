package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.engine.DynamicSchedulerService;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.repository.config.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2")
@RequiredArgsConstructor
@Tag(name = "Canvas V2 Business Rules", description = "校验规则/默认值/公式/定时任务")
public class BusinessRuleController {

    private final FactoryValidationRuleRepository validationRuleRepo;
    private final FactoryDefaultValueRepository defaultValueRepo;
    private final FactoryFormulaRepository formulaRepo;
    private final FactorySchedulerConfigRepository schedulerRepo;
    private final DynamicSchedulerService dynamicSchedulerService;

    @GetMapping("/validation-rules")
    @Operation(summary = "获取工厂校验规则列表")
    public ApiResponse<List<FactoryValidationRule>> getValidationRules(
            @PathVariable String factoryId, @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) {
            return ApiResponse.success(validationRuleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        }
        return ApiResponse.success(validationRuleRepo.findAllForFactory(factoryId));
    }

    @PutMapping("/validation-rules/{ruleCode}")
    @Operation(summary = "配置校验规则")
    public ApiResponse<FactoryValidationRule> setValidationRule(
            @PathVariable String factoryId, @PathVariable String ruleCode,
            @RequestBody FactoryValidationRule body) {
        FactoryValidationRule rule = validationRuleRepo.findByFactoryIdAndModuleCode(factoryId, body.getModuleCode())
                .stream().filter(r -> r.getRuleCode().equals(ruleCode)).findFirst()
                .orElseGet(() -> {
                    FactoryValidationRule r = new FactoryValidationRule();
                    r.setFactoryId(factoryId); r.setRuleCode(ruleCode);
                    r.setModuleCode(body.getModuleCode());
                    r.setCondition(body.getCondition() != null ? body.getCondition() : "true");
                    r.setErrorMessage(body.getErrorMessage() != null ? body.getErrorMessage() : ruleCode);
                    return r;
                });
        if (body.getEnabled() != null) rule.setEnabled(body.getEnabled());
        if (body.getSeverity() != null) rule.setSeverity(body.getSeverity());
        if (body.getErrorMessage() != null) rule.setErrorMessage(body.getErrorMessage());
        if (body.getCondition() != null) rule.setCondition(body.getCondition());
        if (body.getOperation() != null) rule.setOperation(body.getOperation());
        return ApiResponse.success(validationRuleRepo.save(rule));
    }

    @GetMapping("/default-values")
    @Operation(summary = "获取工厂默认值列表")
    public ApiResponse<List<FactoryDefaultValue>> getDefaultValues(
            @PathVariable String factoryId, @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) return ApiResponse.success(defaultValueRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        return ApiResponse.success(defaultValueRepo.findAllForFactory(factoryId));
    }

    @PutMapping("/default-values")
    @Operation(summary = "设置默认值")
    public ApiResponse<FactoryDefaultValue> setDefaultValue(@PathVariable String factoryId, @RequestBody FactoryDefaultValue body) {
        body.setFactoryId(factoryId);
        return ApiResponse.success(defaultValueRepo.save(body));
    }

    @GetMapping("/formulas")
    @Operation(summary = "获取工厂公式列表")
    public ApiResponse<List<FactoryFormula>> getFormulas(
            @PathVariable String factoryId, @RequestParam(required = false) String moduleCode) {
        if (moduleCode != null) return ApiResponse.success(formulaRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode));
        return ApiResponse.success(formulaRepo.findByFactoryIdAndModuleCode(factoryId, null));
    }

    @PutMapping("/formulas/{formulaCode}")
    @Operation(summary = "配置公式")
    public ApiResponse<FactoryFormula> setFormula(
            @PathVariable String factoryId, @PathVariable String formulaCode, @RequestBody FactoryFormula body) {
        FactoryFormula formula = formulaRepo.findByFactoryIdAndModuleCodeAndFormulaCode(factoryId, body.getModuleCode(), formulaCode)
                .orElseGet(() -> { FactoryFormula f = new FactoryFormula(); f.setFactoryId(factoryId); f.setFormulaCode(formulaCode); f.setModuleCode(body.getModuleCode()); return f; });
        if (body.getExpression() != null) formula.setExpression(body.getExpression());
        if (body.getVariables() != null) formula.setVariables(body.getVariables());
        if (body.getResultType() != null) formula.setResultType(body.getResultType());
        if (body.getPrecisionVal() != null) formula.setPrecisionVal(body.getPrecisionVal());
        return ApiResponse.success(formulaRepo.save(formula));
    }

    @GetMapping("/scheduler")
    @Operation(summary = "获取工厂定时任务列表")
    public ApiResponse<List<FactorySchedulerConfig>> getSchedulerConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(schedulerRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/scheduler/{taskCode}")
    @Operation(summary = "配置定时任务 (热更新)")
    public ApiResponse<FactorySchedulerConfig> setSchedulerConfig(
            @PathVariable String factoryId, @PathVariable String taskCode, @RequestBody FactorySchedulerConfig body) {
        FactorySchedulerConfig config = schedulerRepo.findByFactoryIdAndTaskCode(factoryId, taskCode)
                .orElseGet(() -> { FactorySchedulerConfig c = new FactorySchedulerConfig(); c.setFactoryId(factoryId); c.setTaskCode(taskCode); c.setCronExpression("0 0 2 * * ?"); return c; });
        if (body.getCronExpression() != null) config.setCronExpression(body.getCronExpression());
        if (body.getEnabled() != null) config.setEnabled(body.getEnabled());
        if (body.getToolOrMethod() != null) config.setToolOrMethod(body.getToolOrMethod());
        if (body.getParams() != null) config.setParams(body.getParams());
        FactorySchedulerConfig saved = schedulerRepo.save(config);
        dynamicSchedulerService.reloadSchedule(factoryId, taskCode);
        return ApiResponse.success(saved);
    }
}
