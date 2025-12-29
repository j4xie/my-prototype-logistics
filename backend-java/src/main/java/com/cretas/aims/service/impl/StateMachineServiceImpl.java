package com.cretas.aims.service.impl;

import com.cretas.aims.entity.rules.StateMachine;
import com.cretas.aims.repository.StateMachineRepository;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.StateMachineService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 状态机服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StateMachineServiceImpl implements StateMachineService {

    private final StateMachineRepository stateMachineRepository;
    private final RuleEngineService ruleEngineService;
    private final ObjectMapper objectMapper;

    // ==================== 状态机配置管理 ====================

    @Override
    public Optional<StateMachineConfig> getStateMachine(String factoryId, String entityType) {
        return stateMachineRepository.findByFactoryIdAndEntityTypeAndEnabledTrue(factoryId, entityType)
                .map(this::convertToConfig);
    }

    @Override
    @Transactional
    public StateMachineConfig saveStateMachine(String factoryId, String entityType,
                                               StateMachineConfig config, Long userId) {
        log.info("保存状态机配置 - factoryId={}, entityType={}", factoryId, entityType);

        StateMachine entity = stateMachineRepository.findByFactoryIdAndEntityType(factoryId, entityType)
                .orElse(new StateMachine());

        // 设置基本信息
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID().toString());
            entity.setVersion(1);
            entity.setCreatedBy(userId);
        } else {
            entity.setVersion(entity.getVersion() + 1);
        }

        entity.setFactoryId(factoryId);
        entity.setEntityType(entityType);
        entity.setMachineName(config.getMachineName());
        entity.setMachineDescription(config.getMachineDescription());
        entity.setInitialState(config.getInitialState());
        entity.setEnabled(config.getEnabled() != null ? config.getEnabled() : true);

        // 序列化状态和转换
        try {
            entity.setStatesJson(objectMapper.writeValueAsString(config.getStates()));
            entity.setTransitionsJson(objectMapper.writeValueAsString(config.getTransitions()));
        } catch (JsonProcessingException e) {
            log.error("序列化状态机配置失败", e);
            throw new RuntimeException("状态机配置序列化失败: " + e.getMessage(), e);
        }

        StateMachine saved = stateMachineRepository.save(entity);
        log.info("状态机配置保存成功 - id={}, version={}", saved.getId(), saved.getVersion());

        return convertToConfig(saved);
    }

    @Override
    @Transactional
    public void deleteStateMachine(String factoryId, String entityType) {
        log.info("删除状态机配置 - factoryId={}, entityType={}", factoryId, entityType);
        stateMachineRepository.findByFactoryIdAndEntityType(factoryId, entityType)
                .ifPresent(sm -> {
                    sm.softDelete();
                    stateMachineRepository.save(sm);
                });
    }

    @Override
    public List<StateMachineConfig> getAllStateMachines(String factoryId) {
        return stateMachineRepository.findByFactoryIdAndEnabledTrue(factoryId).stream()
                .map(this::convertToConfig)
                .collect(Collectors.toList());
    }

    // ==================== 状态转换 ====================

    @Override
    public List<TransitionInfo> getAvailableTransitions(String factoryId, String entityType,
                                                         String currentState, Object entity) {
        Optional<StateMachineConfig> configOpt = getStateMachine(factoryId, entityType);
        if (configOpt.isEmpty()) {
            log.warn("未找到状态机配置 - factoryId={}, entityType={}", factoryId, entityType);
            return Collections.emptyList();
        }

        StateMachineConfig config = configOpt.get();
        List<TransitionInfo> availableTransitions = new ArrayList<>();

        // 找出所有从当前状态出发的转换
        for (TransitionDef transition : config.getTransitions()) {
            if (transition.getFrom().equals(currentState)) {
                TransitionInfo info = new TransitionInfo();
                info.setFrom(transition.getFrom());
                info.setTo(transition.getTo());
                info.setEvent(transition.getEvent());
                info.setDescription(transition.getDescription());

                // 查找目标状态名称
                config.getStates().stream()
                        .filter(s -> s.getCode().equals(transition.getTo()))
                        .findFirst()
                        .ifPresent(s -> info.setToName(s.getName()));

                // 评估守卫条件
                if (transition.getGuard() != null && !transition.getGuard().isEmpty()) {
                    try {
                        Boolean guardResult = evaluateGuard(factoryId, transition.getGuard(), entity);
                        info.setGuardPassed(guardResult);
                        if (!guardResult) {
                            info.setGuardFailReason("守卫条件不满足: " + transition.getGuard());
                        }
                    } catch (Exception e) {
                        log.warn("守卫条件评估失败: {}", e.getMessage());
                        info.setGuardPassed(false);
                        info.setGuardFailReason("守卫条件评估失败: " + e.getMessage());
                    }
                } else {
                    info.setGuardPassed(true);
                }

                availableTransitions.add(info);
            }
        }

        return availableTransitions;
    }

    @Override
    public TransitionValidation validateTransition(String factoryId, String entityType,
                                                   String currentState, String targetState, Object entity) {
        Optional<StateMachineConfig> configOpt = getStateMachine(factoryId, entityType);
        if (configOpt.isEmpty()) {
            return new TransitionValidation(false, "未找到状态机配置");
        }

        StateMachineConfig config = configOpt.get();

        // 查找转换定义
        Optional<TransitionDef> transitionOpt = config.getTransitions().stream()
                .filter(t -> t.getFrom().equals(currentState) && t.getTo().equals(targetState))
                .findFirst();

        if (transitionOpt.isEmpty()) {
            return new TransitionValidation(false,
                    "不允许从 " + currentState + " 转换到 " + targetState);
        }

        TransitionDef transition = transitionOpt.get();

        // 评估守卫条件
        if (transition.getGuard() != null && !transition.getGuard().isEmpty()) {
            try {
                Boolean guardResult = evaluateGuard(factoryId, transition.getGuard(), entity);
                if (!guardResult) {
                    return new TransitionValidation(false, "守卫条件不满足: " + transition.getGuard());
                }
            } catch (Exception e) {
                return new TransitionValidation(false, "守卫条件评估失败: " + e.getMessage());
            }
        }

        return new TransitionValidation(true, "验证通过");
    }

    @Override
    @Transactional
    public TransitionResult executeTransition(String factoryId, String entityType,
                                              String entityId, String currentState, String targetState,
                                              Object entity, Long userId) {
        log.info("执行状态转换 - entityType={}, entityId={}, {} -> {}",
                entityType, entityId, currentState, targetState);

        // 先验证
        TransitionValidation validation = validateTransition(factoryId, entityType,
                currentState, targetState, entity);
        if (!validation.getIsValid()) {
            return new TransitionResult(false, currentState, currentState, validation.getMessage());
        }

        // 获取转换定义
        StateMachineConfig config = getStateMachine(factoryId, entityType).orElse(null);
        if (config == null) {
            return new TransitionResult(false, currentState, currentState, "状态机配置不存在");
        }

        Optional<TransitionDef> transitionOpt = config.getTransitions().stream()
                .filter(t -> t.getFrom().equals(currentState) && t.getTo().equals(targetState))
                .findFirst();

        if (transitionOpt.isEmpty()) {
            return new TransitionResult(false, currentState, currentState, "转换定义不存在");
        }

        TransitionDef transition = transitionOpt.get();

        // 执行动作 (如果有)
        Map<String, Object> actionResults = new HashMap<>();
        if (transition.getAction() != null && !transition.getAction().isEmpty()) {
            try {
                Object result = executeAction(factoryId, transition.getAction(), entity);
                actionResults.put(transition.getAction(), result);
            } catch (Exception e) {
                log.error("执行动作失败 - action={}", transition.getAction(), e);
                // 动作失败不阻止状态转换，但记录错误
                actionResults.put(transition.getAction() + "_error", e.getMessage());
            }
        }

        // 触发 onTransition 规则
        try {
            ruleEngineService.executeRules(factoryId, "onTransition:" + entityType, entity);
        } catch (Exception e) {
            log.warn("触发 onTransition 规则失败", e);
        }

        TransitionResult result = new TransitionResult(true, currentState, targetState, "状态转换成功");
        result.setActionResults(actionResults);

        log.info("状态转换完成 - entityId={}, {} -> {}", entityId, currentState, targetState);
        return result;
    }

    @Override
    @Transactional
    public TransitionResult executeTransitionByEvent(String factoryId, String entityType,
                                                     String entityId, String currentState, String eventName,
                                                     Object entity, Long userId) {
        log.info("通过事件执行状态转换 - entityType={}, entityId={}, currentState={}, event={}",
                entityType, entityId, currentState, eventName);

        Optional<StateMachineConfig> configOpt = getStateMachine(factoryId, entityType);
        if (configOpt.isEmpty()) {
            return new TransitionResult(false, currentState, currentState, "状态机配置不存在");
        }

        // 查找匹配的转换
        Optional<TransitionDef> transitionOpt = configOpt.get().getTransitions().stream()
                .filter(t -> t.getFrom().equals(currentState) && eventName.equals(t.getEvent()))
                .findFirst();

        if (transitionOpt.isEmpty()) {
            return new TransitionResult(false, currentState, currentState,
                    "当前状态 " + currentState + " 不支持事件 " + eventName);
        }

        return executeTransition(factoryId, entityType, entityId, currentState,
                transitionOpt.get().getTo(), entity, userId);
    }

    // ==================== 状态查询 ====================

    @Override
    public String getInitialState(String factoryId, String entityType) {
        return getStateMachine(factoryId, entityType)
                .map(StateMachineConfig::getInitialState)
                .orElse(null);
    }

    @Override
    public List<StateInfo> getAllStates(String factoryId, String entityType) {
        return getStateMachine(factoryId, entityType)
                .map(StateMachineConfig::getStates)
                .orElse(Collections.emptyList());
    }

    @Override
    public boolean isFinalState(String factoryId, String entityType, String state) {
        return getStateMachine(factoryId, entityType)
                .map(config -> config.getStates().stream()
                        .anyMatch(s -> s.getCode().equals(state) && Boolean.TRUE.equals(s.getIsFinal())))
                .orElse(false);
    }

    // ==================== 私有方法 ====================

    /**
     * 将数据库实体转换为配置对象
     */
    private StateMachineConfig convertToConfig(StateMachine entity) {
        StateMachineConfig config = new StateMachineConfig();
        config.setId(entity.getId());
        config.setFactoryId(entity.getFactoryId());
        config.setEntityType(entity.getEntityType());
        config.setMachineName(entity.getMachineName());
        config.setMachineDescription(entity.getMachineDescription());
        config.setInitialState(entity.getInitialState());
        config.setVersion(entity.getVersion());
        config.setEnabled(entity.getEnabled());

        // 反序列化状态和转换
        try {
            if (entity.getStatesJson() != null) {
                config.setStates(objectMapper.readValue(entity.getStatesJson(),
                        new TypeReference<List<StateInfo>>() {}));
            } else {
                config.setStates(Collections.emptyList());
            }

            if (entity.getTransitionsJson() != null) {
                config.setTransitions(objectMapper.readValue(entity.getTransitionsJson(),
                        new TypeReference<List<TransitionDef>>() {}));
            } else {
                config.setTransitions(Collections.emptyList());
            }
        } catch (JsonProcessingException e) {
            log.error("反序列化状态机配置失败", e);
            config.setStates(Collections.emptyList());
            config.setTransitions(Collections.emptyList());
        }

        return config;
    }

    /**
     * 评估守卫条件
     * 简单实现：通过规则引擎评估
     */
    private Boolean evaluateGuard(String factoryId, String guardExpression, Object entity) {
        // 简单实现：将守卫条件作为规则执行
        // 完整实现可以使用 MVEL 或 SpEL 评估表达式
        log.debug("评估守卫条件: {}", guardExpression);

        // 对于简单条件，直接返回 true
        // TODO: 实现完整的表达式评估
        return true;
    }

    /**
     * 执行动作
     */
    private Object executeAction(String factoryId, String actionName, Object entity) {
        log.debug("执行动作: {}", actionName);

        // 通过规则引擎执行动作规则
        return ruleEngineService.executeRules(factoryId, "action:" + actionName, entity);
    }
}
