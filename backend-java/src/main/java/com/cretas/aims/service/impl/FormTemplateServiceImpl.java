package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.entity.config.FormTemplateVersion;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.FormTemplateRepository;
import com.cretas.aims.repository.FormTemplateVersionRepository;
import com.cretas.aims.service.FormTemplateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 表单模板服务实现
 *
 * 提供:
 * - 表单模板 CRUD
 * - Schema 查询和合并
 * - AI 生成模板创建
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Service
public class FormTemplateServiceImpl implements FormTemplateService {

    private static final Logger log = LoggerFactory.getLogger(FormTemplateServiceImpl.class);

    /**
     * 支持的实体类型列表
     * 与前端 Formily Schema 文件对应
     */
    private static final List<String> SUPPORTED_ENTITY_TYPES = Arrays.asList(
            "QUALITY_CHECK",        // 质检表单
            "MATERIAL_BATCH",       // 原料批次表单
            "PROCESSING_BATCH",     // 生产批次表单
            "SHIPMENT",             // 出货表单
            "EQUIPMENT",            // 设备表单
            "DISPOSAL_RECORD"       // 报废处理表单
    );

    private final FormTemplateRepository formTemplateRepository;
    private final FormTemplateVersionRepository versionRepository;

    public FormTemplateServiceImpl(
            FormTemplateRepository formTemplateRepository,
            FormTemplateVersionRepository versionRepository) {
        this.formTemplateRepository = formTemplateRepository;
        this.versionRepository = versionRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FormTemplate> getByFactoryAndEntityType(String factoryId, String entityType) {
        log.debug("查询表单模板: factoryId={}, entityType={}", factoryId, entityType);
        return formTemplateRepository.findActiveByFactoryIdAndEntityType(factoryId, entityType);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> getSchemaJson(String factoryId, String entityType) {
        log.debug("查询 Schema JSON: factoryId={}, entityType={}", factoryId, entityType);
        return getByFactoryAndEntityType(factoryId, entityType)
                .map(FormTemplate::getSchemaJson);
    }

    @Override
    @Transactional
    public FormTemplate create(String factoryId, String entityType, String name,
                               String schemaJson, Long userId) {
        log.info("创建表单模板: factoryId={}, entityType={}, name={}", factoryId, entityType, name);

        // 验证实体类型
        validateEntityType(entityType);

        // 验证 Schema JSON 格式
        validateSchemaJson(schemaJson);

        // 检查是否已存在同类型模板
        if (formTemplateRepository.existsByFactoryIdAndEntityTypeAndIsActiveTrue(factoryId, entityType)) {
            throw new BusinessException("该工厂已存在此类型的表单模板: " + entityType);
        }

        // 创建模板
        FormTemplate template = FormTemplate.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .entityType(entityType)
                .name(name)
                .schemaJson(schemaJson)
                .version(1)
                .isActive(true)
                .createdBy(userId)
                .source("MANUAL")
                .build();

        template = formTemplateRepository.save(template);
        log.info("表单模板创建成功: id={}", template.getId());

        return template;
    }

    @Override
    @Transactional
    public FormTemplate createOrUpdate(String factoryId, String entityType, String name,
                                        String schemaJson, Long userId) {
        log.info("创建或更新表单模板: factoryId={}, entityType={}", factoryId, entityType);

        // 验证
        validateEntityType(entityType);
        validateSchemaJson(schemaJson);

        // 查找现有模板
        Optional<FormTemplate> existingOpt = formTemplateRepository
                .findActiveByFactoryIdAndEntityType(factoryId, entityType);

        if (existingOpt.isPresent()) {
            // 更新现有模板
            FormTemplate existing = existingOpt.get();
            existing.setName(name);
            existing.setSchemaJson(schemaJson);
            existing.incrementVersion();
            log.info("更新现有模板: id={}, version={}", existing.getId(), existing.getVersion());
            return formTemplateRepository.save(existing);
        } else {
            // 创建新模板
            return create(factoryId, entityType, name, schemaJson, userId);
        }
    }

    @Override
    @Transactional
    public FormTemplate createFromAI(String factoryId, String entityType, String name,
                                      String schemaJson, String description, Long userId) {
        log.info("AI 创建表单模板: factoryId={}, entityType={}, name={}", factoryId, entityType, name);

        // 验证
        validateEntityType(entityType);
        validateSchemaJson(schemaJson);

        // 查找并禁用现有模板（如果存在）
        Optional<FormTemplate> existingOpt = formTemplateRepository
                .findActiveByFactoryIdAndEntityType(factoryId, entityType);
        if (existingOpt.isPresent()) {
            FormTemplate existing = existingOpt.get();
            existing.setIsActive(false);
            formTemplateRepository.save(existing);
            log.info("禁用旧模板: id={}", existing.getId());
        }

        // 创建新模板
        FormTemplate template = FormTemplate.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .entityType(entityType)
                .name(name)
                .schemaJson(schemaJson)
                .description(description)
                .version(1)
                .isActive(true)
                .createdBy(userId)
                .source("AI_ASSISTANT")
                .build();

        template = formTemplateRepository.save(template);
        log.info("AI 模板创建成功: id={}, source=AI_ASSISTANT", template.getId());

        return template;
    }

    @Override
    @Transactional
    public FormTemplate update(String id, String name, String schemaJson, String uiSchemaJson) {
        log.info("更新表单模板: id={}", id);

        FormTemplate template = formTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("表单模板不存在: " + id));

        if (name != null && !name.isEmpty()) {
            template.setName(name);
        }
        if (schemaJson != null && !schemaJson.isEmpty()) {
            validateSchemaJson(schemaJson);
            template.setSchemaJson(schemaJson);
        }
        if (uiSchemaJson != null) {
            template.setUiSchemaJson(uiSchemaJson);
        }

        template.incrementVersion();
        template = formTemplateRepository.save(template);

        log.info("表单模板更新成功: id={}, version={}", template.getId(), template.getVersion());
        return template;
    }

    @Override
    @Transactional
    public FormTemplate setActive(String id, boolean active) {
        log.info("设置模板状态: id={}, active={}", id, active);

        FormTemplate template = formTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("表单模板不存在: " + id));

        template.setIsActive(active);
        template = formTemplateRepository.save(template);

        log.info("模板状态更新成功: id={}, isActive={}", template.getId(), template.getIsActive());
        return template;
    }

    @Override
    @Transactional
    public void delete(String id) {
        log.info("删除表单模板: id={}", id);

        FormTemplate template = formTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("表单模板不存在: " + id));

        // 软删除（BaseEntity 的 @SQLDelete 会处理）
        formTemplateRepository.delete(template);

        log.info("表单模板删除成功: id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<FormTemplate> getById(String id) {
        return formTemplateRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<FormTemplate> getByFactoryId(String factoryId, Pageable pageable) {
        return formTemplateRepository.findByFactoryIdAndIsActiveTrue(factoryId, pageable);
    }

    @Override
    public List<String> getSupportedEntityTypes() {
        return new ArrayList<>(SUPPORTED_ENTITY_TYPES);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getStatistics(String factoryId) {
        log.debug("获取模板统计: factoryId={}", factoryId);

        long totalCount = formTemplateRepository.countByFactoryIdAndIsActiveTrue(factoryId);
        long aiGeneratedCount = formTemplateRepository.countAIGeneratedByFactoryId(factoryId);

        // 获取已配置的实体类型
        List<String> configuredTypes = new ArrayList<>();
        for (String entityType : SUPPORTED_ENTITY_TYPES) {
            if (formTemplateRepository.existsByFactoryIdAndEntityTypeAndIsActiveTrue(factoryId, entityType)) {
                configuredTypes.add(entityType);
            }
        }

        Map<String, Object> statistics = new HashMap<>();
        statistics.put("totalCount", totalCount);
        statistics.put("aiGeneratedCount", aiGeneratedCount);
        statistics.put("manualCount", totalCount - aiGeneratedCount);
        statistics.put("configuredEntityTypes", configuredTypes);
        statistics.put("supportedEntityTypes", SUPPORTED_ENTITY_TYPES);
        statistics.put("coverageRate", SUPPORTED_ENTITY_TYPES.size() > 0
                ? (double) configuredTypes.size() / SUPPORTED_ENTITY_TYPES.size()
                : 0.0);

        return statistics;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasCustomTemplate(String factoryId, String entityType) {
        return formTemplateRepository.existsByFactoryIdAndEntityTypeAndIsActiveTrue(factoryId, entityType);
    }

    @Override
    @Transactional
    public FormTemplate rollbackToVersion(String templateId, Integer version, String reason, Long userId) {
        log.info("回滚模板到版本: templateId={}, version={}, reason={}", templateId, version, reason);

        // 获取当前模板
        FormTemplate currentTemplate = formTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("模板不存在: " + templateId));

        // 获取目标版本
        FormTemplateVersion targetVersion = versionRepository.findByTemplateIdAndVersion(templateId, version)
                .orElseThrow(() -> new ResourceNotFoundException("目标版本不存在: " + version));

        // 保存当前版本到历史（回滚前的备份）
        String changeSummary = reason != null ? reason : "回滚到版本 " + version;
        FormTemplateVersion backup = FormTemplateVersion.fromTemplate(currentTemplate, "回滚前备份: " + changeSummary);
        versionRepository.save(backup);

        // 执行回滚
        currentTemplate.setName(targetVersion.getName());
        currentTemplate.setSchemaJson(targetVersion.getSchemaJson());
        currentTemplate.setUiSchemaJson(targetVersion.getUiSchemaJson());
        currentTemplate.setDescription(targetVersion.getDescription());
        currentTemplate.incrementVersion();

        FormTemplate saved = formTemplateRepository.save(currentTemplate);

        // 记录回滚后的新版本
        FormTemplateVersion newVersion = FormTemplateVersion.fromTemplate(saved, "从版本 " + version + " 回滚");
        versionRepository.save(newVersion);

        log.info("模板回滚成功: id={}, fromVersion={}, toVersion={}, newVersion={}",
                templateId, backup.getVersion(), version, saved.getVersion());

        return saved;
    }

    /**
     * 验证实体类型是否支持
     */
    private void validateEntityType(String entityType) {
        if (entityType == null || entityType.isEmpty()) {
            throw new BusinessException("实体类型不能为空");
        }
        if (!SUPPORTED_ENTITY_TYPES.contains(entityType)) {
            throw new BusinessException("不支持的实体类型: " + entityType +
                    ", 支持的类型: " + String.join(", ", SUPPORTED_ENTITY_TYPES));
        }
    }

    /**
     * 验证 Schema JSON 格式
     * 基本验证：必须是有效的 JSON 对象，且包含 type 和 properties
     */
    private void validateSchemaJson(String schemaJson) {
        if (schemaJson == null || schemaJson.isEmpty()) {
            throw new BusinessException("Schema JSON 不能为空");
        }

        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper =
                    new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(schemaJson);

            // 检查必须是对象
            if (!root.isObject()) {
                throw new BusinessException("Schema JSON 必须是对象格式");
            }

            // 检查必须有 type 字段
            if (!root.has("type")) {
                throw new BusinessException("Schema JSON 必须包含 'type' 字段");
            }

            // 检查 type 必须是 'object'
            String type = root.get("type").asText();
            if (!"object".equals(type)) {
                throw new BusinessException("Schema JSON 的 type 必须是 'object'");
            }

            // 检查必须有 properties 字段
            if (!root.has("properties")) {
                throw new BusinessException("Schema JSON 必须包含 'properties' 字段");
            }

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new BusinessException("Schema JSON 格式无效: " + e.getMessage());
        }
    }
}
