package com.cretas.aims.controller;

import com.cretas.aims.dto.ai.AIRuleParseRequest;
import com.cretas.aims.dto.ai.AIRuleParseResponse;
import com.cretas.aims.dto.ai.AIStateMachineParseRequest;
import com.cretas.aims.dto.ai.AIStateMachineParseResponse;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.StateMachineService;
import com.cretas.aims.service.StateMachineService.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

import com.cretas.aims.util.ErrorSanitizer;

/**
 * AI 规则解析控制器
 *
 * 提供 AI 辅助的规则配置功能:
 * - 自然语言转 DRL 规则
 * - 自然语言转状态机配置
 * - AI 生成并保存规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai-rules")
@RequiredArgsConstructor
@Validated
@Tag(name = "AI Rules", description = "AI 辅助规则配置 API")
public class AIRuleController {

    private final RestTemplate restTemplate;
    private final DroolsRuleRepository droolsRuleRepository;
    private final RuleEngineService ruleEngineService;
    private final StateMachineService stateMachineService;

    @Value("${ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    // ==================== AI 规则解析 ====================

    /**
     * AI 解析自然语言生成 DRL 规则
     */
    @PostMapping("/parse-rule")
    @Operation(summary = "AI解析规则", description = "将自然语言描述转换为 Drools DRL 规则")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<AIRuleParseResponse> parseRule(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @RequestBody @Valid AIRuleParseRequest request
    ) {
        log.info("AI解析规则 - factoryId={}, input={}", factoryId, request.getUserInput());

        try {
            // 设置工厂ID
            request.setFactoryId(factoryId);

            // 调用 Python AI 服务
            String url = aiServiceUrl + "/api/ai/rule/parse";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // 转换请求格式 (camelCase -> snake_case)
            Map<String, Object> pythonRequest = new HashMap<>();
            pythonRequest.put("user_input", request.getUserInput());
            pythonRequest.put("rule_group", request.getRuleGroup());
            pythonRequest.put("entity_type", request.getEntityType());
            pythonRequest.put("factory_id", factoryId);
            pythonRequest.put("context", request.getContext());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(pythonRequest, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                AIRuleParseResponse result = AIRuleParseResponse.builder()
                        .success((Boolean) body.get("success"))
                        .ruleName((String) body.get("rule_name"))
                        .ruleDescription((String) body.get("rule_description"))
                        .drlContent((String) body.get("drl_content"))
                        .ruleGroup((String) body.get("rule_group"))
                        .priority(body.get("priority") != null ? ((Number) body.get("priority")).intValue() : 10)
                        .entityTypes((List<String>) body.get("entity_types"))
                        .aiExplanation((String) body.get("ai_explanation"))
                        .suggestions((List<String>) body.get("suggestions"))
                        .message((String) body.get("message"))
                        .build();

                return ApiResponse.success("规则解析成功", result);
            } else {
                return ApiResponse.error("AI服务返回异常");
            }

        } catch (RestClientException e) {
            log.error("调用AI服务失败", e);
            return ApiResponse.error("AI服务不可用: " + ErrorSanitizer.sanitize(e));
        } catch (Exception e) {
            log.error("规则解析失败", e);
            return ApiResponse.error("规则解析失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * AI 解析自然语言并直接保存规则
     */
    @PostMapping("/parse-and-save-rule")
    @Operation(summary = "AI解析并保存规则", description = "将自然语言转换为 DRL 规则并保存到数据库")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<DroolsRule> parseAndSaveRule(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @RequestBody @Valid AIRuleParseRequest request,
            @Parameter(hidden = true) @RequestAttribute("userId") Long userId
    ) {
        log.info("AI解析并保存规则 - factoryId={}, input={}", factoryId, request.getUserInput());

        // 先解析规则
        ApiResponse<AIRuleParseResponse> parseResult = parseRule(factoryId, request);
        if (!parseResult.getSuccess()) {
            return ApiResponse.error(parseResult.getMessage());
        }

        AIRuleParseResponse parsed = parseResult.getData();
        if (parsed == null || !Boolean.TRUE.equals(parsed.getSuccess())) {
            return ApiResponse.error(parsed != null ? parsed.getMessage() : "AI解析失败");
        }

        // 验证生成的 DRL
        if (parsed.getDrlContent() == null || parsed.getDrlContent().isEmpty()) {
            return ApiResponse.error("AI未生成有效的DRL规则");
        }

        Map<String, Object> validation = ruleEngineService.validateDRL(parsed.getDrlContent());
        if (!(Boolean) validation.get("isValid")) {
            return ApiResponse.error("生成的规则语法错误: " + validation.get("errors"));
        }

        // 检查规则名是否已存在
        String ruleGroup = parsed.getRuleGroup() != null ? parsed.getRuleGroup() : "validation";
        String ruleName = parsed.getRuleName() != null ? parsed.getRuleName() : "AI生成规则_" + System.currentTimeMillis();

        if (droolsRuleRepository.existsByFactoryIdAndRuleGroupAndRuleName(factoryId, ruleGroup, ruleName)) {
            ruleName = ruleName + "_" + System.currentTimeMillis();
        }

        // 创建并保存规则
        DroolsRule rule = DroolsRule.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .ruleGroup(ruleGroup)
                .ruleName(ruleName)
                .ruleDescription(parsed.getRuleDescription())
                .ruleContent(parsed.getDrlContent())
                .priority(parsed.getPriority() != null ? parsed.getPriority() : 10)
                .enabled(true)
                .version(1)
                .createdBy(userId)
                .build();

        DroolsRule saved = droolsRuleRepository.save(rule);

        // 重新加载规则
        ruleEngineService.reloadRuleGroup(factoryId, ruleGroup);

        log.info("AI生成规则保存成功 - ruleId={}, ruleName={}", saved.getId(), saved.getRuleName());
        return ApiResponse.success("规则创建成功", saved);
    }

    // ==================== AI 状态机解析 ====================

    /**
     * AI 解析自然语言生成状态机配置
     */
    @PostMapping("/parse-state-machine")
    @Operation(summary = "AI解析状态机", description = "将自然语言描述转换为状态机配置")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<AIStateMachineParseResponse> parseStateMachine(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @RequestBody @Valid AIStateMachineParseRequest request
    ) {
        log.info("AI解析状态机 - factoryId={}, entityType={}, input={}",
                factoryId, request.getEntityType(), request.getUserInput());

        try {
            // 设置工厂ID
            request.setFactoryId(factoryId);

            // 调用 Python AI 服务
            String url = aiServiceUrl + "/api/ai/state-machine/parse";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // 转换请求格式
            Map<String, Object> pythonRequest = new HashMap<>();
            pythonRequest.put("user_input", request.getUserInput());
            pythonRequest.put("entity_type", request.getEntityType());
            pythonRequest.put("factory_id", factoryId);
            pythonRequest.put("context", request.getContext());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(pythonRequest, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                // 解析状态列表
                List<AIStateMachineParseResponse.StateDefinitionDTO> states = new ArrayList<>();
                List<Map<String, Object>> statesList = (List<Map<String, Object>>) body.get("states");
                if (statesList != null) {
                    for (Map<String, Object> s : statesList) {
                        states.add(AIStateMachineParseResponse.StateDefinitionDTO.builder()
                                .code((String) s.get("code"))
                                .name((String) s.get("name"))
                                .description((String) s.get("description"))
                                .color((String) s.get("color"))
                                .isFinal((Boolean) s.get("is_final"))
                                .build());
                    }
                }

                // 解析转换列表
                List<AIStateMachineParseResponse.TransitionDefinitionDTO> transitions = new ArrayList<>();
                List<Map<String, Object>> transitionsList = (List<Map<String, Object>>) body.get("transitions");
                if (transitionsList != null) {
                    for (Map<String, Object> t : transitionsList) {
                        transitions.add(AIStateMachineParseResponse.TransitionDefinitionDTO.builder()
                                .fromState((String) t.get("from_state"))
                                .toState((String) t.get("to_state"))
                                .event((String) t.get("event"))
                                .guard((String) t.get("guard"))
                                .action((String) t.get("action"))
                                .description((String) t.get("description"))
                                .build());
                    }
                }

                AIStateMachineParseResponse result = AIStateMachineParseResponse.builder()
                        .success((Boolean) body.get("success"))
                        .machineName((String) body.get("machine_name"))
                        .machineDescription((String) body.get("machine_description"))
                        .initialState((String) body.get("initial_state"))
                        .states(states)
                        .transitions(transitions)
                        .aiExplanation((String) body.get("ai_explanation"))
                        .suggestions((List<String>) body.get("suggestions"))
                        .message((String) body.get("message"))
                        .build();

                return ApiResponse.success("状态机解析成功", result);
            } else {
                return ApiResponse.error("AI服务返回异常");
            }

        } catch (RestClientException e) {
            log.error("调用AI服务失败", e);
            return ApiResponse.error("AI服务不可用: " + ErrorSanitizer.sanitize(e));
        } catch (Exception e) {
            log.error("状态机解析失败", e);
            return ApiResponse.error("状态机解析失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * AI 解析自然语言并直接保存状态机配置
     */
    @PostMapping("/parse-and-save-state-machine")
    @Operation(summary = "AI解析并保存状态机", description = "将自然语言转换为状态机配置并保存")
    @PreAuthorize("hasAnyAuthority('factory_super_admin', 'department_admin')")
    public ApiResponse<StateMachineConfig> parseAndSaveStateMachine(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId,
            @RequestBody @Valid AIStateMachineParseRequest request,
            @Parameter(hidden = true) @RequestAttribute("userId") Long userId
    ) {
        log.info("AI解析并保存状态机 - factoryId={}, entityType={}",
                factoryId, request.getEntityType());

        // 先解析状态机
        ApiResponse<AIStateMachineParseResponse> parseResult = parseStateMachine(factoryId, request);
        if (!parseResult.getSuccess()) {
            return ApiResponse.error(parseResult.getMessage());
        }

        AIStateMachineParseResponse parsed = parseResult.getData();
        if (parsed == null || !Boolean.TRUE.equals(parsed.getSuccess())) {
            return ApiResponse.error(parsed != null ? parsed.getMessage() : "AI解析失败");
        }

        // 转换为 StateMachineConfig
        StateMachineConfig config = new StateMachineConfig();
        config.setMachineName(parsed.getMachineName());
        config.setMachineDescription(parsed.getMachineDescription());
        config.setInitialState(parsed.getInitialState());
        config.setEnabled(true);

        // 转换状态列表
        List<StateInfo> states = new ArrayList<>();
        if (parsed.getStates() != null) {
            for (AIStateMachineParseResponse.StateDefinitionDTO s : parsed.getStates()) {
                StateInfo state = new StateInfo(s.getCode(), s.getName(), s.getIsFinal());
                state.setDescription(s.getDescription());
                state.setColor(s.getColor());
                states.add(state);
            }
        }
        config.setStates(states);

        // 转换转换列表
        List<TransitionDef> transitions = new ArrayList<>();
        if (parsed.getTransitions() != null) {
            for (AIStateMachineParseResponse.TransitionDefinitionDTO t : parsed.getTransitions()) {
                TransitionDef transition = new TransitionDef(t.getFromState(), t.getToState(), t.getEvent());
                transition.setGuard(t.getGuard());
                transition.setAction(t.getAction());
                transition.setDescription(t.getDescription());
                transitions.add(transition);
            }
        }
        config.setTransitions(transitions);

        // 保存状态机配置
        StateMachineConfig saved = stateMachineService.saveStateMachine(
                factoryId, request.getEntityType(), config, userId);

        log.info("AI生成状态机保存成功 - entityType={}", request.getEntityType());
        return ApiResponse.success("状态机创建成功", saved);
    }

    // ==================== 健康检查 ====================

    /**
     * AI 规则服务健康检查
     */
    @GetMapping("/health")
    @Operation(summary = "AI规则服务健康检查")
    public ApiResponse<Map<String, Object>> healthCheck(
            @Parameter(description = "工厂ID", example = "F001") @PathVariable String factoryId) {
        Map<String, Object> health = new HashMap<>();
        health.put("service", "ai-rules");
        health.put("factoryId", factoryId);

        try {
            String url = aiServiceUrl + "/api/ai/rule/health";
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                health.put("aiService", response.getBody());
                health.put("aiServiceAvailable", true);
            } else {
                health.put("aiServiceAvailable", false);
            }
        } catch (Exception e) {
            health.put("aiServiceAvailable", false);
            health.put("error", ErrorSanitizer.sanitize(e));
        }

        // 添加规则引擎状态
        health.put("ruleEngineStatus", ruleEngineService.getStatistics(factoryId));

        return ApiResponse.success(health);
    }
}
