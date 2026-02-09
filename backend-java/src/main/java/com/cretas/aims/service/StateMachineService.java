package com.cretas.aims.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 状态机服务接口
 *
 * 提供:
 * - 状态机配置管理
 * - 状态转换验证
 * - 状态转换执行
 * - 状态历史记录
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
public interface StateMachineService {

    // ==================== 状态机配置管理 ====================

    /**
     * 获取实体类型的状态机配置
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 状态机配置 (如果存在)
     */
    Optional<StateMachineConfig> getStateMachine(String factoryId, String entityType);

    /**
     * 创建或更新状态机配置
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param config 状态机配置
     * @param userId 操作用户ID
     * @return 保存后的配置
     */
    StateMachineConfig saveStateMachine(String factoryId, String entityType,
                                        StateMachineConfig config, Long userId);

    /**
     * 删除状态机配置
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     */
    void deleteStateMachine(String factoryId, String entityType);

    /**
     * 获取工厂所有状态机配置
     *
     * @param factoryId 工厂ID
     * @return 状态机配置列表
     */
    List<StateMachineConfig> getAllStateMachines(String factoryId);

    // ==================== 状态转换 ====================

    /**
     * 获取当前状态可用的转换
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param currentState 当前状态
     * @param entity 实体对象 (用于评估守卫条件)
     * @return 可用转换列表
     */
    List<TransitionInfo> getAvailableTransitions(String factoryId, String entityType,
                                                  String currentState, Object entity);

    /**
     * 验证状态转换是否允许
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param currentState 当前状态
     * @param targetState 目标状态
     * @param entity 实体对象
     * @return 验证结果
     */
    TransitionValidation validateTransition(String factoryId, String entityType,
                                            String currentState, String targetState, Object entity);

    /**
     * 执行状态转换
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param entityId 实体ID
     * @param currentState 当前状态
     * @param targetState 目标状态
     * @param entity 实体对象
     * @param userId 操作用户ID
     * @return 转换结果
     */
    TransitionResult executeTransition(String factoryId, String entityType,
                                       String entityId, String currentState, String targetState,
                                       Object entity, Long userId);

    /**
     * 执行状态转换 (通过事件名)
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param entityId 实体ID
     * @param currentState 当前状态
     * @param eventName 触发事件名
     * @param entity 实体对象
     * @param userId 操作用户ID
     * @return 转换结果
     */
    TransitionResult executeTransitionByEvent(String factoryId, String entityType,
                                              String entityId, String currentState, String eventName,
                                              Object entity, Long userId);

    // ==================== 状态查询 ====================

    /**
     * 获取初始状态
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 初始状态
     */
    String getInitialState(String factoryId, String entityType);

    /**
     * 获取所有状态定义
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @return 状态定义列表
     */
    List<StateInfo> getAllStates(String factoryId, String entityType);

    /**
     * 检查是否为最终状态
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param state 状态
     * @return 是否为最终状态
     */
    boolean isFinalState(String factoryId, String entityType, String state);

    // ==================== 内部类型定义 ====================

    /**
     * 状态机配置
     */
    class StateMachineConfig {
        private String id;
        private String factoryId;
        private String entityType;
        private String machineName;
        private String machineDescription;
        private String initialState;
        private List<StateInfo> states;
        private List<TransitionDef> transitions;
        private Integer version;
        private Boolean enabled;

        // Getters and Setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getFactoryId() { return factoryId; }
        public void setFactoryId(String factoryId) { this.factoryId = factoryId; }
        public String getEntityType() { return entityType; }
        public void setEntityType(String entityType) { this.entityType = entityType; }
        public String getMachineName() { return machineName; }
        public void setMachineName(String machineName) { this.machineName = machineName; }
        public String getMachineDescription() { return machineDescription; }
        public void setMachineDescription(String machineDescription) { this.machineDescription = machineDescription; }
        public String getInitialState() { return initialState; }
        public void setInitialState(String initialState) { this.initialState = initialState; }
        public List<StateInfo> getStates() { return states; }
        public void setStates(List<StateInfo> states) { this.states = states; }
        public List<TransitionDef> getTransitions() { return transitions; }
        public void setTransitions(List<TransitionDef> transitions) { this.transitions = transitions; }
        public Integer getVersion() { return version; }
        public void setVersion(Integer version) { this.version = version; }
        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    }

    /**
     * 状态定义
     */
    class StateInfo {
        private String code;
        private String name;
        private String description;
        private String color;
        private Boolean isFinal;

        public StateInfo() {}

        public StateInfo(String code, String name, Boolean isFinal) {
            this.code = code;
            this.name = name;
            this.isFinal = isFinal;
        }

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
        public Boolean getIsFinal() { return isFinal; }
        public void setIsFinal(Boolean isFinal) { this.isFinal = isFinal; }
    }

    /**
     * 转换定义
     */
    class TransitionDef {
        private String from;
        private String to;
        private String event;
        private String guard;      // 守卫条件表达式
        private String action;     // 动作名称
        private String description;

        public TransitionDef() {}

        public TransitionDef(String from, String to, String event) {
            this.from = from;
            this.to = to;
            this.event = event;
        }

        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }
        public String getEvent() { return event; }
        public void setEvent(String event) { this.event = event; }
        public String getGuard() { return guard; }
        public void setGuard(String guard) { this.guard = guard; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    /**
     * 可用转换信息 (包含评估结果)
     */
    class TransitionInfo {
        private String from;
        private String to;
        private String toName;
        private String event;
        private String description;
        private Boolean guardPassed;
        private String guardFailReason;

        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
        public String getTo() { return to; }
        public void setTo(String to) { this.to = to; }
        public String getToName() { return toName; }
        public void setToName(String toName) { this.toName = toName; }
        public String getEvent() { return event; }
        public void setEvent(String event) { this.event = event; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public Boolean getGuardPassed() { return guardPassed; }
        public void setGuardPassed(Boolean guardPassed) { this.guardPassed = guardPassed; }
        public String getGuardFailReason() { return guardFailReason; }
        public void setGuardFailReason(String guardFailReason) { this.guardFailReason = guardFailReason; }
    }

    /**
     * 转换验证结果
     */
    class TransitionValidation {
        private Boolean isValid;
        private String message;
        private List<String> errors;

        public TransitionValidation(Boolean isValid, String message) {
            this.isValid = isValid;
            this.message = message;
        }

        public Boolean getIsValid() { return isValid; }
        public void setIsValid(Boolean isValid) { this.isValid = isValid; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
    }

    /**
     * 转换执行结果
     */
    class TransitionResult {
        private Boolean success;
        private String previousState;
        private String newState;
        private String message;
        private Map<String, Object> actionResults;

        public TransitionResult(Boolean success, String previousState, String newState, String message) {
            this.success = success;
            this.previousState = previousState;
            this.newState = newState;
            this.message = message;
        }

        public Boolean getSuccess() { return success; }
        public void setSuccess(Boolean success) { this.success = success; }
        public String getPreviousState() { return previousState; }
        public void setPreviousState(String previousState) { this.previousState = previousState; }
        public String getNewState() { return newState; }
        public void setNewState(String newState) { this.newState = newState; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public Map<String, Object> getActionResults() { return actionResults; }
        public void setActionResults(Map<String, Object> actionResults) { this.actionResults = actionResults; }
    }
}
