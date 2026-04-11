package com.cretas.aims.service.config.impl;

import com.cretas.aims.dto.config.*;
import com.cretas.aims.engine.DDLExecutor;
import com.cretas.aims.engine.DynamicFieldService;
import com.cretas.aims.entity.auth.UserMenuPermission;
import com.cretas.aims.entity.config.*;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.auth.UserMenuPermissionRepository;
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

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private FactoryTemplateRepository factoryTemplateRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private FactoryToolConfigRepository factoryToolConfigRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private FactoryDefaultValueRepository factoryDefaultValueRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.cretas.aims.ai.tool.ToolRegistry toolRegistry;

    @org.springframework.beans.factory.annotation.Autowired
    private DDLExecutor ddlExecutor;

    @org.springframework.beans.factory.annotation.Autowired
    private DynamicFieldService dynamicFieldService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.cretas.aims.repository.config.CanvasDynamicFieldRepository canvasDynamicFieldRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UserMenuPermissionRepository userMenuPermRepo;

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
        // fieldSchema can be: Map {"fields":[...]} (Phase 1) or List [{...},...] (Phase 2d)
        Map<String, Object> fieldSchemaMap;
        Object rawFieldSchema = schema.getFieldSchema();
        if (rawFieldSchema instanceof Map) {
            fieldSchemaMap = (Map<String, Object>) rawFieldSchema;
        } else if (rawFieldSchema instanceof List) {
            fieldSchemaMap = Map.of("fields", rawFieldSchema);
        } else {
            fieldSchemaMap = Map.of("fields", List.of());
        }
        List<EffectiveField> fields = buildEffectiveFields(fieldSchemaMap, effectiveFieldConfig, customLabels);
        List<FieldGroup> groups = buildFieldGroups(fieldSchemaMap);

        // Layer 2b: Merge Canvas V3 dynamic fields (ALTER TABLE added columns)
        // This was previously only in the 4-param overload but frontend calls the 3-param version
        if (dynamicFieldService != null) {
            List<CanvasDynamicField> dynamicFields = dynamicFieldService.getActiveFields(factoryId, moduleCode);
            if (!dynamicFields.isEmpty()) {
                // Add a "custom" group so the frontend groupedFields computed doesn't filter these out.
                // groupedFields filters by: groups.filter(g => g.visible) then fields.filter(f => f.group === group.code)
                // So fields in a group not in the groups list are invisible.
                boolean hasCustomGroup = groups.stream().anyMatch(g -> "custom".equals(g.getCode()));
                if (!hasCustomGroup) {
                    groups.add(FieldGroup.builder()
                        .code("custom")
                        .label("自定义字段")
                        .order(1000)
                        .visible(true)
                        .build());
                }

                for (CanvasDynamicField df : dynamicFields) {
                    // P0-3 Fix (Round 4): SUB_TABLE was previously skipped, but SchemaFormRenderer
                    // has a sub_table rendering branch that was never reachable. Now we build an
                    // EffectiveField with type="sub_table" and copy columns into extra so the
                    // frontend SubTableEditor can render dynamic child tables (审溯日志/发酵日志).
                    EffectiveField ef = EffectiveField.builder()
                        .code(df.getFieldCode())
                        .label(df.getLabel())
                        .type(df.getFieldType().toLowerCase())
                        .required(false)
                        .visible(true)
                        .readonly(false)
                        .defaultValue(null)
                        .options(df.getConfig().get("options"))
                        .group("custom")
                        .order(1000 + (df.getSortOrder() != null ? df.getSortOrder() : 0))
                        .extra(df.getConfig())
                        .visibleWhen(df.getVisibleWhen())
                        .computedWhen(df.getComputedWhen())
                        .source("dynamic")
                        .build();
                    fields.add(ef);
                }
            }
        }

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

    @Override
    public EffectiveModuleConfig getEffectiveConfig(String factoryId, String moduleCode, String roleCode, String userId) {
        // 3-param version already merges dynamic fields (Layer 2b)
        EffectiveModuleConfig config = getEffectiveConfig(factoryId, moduleCode, roleCode);

        // Apply user-level permission overrides (4-param exclusive)
        if (userId != null && userMenuPermRepo != null) {
            applyUserPermissions(config.getFields(), factoryId, moduleCode, userId);
        }

        return config;
    }

    private void applyUserPermissions(List<EffectiveField> fields, String factoryId, String moduleCode, String userId) {
        List<UserMenuPermission> perms = userMenuPermRepo.findByFactoryIdAndUserId(factoryId, userId);
        for (UserMenuPermission perm : perms) {
            String mc = perm.getMenuCode();
            if (!mc.startsWith(moduleCode + ":")) continue;
            String[] parts = mc.split(":");
            if (parts.length < 3) continue;
            String fieldCode = parts[1];
            String permission = parts[2];

            for (EffectiveField field : fields) {
                if (field.getCode().equals(fieldCode)) {
                    if ("REVOKE".equals(perm.getGrantType().name())) {
                        if ("hidden".equals(permission)) field.setVisible(false);
                        if ("readonly".equals(permission)) field.setReadonly(true);
                    } else {
                        if ("hidden".equals(permission)) field.setVisible(true);
                        if ("readonly".equals(permission)) field.setReadonly(false);
                    }
                }
            }
        }
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

        // Execute pending DDL for dynamic fields and refresh cache
        ddlExecutor.executePendingDDL(factoryId, draft.getConfigVersion());
        dynamicFieldService.refreshCache();

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

        // Round 4 Fix P0-5: disable dynamic fields added after the rollback target version.
        // Without this, v3→v2 rollback leaves v3's fields still ACTIVE → ghost fields in UI.
        // Fields added before version tracking was introduced (activeFromVersion = null) are
        // preserved as baseline.
        if (canvasDynamicFieldRepository != null) {
            List<CanvasDynamicField> allActive = canvasDynamicFieldRepository
                    .findByFactoryIdAndStatusIn(factoryId, java.util.List.of("ACTIVE"));
            int disabled = 0;
            for (CanvasDynamicField df : allActive) {
                Integer fieldVersion = df.getActiveFromVersion();
                if (fieldVersion != null && fieldVersion > targetVersion) {
                    df.setStatus("DISABLED");
                    canvasDynamicFieldRepository.save(df);
                    disabled++;
                }
            }
            if (disabled > 0) {
                log.info("Rollback to v{} disabled {} dynamic fields added in later versions", targetVersion, disabled);
                // Also refresh DynamicFieldService cache
                if (dynamicFieldService != null) {
                    dynamicFieldService.refreshCache();
                }
            }
        }

        logChange(factoryId, null, "ROLLBACK", null, null,
                "回滚到版本 " + targetVersion, operatorId);
    }

    // ========== 模板 ==========

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public void applyTemplate(String factoryId, String templateCode, Long operatorId) {
        if (factoryTemplateRepository == null) {
            throw new BusinessException("模板系统未就绪");
        }
        FactoryTemplate template = factoryTemplateRepository.findByTemplateCodeIgnoreCase(templateCode)
                .orElseThrow(() -> new BusinessException("模板不存在: " + templateCode));

        // 1. Create draft
        FactoryConfiguration config = getOrCreateDraft(factoryId, operatorId);

        // 2. Parse base_config
        Map<String, Object> baseConfig = template.getBaseConfig();
        Map<String, Object> moduleConfigs = (Map<String, Object>) baseConfig.getOrDefault("moduleConfigs", Map.of());
        List<String> enabledModules = (List<String>) moduleConfigs.getOrDefault("enabledModules", List.of());
        List<String> disabledModules = (List<String>) moduleConfigs.getOrDefault("disabledModules", List.of());

        // 3. Enable modules
        for (String moduleCode : enabledModules) {
            if (moduleSchemaRepository.findByModuleCode(moduleCode).isEmpty()) continue;
            FactoryModuleConfig fmc = factoryModuleConfigRepository
                    .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                    .orElseGet(() -> {
                        FactoryModuleConfig c = new FactoryModuleConfig();
                        c.setConfigVersion(config.getConfigVersion());
                        c.setModuleCode(moduleCode);
                        c.setFactoryId(factoryId);
                        return c;
                    });
            fmc.setEnabled(true);
            factoryModuleConfigRepository.save(fmc);
        }

        // 4. Disable modules
        for (String moduleCode : disabledModules) {
            FactoryModuleConfig fmc = factoryModuleConfigRepository
                    .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, config.getConfigVersion())
                    .orElseGet(() -> {
                        FactoryModuleConfig c = new FactoryModuleConfig();
                        c.setConfigVersion(config.getConfigVersion());
                        c.setModuleCode(moduleCode);
                        c.setFactoryId(factoryId);
                        return c;
                    });
            fmc.setEnabled(false);
            factoryModuleConfigRepository.save(fmc);
        }

        // 5. Apply default overrides
        Map<String, Object> overrides = (Map<String, Object>) baseConfig.getOrDefault("defaultOverrides", Map.of());
        Map<String, Map<String, Object>> defaultValues = (Map<String, Map<String, Object>>)
                overrides.getOrDefault("defaultValues", Map.of());

        if (factoryDefaultValueRepository != null) {
            for (var entry : defaultValues.entrySet()) {
                String modCode = entry.getKey();
                for (var fieldEntry : entry.getValue().entrySet()) {
                    FactoryDefaultValue fdv = new FactoryDefaultValue();
                    fdv.setFactoryId(factoryId);
                    fdv.setModuleCode(modCode);
                    fdv.setFieldCode(fieldEntry.getKey());
                    // JSONB column — raw strings like "NORMAL" must be wrapped in a JSON-compatible value.
                    // Simplest: pass as a Map so Hibernate serializes to proper JSON.
                    Object rawVal = fieldEntry.getValue();
                    fdv.setDefaultValue(java.util.Map.of("value", rawVal));
                    fdv.setDescription("模板 " + templateCode);
                    factoryDefaultValueRepository.save(fdv);
                }
            }
        }

        // 6. Apply tool disables
        List<String> disabledToolPatterns = (List<String>) overrides.getOrDefault("disabledTools", List.of());
        if (factoryToolConfigRepository != null && toolRegistry != null && !disabledToolPatterns.isEmpty()) {
            for (String toolName : toolRegistry.getAllToolNames()) {
                boolean shouldDisable = disabledToolPatterns.stream().anyMatch(p ->
                        p.endsWith("*") ? toolName.startsWith(p.substring(0, p.length() - 1)) : toolName.equals(p));
                if (shouldDisable) {
                    FactoryToolConfig ftc = factoryToolConfigRepository.findByFactoryIdAndToolName(factoryId, toolName)
                            .orElseGet(() -> { FactoryToolConfig c = new FactoryToolConfig(); c.setFactoryId(factoryId); c.setToolName(toolName); return c; });
                    ftc.setEnabled(false);
                    factoryToolConfigRepository.save(ftc);
                }
            }
        }

        // 7. Log + update usage count
        logChange(factoryId, null, "TEMPLATE_APPLIED", null, null,
                "应用模板: " + templateCode, operatorId);
        template.setUsageCount(template.getUsageCount() + 1);
        factoryTemplateRepository.save(template);

        log.info("Template {} applied to factory {} — {} enabled, {} disabled",
                templateCode, factoryId, enabledModules.size(), disabledModules.size());
    }

    // ========== Export / Import (Round 4 Fix P1-16) ==========

    @Override
    public Map<String, Object> exportConfig(String factoryId) {
        Map<String, Object> bundle = new HashMap<>();
        bundle.put("factoryId", factoryId);
        bundle.put("exportedAt", LocalDateTime.now().toString());
        bundle.put("version", "1.0");

        // Latest published version metadata
        Optional<FactoryConfiguration> latestPublished =
            factoryConfigurationRepository.findLatestPublished(factoryId);
        latestPublished.ifPresent(v -> bundle.put("sourceVersion", v.getConfigVersion()));

        // Export module configs (enabled modules + their field overrides)
        int exportVersion = latestPublished.map(FactoryConfiguration::getConfigVersion).orElse(1);
        List<FactoryModuleConfig> modules = factoryModuleConfigRepository
            .findByFactoryIdAndConfigVersion(factoryId, exportVersion);
        List<Map<String, Object>> moduleData = new ArrayList<>();
        for (FactoryModuleConfig m : modules) {
            Map<String, Object> mm = new HashMap<>();
            mm.put("moduleCode", m.getModuleCode());
            mm.put("enabled", m.getEnabled());
            mm.put("fieldConfig", m.getFieldConfig());
            mm.put("workflowConfig", m.getWorkflowConfig());
            mm.put("validationConfig", m.getValidationConfig());
            mm.put("permissionConfig", m.getPermissionConfig());
            mm.put("layoutConfig", m.getLayoutConfig());
            mm.put("customLabels", m.getCustomLabels());
            mm.put("renderingMode", m.getRenderingMode());
            moduleData.add(mm);
        }
        bundle.put("modules", moduleData);

        // Export dynamic fields
        if (canvasDynamicFieldRepository != null) {
            List<CanvasDynamicField> fields = canvasDynamicFieldRepository
                .findByFactoryIdAndStatusIn(factoryId, List.of("ACTIVE", "PENDING_DDL"));
            List<Map<String, Object>> fieldData = new ArrayList<>();
            for (CanvasDynamicField f : fields) {
                Map<String, Object> ff = new HashMap<>();
                ff.put("moduleCode", f.getModuleCode());
                ff.put("fieldCode", f.getFieldCode());
                ff.put("fieldType", f.getFieldType());
                ff.put("label", f.getLabel());
                ff.put("config", f.getConfig());
                ff.put("visibleWhen", f.getVisibleWhen());
                ff.put("computedWhen", f.getComputedWhen());
                ff.put("sortOrder", f.getSortOrder());
                fieldData.add(ff);
            }
            bundle.put("dynamicFields", fieldData);
        }

        log.info("Exported config for factory {} — {} modules, {} fields",
            factoryId, moduleData.size(), ((List<?>) bundle.getOrDefault("dynamicFields", List.of())).size());
        return bundle;
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> importConfig(String factoryId, Map<String, Object> bundle, Long operatorId) {
        if (bundle == null || !bundle.containsKey("modules")) {
            throw new BusinessException("Invalid config bundle: missing 'modules' key");
        }

        // Get or create a DRAFT version for this factory
        FactoryConfiguration draft = getOrCreateDraft(factoryId, operatorId);
        int targetVersion = draft.getConfigVersion();

        int modulesImported = 0;
        int fieldsImported = 0;
        List<String> skipped = new ArrayList<>();

        // Import module configs
        List<Map<String, Object>> modules = (List<Map<String, Object>>) bundle.getOrDefault("modules", List.of());
        for (Map<String, Object> mData : modules) {
            String moduleCode = (String) mData.get("moduleCode");
            if (moduleSchemaRepository.findByModuleCode(moduleCode).isEmpty()) {
                skipped.add("module:" + moduleCode + " (schema not found in target)");
                continue;
            }

            FactoryModuleConfig existing = factoryModuleConfigRepository
                .findByFactoryIdAndModuleCodeAndConfigVersion(factoryId, moduleCode, targetVersion)
                .orElseGet(() -> {
                    FactoryModuleConfig c = new FactoryModuleConfig();
                    c.setFactoryId(factoryId);
                    c.setModuleCode(moduleCode);
                    c.setConfigVersion(targetVersion);
                    return c;
                });
            if (mData.containsKey("enabled")) existing.setEnabled((Boolean) mData.get("enabled"));
            if (mData.containsKey("fieldConfig")) existing.setFieldConfig((Map<String, Object>) mData.get("fieldConfig"));
            if (mData.containsKey("workflowConfig")) existing.setWorkflowConfig((Map<String, Object>) mData.get("workflowConfig"));
            if (mData.containsKey("validationConfig")) existing.setValidationConfig((Map<String, Object>) mData.get("validationConfig"));
            if (mData.containsKey("permissionConfig")) existing.setPermissionConfig((Map<String, Object>) mData.get("permissionConfig"));
            if (mData.containsKey("layoutConfig")) existing.setLayoutConfig((Map<String, Object>) mData.get("layoutConfig"));
            if (mData.containsKey("customLabels")) existing.setCustomLabels((Map<String, Object>) mData.get("customLabels"));
            if (mData.containsKey("renderingMode")) existing.setRenderingMode((String) mData.get("renderingMode"));
            factoryModuleConfigRepository.save(existing);
            modulesImported++;
        }

        // Import dynamic fields (as PENDING_DDL for safe re-publish)
        if (canvasDynamicFieldRepository != null && bundle.containsKey("dynamicFields")) {
            List<Map<String, Object>> fields = (List<Map<String, Object>>) bundle.get("dynamicFields");
            for (Map<String, Object> fData : fields) {
                String moduleCode = (String) fData.get("moduleCode");
                String fieldCode = (String) fData.get("fieldCode");
                // Skip if field already exists in target factory
                if (canvasDynamicFieldRepository.findByFactoryIdAndModuleCodeAndFieldCode(
                        factoryId, moduleCode, fieldCode).isPresent()) {
                    skipped.add("field:" + moduleCode + "." + fieldCode + " (already exists)");
                    continue;
                }
                CanvasDynamicField newField = CanvasDynamicField.builder()
                    .factoryId(factoryId)
                    .moduleCode(moduleCode)
                    .fieldCode(fieldCode)
                    .fieldType((String) fData.get("fieldType"))
                    .label((String) fData.get("label"))
                    .config((Map<String, Object>) fData.getOrDefault("config", Map.of()))
                    .visibleWhen((String) fData.get("visibleWhen"))
                    .computedWhen((String) fData.get("computedWhen"))
                    .sortOrder(fData.get("sortOrder") != null ? ((Number) fData.get("sortOrder")).intValue() : 0)
                    .status("PENDING_DDL")
                    .build();
                newField.setColumnName("cf_" + fieldCode);
                canvasDynamicFieldRepository.save(newField);
                fieldsImported++;
            }
        }

        logChange(factoryId, null, "IMPORT", null, null,
                "导入配置 — " + modulesImported + " modules, " + fieldsImported + " fields", operatorId);

        Map<String, Object> result = new HashMap<>();
        result.put("modulesImported", modulesImported);
        result.put("fieldsImported", fieldsImported);
        result.put("skipped", skipped);
        result.put("draftVersion", targetVersion);
        log.info("Imported config to factory {} — {} modules, {} fields, {} skipped",
            factoryId, modulesImported, fieldsImported, skipped.size());
        return result;
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
                    FactoryConfiguration saved = factoryConfigurationRepository.save(draft);

                    // 从上个 published 版本 copy 所有 module configs 到新 draft
                    factoryConfigurationRepository.findLatestPublished(factoryId)
                            .ifPresent(published -> {
                                List<FactoryModuleConfig> prevModules = factoryModuleConfigRepository
                                        .findByFactoryIdAndConfigVersion(factoryId, published.getConfigVersion());
                                for (FactoryModuleConfig src : prevModules) {
                                    FactoryModuleConfig copy = new FactoryModuleConfig();
                                    copy.setFactoryId(factoryId);
                                    copy.setModuleCode(src.getModuleCode());
                                    copy.setConfigVersion(saved.getConfigVersion());
                                    copy.setEnabled(src.getEnabled());
                                    copy.setFieldConfig(new HashMap<>(src.getFieldConfig()));
                                    copy.setWorkflowConfig(new HashMap<>(src.getWorkflowConfig()));
                                    copy.setValidationConfig(new HashMap<>(src.getValidationConfig()));
                                    copy.setPermissionConfig(new HashMap<>(src.getPermissionConfig()));
                                    copy.setLayoutConfig(new HashMap<>(src.getLayoutConfig()));
                                    copy.setCustomLabels(new HashMap<>(src.getCustomLabels()));
                                    copy.setComputedFields(new HashMap<>(src.getComputedFields()));
                                    copy.setRenderingMode(src.getRenderingMode());
                                    factoryModuleConfigRepository.save(copy);
                                }
                                log.info("新 draft v{} 从 published v{} 继承了 {} 个模块配置",
                                        saved.getConfigVersion(), published.getConfigVersion(), prevModules.size());
                            });

                    return saved;
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
            String code = (String) schemaDef.getOrDefault("code", schemaDef.get("fieldCode"));
            if (code == null) continue; // skip malformed field definitions
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
            // P0-2 Fix (Round 4): applyTemplate wraps raw values in Map.of("value", x) for JSONB
            // serialization (see Fix #13). Without unwrapping here, frontend renders [object Object].
            // Unwrap any Map shaped like {"value": x} back to x before sending to frontend.
            if (defaultValue instanceof Map<?, ?> m && m.size() == 1 && m.containsKey("value")) {
                defaultValue = m.get("value");
            }

            Object options = override.containsKey("options")
                    ? override.get("options")
                    : schemaDef.get("options");

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
                    .source("jpa")
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
