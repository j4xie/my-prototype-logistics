package com.cretas.aims.service.config.impl;

import com.cretas.aims.dto.config.*;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.*;
import com.cretas.aims.service.config.FactoryConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service("canvasFactoryConfigService")
@RequiredArgsConstructor
public class FactoryConfigServiceImpl implements FactoryConfigService {

    private final ModuleSchemaRepository moduleSchemaRepository;
    private final FactoryConfigurationRepository factoryConfigurationRepository;
    private final FactoryModuleConfigRepository factoryModuleConfigRepository;
    private final ConfigChangeLogRepository configChangeLogRepository;
    private final ObjectMapper objectMapper;

    // ========== 合并配置读取 ==========

    @Override
    public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode, null);
    }

    @Override
    @SuppressWarnings("unchecked")
    public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode) {
        ModuleSchema schema = moduleSchemaRepository.findByModuleCode(moduleCode)
                .orElseThrow(() -> new ResourceNotFoundException("ModuleSchema", "moduleCode", moduleCode));

        // Layer 1: Schema defaults
        Map<String, Object> effectiveFieldConfig = new HashMap<>(
                (Map<String, Object>) schema.getDefaultConfig().getOrDefault("fields", Map.of()));
        Map<String, Object> effectiveWorkflowConfig = new HashMap<>(
                (Map<String, Object>) schema.getDefaultConfig().getOrDefault("workflow", Map.of()));

        // Layer 2: Factory override (if published config exists)
        boolean moduleEnabled = true;
        String renderingMode = "LEGACY";
        Map<String, Object> customLabels = new HashMap<>();

        Optional<FactoryConfiguration> publishedConfig = factoryConfigurationRepository.findLatestPublished(factoryId);
        if (publishedConfig.isPresent()) {
            int version = publishedConfig.get().getConfigVersion();
            Optional<FactoryModuleConfig> moduleConfig = factoryModuleConfigRepository
                    .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, version);

            if (moduleConfig.isPresent()) {
                FactoryModuleConfig fmc = moduleConfig.get();
                moduleEnabled = fmc.getEnabled();
                renderingMode = fmc.getRenderingMode();
                deepMerge(effectiveFieldConfig, fmc.getFieldConfig());
                deepMerge(effectiveWorkflowConfig, fmc.getWorkflowConfig());
                if (fmc.getCustomLabels() != null) {
                    fmc.getCustomLabels().forEach((k, v) -> customLabels.put(k, String.valueOf(v)));
                }
            }
        }

        // Build EffectiveField list from schema.fieldSchema
        List<EffectiveField> fields = buildEffectiveFields(schema.getFieldSchema(), effectiveFieldConfig, customLabels);
        List<FieldGroup> groups = buildFieldGroups(schema.getFieldSchema());

        // Build workflow states and transitions
        List<WorkflowStateDTO> workflowStates = buildWorkflowStates(schema.getWorkflowSchema(), effectiveWorkflowConfig);
        List<WorkflowTransitionDTO> workflowTransitions = buildWorkflowTransitions(schema.getWorkflowSchema(), effectiveWorkflowConfig);
        Map<String, Object> workflowOptions = (Map<String, Object>) effectiveWorkflowConfig.getOrDefault("options", Map.of());

        // Layer 3: Role permission filter (runtime, not persisted)
        if (roleCode != null && schema.getPermissionSchema() != null) {
            applyPermissionFilter(fields, schema.getPermissionSchema(), roleCode);
        }

        return EffectiveModuleConfig.builder()
                .moduleCode(moduleCode)
                .moduleName(schema.getModuleName())
                .enabled(moduleEnabled)
                .fields(fields)
                .groups(groups)
                .workflowStates(workflowStates)
                .workflowTransitions(workflowTransitions)
                .workflowOptions(workflowOptions)
                .customLabels(customLabels.entrySet().stream()
                        .collect(Collectors.toMap(Map.Entry::getKey, e -> String.valueOf(e.getValue()))))
                .renderingMode(renderingMode)
                .build();
    }

    // ========== 字段级查询 ==========

    @Override
    public boolean isFieldVisible(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::isVisible)
                .orElse(false);
    }

    @Override
    public boolean isFieldRequired(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::isRequired)
                .orElse(false);
    }

    @Override
    public Object getFieldDefault(String factoryId, String moduleCode, String fieldCode) {
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode);
        return config.getFields().stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .map(EffectiveField::getDefaultValue)
                .orElse(null);
    }

    // ========== 流程级查询 ==========

    @Override
    public List<WorkflowStateDTO> getWorkflowStates(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowStates();
    }

    @Override
    public List<WorkflowTransitionDTO> getAvailableTransitions(String factoryId, String moduleCode, String currentState) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowTransitions().stream()
                .filter(t -> t.getFrom().equals(currentState) && t.isEnabled())
                .collect(Collectors.toList());
    }

    @Override
    public boolean isTransitionAllowed(String factoryId, String moduleCode, String fromState, String toState) {
        return getEffectiveConfig(factoryId, moduleCode).getWorkflowTransitions().stream()
                .anyMatch(t -> t.getFrom().equals(fromState) && t.getTo().equals(toState) && t.isEnabled());
    }

    // ========== 模块级查询 ==========

    @Override
    public boolean isModuleEnabled(String factoryId, String moduleCode) {
        return getEffectiveConfig(factoryId, moduleCode).isEnabled();
    }

    @Override
    public List<ModuleSummaryDTO> getEnabledModules(String factoryId) {
        List<ModuleSchema> schemas = moduleSchemaRepository.findByIsActiveTrue();
        return schemas.stream()
                .map(s -> {
                    EffectiveModuleConfig config = getEffectiveConfig(factoryId, s.getModuleCode());
                    return ModuleSummaryDTO.builder()
                            .moduleCode(s.getModuleCode())
                            .moduleName(s.getModuleName())
                            .moduleCategory(s.getModuleCategory())
                            .enabled(config.isEnabled())
                            .renderingMode(config.getRenderingMode())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ========== 配置写操作 ==========

    @Override
    @Transactional
    public void saveModuleConfig(String factoryId, String moduleCode, ModuleConfigDTO dto, Long operatorId) {
        moduleSchemaRepository.findByModuleCode(moduleCode)
                .orElseThrow(() -> new ResourceNotFoundException("ModuleSchema", "moduleCode", moduleCode));

        FactoryConfiguration config = getOrCreateDraft(factoryId, operatorId);
        FactoryModuleConfig fmc = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                .orElseGet(() -> {
                    FactoryModuleConfig newFmc = new FactoryModuleConfig();
                    newFmc.setFactoryId(factoryId);
                    newFmc.setModuleCode(moduleCode);
                    newFmc.setConfigVersion(config.getConfigVersion());
                    return newFmc;
                });

        if (dto.getEnabled() != null) fmc.setEnabled(dto.getEnabled());
        if (dto.getFieldConfig() != null) fmc.setFieldConfig(dto.getFieldConfig());
        if (dto.getWorkflowConfig() != null) fmc.setWorkflowConfig(dto.getWorkflowConfig());
        if (dto.getValidationConfig() != null) fmc.setValidationConfig(dto.getValidationConfig());
        if (dto.getPermissionConfig() != null) fmc.setPermissionConfig(dto.getPermissionConfig());
        if (dto.getLayoutConfig() != null) fmc.setLayoutConfig(dto.getLayoutConfig());
        if (dto.getCustomLabels() != null) fmc.setCustomLabels(dto.getCustomLabels());
        if (dto.getRenderingMode() != null) fmc.setRenderingMode(dto.getRenderingMode());

        factoryModuleConfigRepository.save(fmc);

        logChange(factoryId, moduleCode, "UPDATE", null, dto.getFieldConfig(), "模块配置更新", operatorId);
    }

    @Override
    @Transactional
    public void toggleModule(String factoryId, String moduleCode, boolean enabled, Long operatorId) {
        ModuleConfigDTO dto = ModuleConfigDTO.builder().enabled(enabled).build();
        saveModuleConfig(factoryId, moduleCode, dto, operatorId);
    }

    @Override
    @Transactional
    public void updateFieldConfig(String factoryId, String moduleCode, String fieldCode,
                                  FieldConfigDTO fieldConfig, Long operatorId) {
        moduleSchemaRepository.findByModuleCode(moduleCode)
                .orElseThrow(() -> new ResourceNotFoundException("ModuleSchema", "moduleCode", moduleCode));
        FactoryConfiguration config = getOrCreateDraft(factoryId, operatorId);
        FactoryModuleConfig fmc = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                .orElseGet(() -> {
                    FactoryModuleConfig newFmc = new FactoryModuleConfig();
                    newFmc.setFactoryId(factoryId);
                    newFmc.setModuleCode(moduleCode);
                    newFmc.setConfigVersion(config.getConfigVersion());
                    return newFmc;
                });

        Map<String, Object> fieldConfigMap = new HashMap<>(fmc.getFieldConfig());
        @SuppressWarnings("unchecked")
        Map<String, Object> fieldsMap = (Map<String, Object>) fieldConfigMap.computeIfAbsent("fields", k -> new HashMap<>());
        Map<String, Object> fieldOverride = new HashMap<>();
        if (fieldConfig.getVisible() != null) fieldOverride.put("visible", fieldConfig.getVisible());
        if (fieldConfig.getRequired() != null) fieldOverride.put("required", fieldConfig.getRequired());
        if (fieldConfig.getDefaultValue() != null) fieldOverride.put("defaultValue", fieldConfig.getDefaultValue());
        if (fieldConfig.getOptions() != null) fieldOverride.put("options", fieldConfig.getOptions());
        if (fieldConfig.getLabel() != null) fieldOverride.put("label", fieldConfig.getLabel());
        fieldsMap.put(fieldCode, fieldOverride);

        fmc.setFieldConfig(fieldConfigMap);
        factoryModuleConfigRepository.save(fmc);

        logChange(factoryId, moduleCode, "FIELD_UPDATE", null, fieldOverride,
                "字段 " + fieldCode + " 配置更新", operatorId);
    }

    // ========== 发布 ==========

    @Override
    @Transactional
    public void publishConfig(String factoryId, Long operatorId, String changeSummary) {
        FactoryConfiguration draft = factoryConfigurationRepository.findDraft(factoryId)
                .orElseThrow(() -> new BusinessException("没有待发布的草稿配置"));

        // Archive current published
        factoryConfigurationRepository.findLatestPublished(factoryId)
                .ifPresent(published -> {
                    published.setStatus("ARCHIVED");
                    factoryConfigurationRepository.save(published);
                });

        draft.setStatus("PUBLISHED");
        draft.setPublishedAt(LocalDateTime.now());
        draft.setPublishedBy(operatorId);
        draft.setChangeSummary(changeSummary);
        factoryConfigurationRepository.save(draft);

        logChange(factoryId, null, "PUBLISH", null, null,
                "配置版本 " + draft.getConfigVersion() + " 已发布: " + changeSummary, operatorId);

        log.info("工厂 {} 配置版本 {} 已发布", factoryId, draft.getConfigVersion());
    }

    @Override
    @Transactional
    public void rollbackConfig(String factoryId, int targetVersion, Long operatorId) {
        FactoryConfiguration target = factoryConfigurationRepository
                .findByFactoryIdAndConfigVersion(factoryId, targetVersion)
                .orElseThrow(() -> new BusinessException("目标版本不存在: " + targetVersion));

        FactoryConfiguration newDraft = new FactoryConfiguration();
        newDraft.setFactoryId(factoryId);
        newDraft.setTemplateId(target.getTemplateId());
        newDraft.setConfigVersion(getNextVersion(factoryId));
        newDraft.setStatus("DRAFT");
        newDraft.setCreatedBy(operatorId);
        newDraft.setRollbackVersion(targetVersion);
        factoryConfigurationRepository.save(newDraft);

        List<FactoryModuleConfig> targetModules = factoryModuleConfigRepository
                .findByFactoryIdAndConfigVersion(factoryId, targetVersion);
        for (FactoryModuleConfig src : targetModules) {
            FactoryModuleConfig copy = new FactoryModuleConfig();
            copy.setFactoryId(factoryId);
            copy.setModuleCode(src.getModuleCode());
            copy.setConfigVersion(newDraft.getConfigVersion());
            copy.setEnabled(src.getEnabled());
            copy.setFieldConfig(src.getFieldConfig());
            copy.setWorkflowConfig(src.getWorkflowConfig());
            copy.setValidationConfig(src.getValidationConfig());
            copy.setPermissionConfig(src.getPermissionConfig());
            copy.setLayoutConfig(src.getLayoutConfig());
            copy.setCustomLabels(src.getCustomLabels());
            copy.setComputedFields(src.getComputedFields());
            copy.setRenderingMode(src.getRenderingMode());
            factoryModuleConfigRepository.save(copy);
        }

        logChange(factoryId, null, "ROLLBACK", null, null,
                "回滚到版本 " + targetVersion, operatorId);
    }

    // ========== 模板 ==========

    @Override
    @Transactional
    public void applyTemplate(String factoryId, String templateCode, Long operatorId) {
        log.info("applyTemplate: factoryId={}, templateCode={} (Phase 2)", factoryId, templateCode);
        throw new BusinessException("模板系统将在 Phase 2 实现");
    }

    // ========== Private Helpers ==========

    private FactoryConfiguration getOrCreateDraft(String factoryId, Long operatorId) {
        return factoryConfigurationRepository.findDraft(factoryId)
                .orElseGet(() -> {
                    FactoryConfiguration draft = new FactoryConfiguration();
                    draft.setFactoryId(factoryId);
                    draft.setConfigVersion(getNextVersion(factoryId));
                    draft.setStatus("DRAFT");
                    draft.setCreatedBy(operatorId);
                    return factoryConfigurationRepository.save(draft);
                });
    }

    private int getNextVersion(String factoryId) {
        return factoryConfigurationRepository.findByFactoryIdOrderByConfigVersionDesc(factoryId)
                .stream().findFirst()
                .map(c -> c.getConfigVersion() + 1)
                .orElse(1);
    }

    @SuppressWarnings("unchecked")
    private void deepMerge(Map<String, Object> base, Map<String, Object> override) {
        if (override == null) return;
        for (Map.Entry<String, Object> entry : override.entrySet()) {
            String key = entry.getKey();
            Object overrideVal = entry.getValue();
            Object baseVal = base.get(key);

            if (baseVal instanceof Map && overrideVal instanceof Map) {
                deepMerge((Map<String, Object>) baseVal, (Map<String, Object>) overrideVal);
            } else {
                base.put(key, overrideVal);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private List<EffectiveField> buildEffectiveFields(Map<String, Object> fieldSchema,
                                                       Map<String, Object> effectiveFieldConfig,
                                                       Map<String, Object> customLabels) {
        List<Map<String, Object>> schemaDefs = (List<Map<String, Object>>) fieldSchema.getOrDefault("fields", List.of());
        Map<String, Object> fieldOverrides = (Map<String, Object>) effectiveFieldConfig.getOrDefault("fields", Map.of());

        List<EffectiveField> result = new ArrayList<>();
        int order = 0;

        for (Map<String, Object> schemaDef : schemaDefs) {
            String code = (String) schemaDef.get("code");
            Map<String, Object> override = fieldOverrides.containsKey(code)
                    ? (Map<String, Object>) fieldOverrides.get(code)
                    : Map.of();

            boolean visible = getBoolOrDefault(override, "visible",
                    getBoolOrDefault(schemaDef, "defaultVisible", true));
            boolean required = getBoolOrDefault(override, "required",
                    getBoolOrDefault(schemaDef, "required", false));

            String label = customLabels.containsKey(code)
                    ? String.valueOf(customLabels.get(code))
                    : (String) schemaDef.get("label");

            Object defaultValue = override.containsKey("defaultValue")
                    ? override.get("defaultValue")
                    : schemaDef.get("defaultValue");

            List<Map<String, Object>> options = override.containsKey("options")
                    ? (List<Map<String, Object>>) override.get("options")
                    : (List<Map<String, Object>>) schemaDef.get("options");

            Map<String, Object> extra = new HashMap<>();
            if (schemaDef.containsKey("dependsOn")) extra.put("dependsOn", schemaDef.get("dependsOn"));
            if (schemaDef.containsKey("referenceConfig")) extra.put("referenceConfig", schemaDef.get("referenceConfig"));
            if (schemaDef.containsKey("computed")) extra.put("computed", schemaDef.get("computed"));
            if (schemaDef.containsKey("itemSchema")) extra.put("itemSchema", schemaDef.get("itemSchema"));
            if (schemaDef.containsKey("min")) extra.put("min", schemaDef.get("min"));
            if (schemaDef.containsKey("max")) extra.put("max", schemaDef.get("max"));
            if (schemaDef.containsKey("precision")) extra.put("precision", schemaDef.get("precision"));
            if (schemaDef.containsKey("listVisible")) extra.put("listVisible", schemaDef.get("listVisible"));
            if (schemaDef.containsKey("listOrder")) extra.put("listOrder", schemaDef.get("listOrder"));
            if (schemaDef.containsKey("listWidth")) extra.put("listWidth", schemaDef.get("listWidth"));
            if (schemaDef.containsKey("formatter")) extra.put("formatter", schemaDef.get("formatter"));
            if (schemaDef.containsKey("configurable")) extra.put("configurable", schemaDef.get("configurable"));

            result.add(EffectiveField.builder()
                    .code(code)
                    .label(label)
                    .type((String) schemaDef.get("type"))
                    .required(required)
                    .visible(visible)
                    .readonly(getBoolOrDefault(schemaDef, "readonly", false))
                    .defaultValue(defaultValue)
                    .options(options)
                    .group((String) schemaDef.getOrDefault("group", "basic"))
                    .order(order++)
                    .extra(extra)
                    .build());
        }

        return result;
    }

    @SuppressWarnings("unchecked")
    private List<FieldGroup> buildFieldGroups(Map<String, Object> fieldSchema) {
        List<Map<String, Object>> groups = (List<Map<String, Object>>) fieldSchema.getOrDefault("groups", List.of());
        return groups.stream()
                .map(g -> FieldGroup.builder()
                        .code((String) g.get("code"))
                        .label((String) g.get("label"))
                        .order(g.containsKey("order") ? ((Number) g.get("order")).intValue() : 0)
                        .visible(getBoolOrDefault(g, "visible", true))
                        .build())
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<WorkflowStateDTO> buildWorkflowStates(Map<String, Object> workflowSchema,
                                                        Map<String, Object> effectiveWorkflow) {
        if (workflowSchema == null) return List.of();
        List<Map<String, Object>> states = (List<Map<String, Object>>) workflowSchema.getOrDefault("states", List.of());
        Map<String, Object> disabledStates = (Map<String, Object>) effectiveWorkflow.getOrDefault("disabledStates", Map.of());

        return states.stream()
                .map(s -> {
                    String code = (String) s.get("code");
                    boolean enabled = !Boolean.TRUE.equals(disabledStates.get(code));
                    return WorkflowStateDTO.builder()
                            .code(code)
                            .label((String) s.get("label"))
                            .enabled(enabled)
                            .isInitial(getBoolOrDefault(s, "isInitial", false))
                            .isFinal(getBoolOrDefault(s, "isFinal", false))
                            .tagType((String) s.getOrDefault("tagType", ""))
                            .build();
                })
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<WorkflowTransitionDTO> buildWorkflowTransitions(Map<String, Object> workflowSchema,
                                                                   Map<String, Object> effectiveWorkflow) {
        if (workflowSchema == null) return List.of();
        List<Map<String, Object>> transitions = (List<Map<String, Object>>) workflowSchema.getOrDefault("transitions", List.of());
        Map<String, Object> options = (Map<String, Object>) effectiveWorkflow.getOrDefault("options", Map.of());

        return transitions.stream()
                .map(t -> {
                    boolean enabled = true;
                    String condition = (String) t.get("condition");
                    if (condition != null) {
                        enabled = evaluateCondition(condition, options);
                    }
                    return WorkflowTransitionDTO.builder()
                            .from((String) t.get("from"))
                            .to((String) t.get("to"))
                            .action((String) t.get("action"))
                            .label((String) t.getOrDefault("label", (String) t.get("action")))
                            .buttonType((String) t.getOrDefault("buttonType", "primary"))
                            .enabled(enabled)
                            .condition(condition)
                            .allowedRoles(t.containsKey("allowedRoles") ? (List<String>) t.get("allowedRoles") : List.of())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private boolean evaluateCondition(String condition, Map<String, Object> options) {
        if (condition.startsWith("!")) {
            String key = condition.substring(1).replace("config.workflow.", "");
            return !Boolean.TRUE.equals(options.get(key));
        } else {
            String key = condition.replace("config.workflow.", "");
            return Boolean.TRUE.equals(options.get(key));
        }
    }

    @SuppressWarnings("unchecked")
    private void applyPermissionFilter(List<EffectiveField> fields, Map<String, Object> permSchema, String roleCode) {
        List<Map<String, Object>> fieldPerms = (List<Map<String, Object>>) permSchema.getOrDefault("fieldPermissions", List.of());
        Map<String, String> permMap = new HashMap<>();
        for (Map<String, Object> fp : fieldPerms) {
            String fieldCode = (String) fp.get("fieldCode");
            Map<String, String> permissions = (Map<String, String>) fp.get("permissions");
            if (permissions != null && permissions.containsKey(roleCode)) {
                permMap.put(fieldCode, permissions.get(roleCode));
            }
        }

        for (EffectiveField field : fields) {
            String perm = permMap.get(field.getCode());
            if ("hidden".equals(perm)) {
                field.setVisible(false);
            } else if ("view".equals(perm)) {
                field.setReadonly(true);
            }
        }
    }

    private boolean getBoolOrDefault(Map<String, Object> map, String key, boolean defaultValue) {
        Object val = map.get(key);
        if (val instanceof Boolean) return (Boolean) val;
        return defaultValue;
    }

    private void logChange(String factoryId, String moduleCode, String operation,
                           Map<String, Object> before, Map<String, Object> after,
                           String summary, Long operatorId) {
        ConfigChangeLog changeLog = ConfigChangeLog.builder()
                .factoryId(factoryId)
                .moduleCode(moduleCode)
                .operation(operation)
                .beforeValue(before)
                .afterValue(after)
                .diffSummary(summary)
                .operatorId(operatorId)
                .operatorType("USER")
                .build();
        configChangeLogRepository.save(changeLog);
    }
}
