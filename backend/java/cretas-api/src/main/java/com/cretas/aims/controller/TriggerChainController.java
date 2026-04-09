package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.repository.config.*;
import com.cretas.aims.service.config.FactoryConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2")
@RequiredArgsConstructor
@Tag(name = "Canvas V2 Config", description = "Tool/Skill/TriggerChain/Template 工厂级配置")
public class TriggerChainController {

    private final FactoryToolConfigRepository toolConfigRepo;
    private final FactorySkillConfigRepository skillConfigRepo;
    private final FactoryTriggerChainRepository triggerChainRepo;

    @Autowired(required = false)
    private FactoryTemplateRepository templateRepo;

    @Autowired(required = false)
    @Qualifier("canvasFactoryConfigService")
    private FactoryConfigService configService;

    // ========== Tool Config ==========

    @GetMapping("/tools")
    @Operation(summary = "获取工厂 Tool 配置列表")
    public ApiResponse<List<FactoryToolConfig>> getToolConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(toolConfigRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/tools/{toolName}")
    @Operation(summary = "设置 Tool 开关/参数覆盖")
    public ApiResponse<FactoryToolConfig> setToolConfig(
            @PathVariable String factoryId, @PathVariable String toolName,
            @RequestBody Map<String, Object> body) {
        FactoryToolConfig config = toolConfigRepo.findByFactoryIdAndToolName(factoryId, toolName)
                .orElseGet(() -> {
                    FactoryToolConfig c = new FactoryToolConfig();
                    c.setFactoryId(factoryId);
                    c.setToolName(toolName);
                    return c;
                });
        if (body.containsKey("enabled")) config.setEnabled((Boolean) body.get("enabled"));
        if (body.containsKey("paramOverrides")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> overrides = (Map<String, Object>) body.get("paramOverrides");
            config.setParamOverrides(overrides);
        }
        return ApiResponse.success(toolConfigRepo.save(config));
    }

    // ========== Skill Config ==========

    @GetMapping("/skills")
    @Operation(summary = "获取工厂 Skill 配置列表")
    public ApiResponse<List<FactorySkillConfig>> getSkillConfigs(@PathVariable String factoryId) {
        return ApiResponse.success(skillConfigRepo.findByFactoryId(factoryId));
    }

    @PutMapping("/skills/{skillName}")
    @Operation(summary = "设置 Skill 开关/自定义 DAG")
    public ApiResponse<FactorySkillConfig> setSkillConfig(
            @PathVariable String factoryId, @PathVariable String skillName,
            @RequestBody Map<String, Object> body) {
        FactorySkillConfig config = skillConfigRepo.findByFactoryIdAndSkillName(factoryId, skillName)
                .orElseGet(() -> {
                    FactorySkillConfig c = new FactorySkillConfig();
                    c.setFactoryId(factoryId);
                    c.setSkillName(skillName);
                    return c;
                });
        if (body.containsKey("enabled")) config.setEnabled((Boolean) body.get("enabled"));
        if (body.containsKey("customDag")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> dag = (Map<String, Object>) body.get("customDag");
            config.setCustomDag(dag);
        }
        return ApiResponse.success(skillConfigRepo.save(config));
    }

    // ========== Trigger Chains ==========

    @GetMapping("/trigger-chains")
    @Operation(summary = "获取工厂触发链列表")
    public ApiResponse<List<FactoryTriggerChain>> getTriggerChains(@PathVariable String factoryId) {
        List<FactoryTriggerChain> chains = triggerChainRepo.findByFactoryId(factoryId);
        if (chains.isEmpty()) {
            chains = triggerChainRepo.findByFactoryId(null);
        }
        return ApiResponse.success(chains);
    }

    @PutMapping("/trigger-chains/{chainCode}")
    @Operation(summary = "配置触发链步骤")
    public ApiResponse<FactoryTriggerChain> setTriggerChain(
            @PathVariable String factoryId, @PathVariable String chainCode,
            @RequestBody FactoryTriggerChain body) {
        FactoryTriggerChain chain = triggerChainRepo.findByFactoryIdAndChainCode(factoryId, chainCode)
                .orElseGet(() -> {
                    FactoryTriggerChain global = triggerChainRepo.findByFactoryIdAndChainCode(null, chainCode)
                            .orElse(null);
                    FactoryTriggerChain c = new FactoryTriggerChain();
                    c.setFactoryId(factoryId);
                    c.setChainCode(chainCode);
                    if (global != null) {
                        c.setEventType(global.getEventType());
                        c.setSteps(global.getSteps());
                        c.setErrorStrategy(global.getErrorStrategy());
                        c.setDescription(global.getDescription());
                    }
                    return c;
                });
        if (body.getEnabled() != null) chain.setEnabled(body.getEnabled());
        if (body.getSteps() != null) chain.setSteps(body.getSteps());
        if (body.getErrorStrategy() != null) chain.setErrorStrategy(body.getErrorStrategy());
        if (body.getEventType() != null) chain.setEventType(body.getEventType());
        if (body.getDescription() != null) chain.setDescription(body.getDescription());
        return ApiResponse.success(triggerChainRepo.save(chain));
    }

    // ========== Templates ==========

    @GetMapping("/templates")
    @Operation(summary = "获取行业模板列表")
    public ApiResponse<List<FactoryTemplate>> getTemplates(@PathVariable String factoryId) {
        if (templateRepo == null) return ApiResponse.success(List.of());
        return ApiResponse.success(templateRepo.findByIsActiveTrue());
    }

    @PostMapping("/apply-template/{templateCode}")
    @Operation(summary = "应用行业模板到工厂")
    public ApiResponse<String> applyTemplate(
            @PathVariable String factoryId, @PathVariable String templateCode) {
        if (configService == null) throw new com.cretas.aims.exception.BusinessException("配置服务未就绪");
        configService.applyTemplate(factoryId, templateCode, 0L);
        return ApiResponse.success("模板 " + templateCode + " 已应用到工厂 " + factoryId);
    }
}
