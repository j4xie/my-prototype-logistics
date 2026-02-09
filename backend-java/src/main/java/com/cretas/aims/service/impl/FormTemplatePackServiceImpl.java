package com.cretas.aims.service.impl;

import com.cretas.aims.dto.pack.*;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.repository.FormTemplateRepository;
import com.cretas.aims.service.FormTemplatePackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 表单模板包服务实现
 *
 * Sprint 3 任务:
 * - S3-2: 模板包导出
 * - S3-3: 模板包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FormTemplatePackServiceImpl implements FormTemplatePackService {

    private final FormTemplateRepository formTemplateRepository;

    @Override
    public FormTemplatePackDTO exportTemplatePack(ExportTemplatePackRequest request) {
        log.info("导出表单模板包, 工厂: {}, 包名: {}", request.getFactoryId(), request.getPackName());

        String factoryId = request.getFactoryId();
        List<FormTemplate> templates;

        // 获取模板列表
        if (request.getTemplateIds() != null && !request.getTemplateIds().isEmpty()) {
            // 导出指定ID的模板
            templates = formTemplateRepository.findAllById(request.getTemplateIds())
                    .stream()
                    .filter(t -> factoryId.equals(t.getFactoryId()))
                    .filter(t -> t.getDeletedAt() == null)
                    .collect(Collectors.toList());
        } else {
            // 导出工厂所有激活模板
            templates = formTemplateRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);
        }

        // 按实体类型过滤
        if (request.getEntityTypes() != null && !request.getEntityTypes().isEmpty()) {
            Set<String> entityTypeSet = new HashSet<>(request.getEntityTypes());
            templates = templates.stream()
                    .filter(t -> entityTypeSet.contains(t.getEntityType()))
                    .collect(Collectors.toList());
        }

        // 只导出激活的模板
        templates = templates.stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .collect(Collectors.toList());

        // 构建模板包
        String packId = "PACK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        List<FormTemplatePackDTO.FormTemplateItemDTO> templateItems = templates.stream()
                .map(this::convertToTemplateItem)
                .collect(Collectors.toList());

        FormTemplatePackDTO pack = FormTemplatePackDTO.builder()
                .packId(packId)
                .packName(request.getPackName())
                .description(request.getDescription())
                .sourceFactoryId(factoryId)
                .version("1.0.0")
                .industryType(request.getIndustryType())
                .exportedAt(LocalDateTime.now())
                .templates(templateItems)
                .build();

        log.info("成功导出 {} 个表单模板到包 {}", templates.size(), packId);
        return pack;
    }

    @Override
    @Transactional
    public ImportTemplatePackResult importTemplatePack(ImportTemplatePackRequest request) {
        log.info("导入表单模板包, 目标工厂: {}, 包: {}",
                request.getTargetFactoryId(), request.getPack().getPackName());

        return doImport(request, false);
    }

    @Override
    public ImportTemplatePackResult previewImport(ImportTemplatePackRequest request) {
        log.info("预览导入表单模板包, 目标工厂: {}, 包: {}",
                request.getTargetFactoryId(), request.getPack().getPackName());

        request.setPreview(true);
        return doImport(request, true);
    }

    @Override
    public String validatePack(FormTemplatePackDTO pack) {
        if (pack == null) {
            return "模板包不能为空";
        }
        if (pack.getPackId() == null || pack.getPackId().isEmpty()) {
            return "模板包ID不能为空";
        }
        if (pack.getPackName() == null || pack.getPackName().isEmpty()) {
            return "模板包名称不能为空";
        }
        if (pack.getTemplates() == null || pack.getTemplates().isEmpty()) {
            return "模板包内容不能为空";
        }

        // 验证每个模板
        for (FormTemplatePackDTO.FormTemplateItemDTO item : pack.getTemplates()) {
            if (item.getName() == null || item.getName().isEmpty()) {
                return "模板名称不能为空";
            }
            if (item.getEntityType() == null || item.getEntityType().isEmpty()) {
                return "模板实体类型不能为空";
            }
            if (item.getSchemaJson() == null || item.getSchemaJson().isEmpty()) {
                return "模板Schema不能为空";
            }
        }

        return null; // 验证通过
    }

    /**
     * 执行导入
     */
    private ImportTemplatePackResult doImport(ImportTemplatePackRequest request, boolean isPreview) {
        FormTemplatePackDTO pack = request.getPack();
        String targetFactoryId = request.getTargetFactoryId();
        ImportTemplatePackRequest.ConflictStrategy strategy = request.getConflictStrategy();

        // 验证模板包
        String validationError = validatePack(pack);
        if (validationError != null) {
            return ImportTemplatePackResult.builder()
                    .success(false)
                    .isPreview(isPreview)
                    .targetFactoryId(targetFactoryId)
                    .packId(pack.getPackId())
                    .packName(pack.getPackName())
                    .summary("验证失败: " + validationError)
                    .errors(Collections.singletonList(validationError))
                    .build();
        }

        ImportTemplatePackResult result = ImportTemplatePackResult.builder()
                .success(true)
                .isPreview(isPreview)
                .targetFactoryId(targetFactoryId)
                .packId(pack.getPackId())
                .packName(pack.getPackName())
                .importedAt(LocalDateTime.now())
                .importedCount(0)
                .skippedCount(0)
                .overwrittenCount(0)
                .failedCount(0)
                .details(new ArrayList<>())
                .errors(new ArrayList<>())
                .build();

        // 获取目标工厂现有模板 (用于冲突检测)
        Map<String, FormTemplate> existingTemplates = formTemplateRepository
                .findByFactoryIdAndDeletedAtIsNull(targetFactoryId)
                .stream()
                .collect(Collectors.toMap(
                        t -> t.getEntityType() + ":" + t.getName(),
                        t -> t,
                        (a, b) -> a // 如果有重复，保留第一个
                ));

        // 处理每个模板
        for (FormTemplatePackDTO.FormTemplateItemDTO item : pack.getTemplates()) {
            try {
                processTemplateItem(item, targetFactoryId, strategy, existingTemplates,
                        result, request.getImportedBy(), pack.getPackId(), isPreview);
            } catch (Exception e) {
                log.error("导入模板失败: {}", item.getName(), e);
                result.addDetail(ImportTemplatePackResult.ImportItemDetail.builder()
                        .originalId(item.getOriginalId())
                        .name(item.getName())
                        .entityType(item.getEntityType())
                        .status(ImportTemplatePackResult.ImportStatus.FAILED)
                        .note("导入失败: " + e.getMessage())
                        .build());
                result.setFailedCount(result.getFailedCount() + 1);
                result.addError("模板 " + item.getName() + " 导入失败: " + e.getMessage());
            }
        }

        // 生成摘要
        result.setSummary(String.format(
                "%s导入模板包 '%s' 到工厂 %s。导入: %d, 跳过: %d, 覆盖: %d, 失败: %d",
                isPreview ? "[预览] " : "",
                pack.getPackName(),
                targetFactoryId,
                result.getImportedCount(),
                result.getSkippedCount(),
                result.getOverwrittenCount(),
                result.getFailedCount()
        ));

        result.setSuccess(result.getFailedCount() == 0);

        return result;
    }

    /**
     * 处理单个模板项
     */
    private void processTemplateItem(
            FormTemplatePackDTO.FormTemplateItemDTO item,
            String targetFactoryId,
            ImportTemplatePackRequest.ConflictStrategy strategy,
            Map<String, FormTemplate> existingTemplates,
            ImportTemplatePackResult result,
            Long importedBy,
            String packId,
            boolean isPreview
    ) {
        String key = item.getEntityType() + ":" + item.getName();
        FormTemplate existing = existingTemplates.get(key);

        ImportTemplatePackResult.ImportItemDetail detail = ImportTemplatePackResult.ImportItemDetail.builder()
                .originalId(item.getOriginalId())
                .name(item.getName())
                .entityType(item.getEntityType())
                .build();

        if (existing != null) {
            // 存在冲突
            switch (strategy) {
                case SKIP:
                    detail.setStatus(ImportTemplatePackResult.ImportStatus.SKIPPED);
                    detail.setNote("已存在同名同类型模板，已跳过");
                    result.setSkippedCount(result.getSkippedCount() + 1);
                    break;

                case OVERWRITE:
                    if (!isPreview) {
                        updateExistingTemplate(existing, item, importedBy, packId);
                        formTemplateRepository.save(existing);
                    }
                    detail.setStatus(ImportTemplatePackResult.ImportStatus.OVERWRITTEN);
                    detail.setNewTemplateId(existing.getId());
                    detail.setNote("已覆盖现有模板");
                    result.setOverwrittenCount(result.getOverwrittenCount() + 1);
                    break;

                case RENAME:
                    String newName = generateUniqueName(item.getName(), existingTemplates.keySet(), item.getEntityType());
                    if (!isPreview) {
                        FormTemplate newTemplate = createNewTemplate(item, targetFactoryId, importedBy, packId);
                        newTemplate.setName(newName);
                        FormTemplate saved = formTemplateRepository.save(newTemplate);
                        detail.setNewTemplateId(saved.getId());
                    }
                    detail.setStatus(ImportTemplatePackResult.ImportStatus.IMPORTED);
                    detail.setNote("已重命名为: " + newName);
                    result.setImportedCount(result.getImportedCount() + 1);
                    break;
            }
        } else {
            // 无冲突，直接导入
            if (!isPreview) {
                FormTemplate newTemplate = createNewTemplate(item, targetFactoryId, importedBy, packId);
                FormTemplate saved = formTemplateRepository.save(newTemplate);
                detail.setNewTemplateId(saved.getId());
            }
            detail.setStatus(ImportTemplatePackResult.ImportStatus.IMPORTED);
            detail.setNote("成功导入");
            result.setImportedCount(result.getImportedCount() + 1);
        }

        result.addDetail(detail);
    }

    /**
     * 转换为模板项DTO
     */
    private FormTemplatePackDTO.FormTemplateItemDTO convertToTemplateItem(FormTemplate template) {
        return FormTemplatePackDTO.FormTemplateItemDTO.builder()
                .originalId(template.getId())
                .name(template.getName())
                .entityType(template.getEntityType())
                .schemaJson(template.getSchemaJson())
                .uiSchemaJson(template.getUiSchemaJson())
                .description(template.getDescription())
                .version(template.getVersion())
                .build();
    }

    /**
     * 创建新模板
     */
    private FormTemplate createNewTemplate(
            FormTemplatePackDTO.FormTemplateItemDTO item,
            String targetFactoryId,
            Long importedBy,
            String packId
    ) {
        return FormTemplate.builder()
                .factoryId(targetFactoryId)
                .name(item.getName())
                .entityType(item.getEntityType())
                .schemaJson(item.getSchemaJson())
                .uiSchemaJson(item.getUiSchemaJson())
                .description(item.getDescription())
                .version(1)
                .isActive(true)
                .createdBy(importedBy)
                .source("IMPORT")
                .sourcePackageId(packId)
                .build();
    }

    /**
     * 更新现有模板
     */
    private void updateExistingTemplate(
            FormTemplate existing,
            FormTemplatePackDTO.FormTemplateItemDTO item,
            Long importedBy,
            String packId
    ) {
        existing.setSchemaJson(item.getSchemaJson());
        existing.setUiSchemaJson(item.getUiSchemaJson());
        existing.setDescription(item.getDescription());
        existing.incrementVersion();
        existing.setSource("IMPORT");
        existing.setSourcePackageId(packId);
    }

    /**
     * 生成唯一名称
     */
    private String generateUniqueName(String originalName, Set<String> existingKeys, String entityType) {
        int suffix = 2;
        String newName = originalName + " (导入)";
        String key = entityType + ":" + newName;

        while (existingKeys.contains(key)) {
            newName = originalName + " (导入" + suffix + ")";
            key = entityType + ":" + newName;
            suffix++;
        }

        return newName;
    }
}
