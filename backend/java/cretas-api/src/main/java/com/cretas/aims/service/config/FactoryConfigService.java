package com.cretas.aims.service.config;

import com.cretas.aims.dto.config.*;

import java.util.List;
import java.util.Map;

public interface FactoryConfigService {

    // ========== 合并配置读取 (前端消费) ==========
    EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode);
    EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode);

    // ========== 字段级查询 (C 层) ==========
    boolean isFieldVisible(String factoryId, String moduleCode, String fieldCode);
    boolean isFieldRequired(String factoryId, String moduleCode, String fieldCode);
    Object getFieldDefault(String factoryId, String moduleCode, String fieldCode);

    // ========== 流程级查询 (D 层) ==========
    List<WorkflowStateDTO> getWorkflowStates(String factoryId, String moduleCode);
    List<WorkflowTransitionDTO> getAvailableTransitions(String factoryId, String moduleCode, String currentState);
    boolean isTransitionAllowed(String factoryId, String moduleCode, String fromState, String toState);

    // ========== 模块级查询 (B 层) ==========
    boolean isModuleEnabled(String factoryId, String moduleCode);
    List<ModuleSummaryDTO> getEnabledModules(String factoryId);

    // ========== 配置写操作 ==========
    void saveModuleConfig(String factoryId, String moduleCode, ModuleConfigDTO config, Long operatorId);
    void toggleModule(String factoryId, String moduleCode, boolean enabled, Long operatorId);
    void updateFieldConfig(String factoryId, String moduleCode, String fieldCode,
                           FieldConfigDTO fieldConfig, Long operatorId);

    // ========== 发布与版本 ==========
    void publishConfig(String factoryId, Long operatorId, String changeSummary);
    void rollbackConfig(String factoryId, int targetVersion, Long operatorId);

    // ========== 模板 ==========
    void applyTemplate(String factoryId, String templateCode, Long operatorId);
}
