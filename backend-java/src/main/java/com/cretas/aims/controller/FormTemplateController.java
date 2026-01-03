package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.entity.config.FormTemplateVersion;
import com.cretas.aims.repository.FormTemplateVersionRepository;
import com.cretas.aims.service.FormTemplateService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 表单模板控制器
 *
 * 提供:
 * - 表单模板 CRUD API
 * - Schema 查询接口 (供前端获取自定义Schema)
 * - AI 生成模板接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/form-templates")
@Tag(name = "表单模板管理", description = "动态表单模板配置相关接口，包括表单模板的创建、查询、更新、删除，按实体类型获取Schema，Schema JSON轻量查询，模板启用/禁用切换，支持的实体类型列表，模板使用统计，版本管理（历史查看、版本详情、版本回滚、版本差异比较）等功能")
public class FormTemplateController {

    private final FormTemplateService formTemplateService;
    private final MobileService mobileService;
    private final FormTemplateVersionRepository versionRepository;

    public FormTemplateController(
            FormTemplateService formTemplateService,
            MobileService mobileService,
            FormTemplateVersionRepository versionRepository) {
        this.formTemplateService = formTemplateService;
        this.mobileService = mobileService;
        this.versionRepository = versionRepository;
    }

    /**
     * 获取指定实体类型的 Schema JSON
     * 前端加载表单时调用此接口获取自定义 Schema
     */
    @GetMapping("/{entityType}")
    @Operation(summary = "获取实体类型的表单模板", description = "根据实体类型获取工厂的自定义表单模板，前端用于与默认Schema合并。如果无自定义模板则返回空，前端使用内置默认Schema")
    public ApiResponse<Map<String, Object>> getByEntityType(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "实体类型: MATERIAL_BATCH/QUALITY_CHECK/PRODUCTION_BATCH等", example = "QUALITY_CHECK") String entityType) {

        log.debug("获取表单模板: factoryId={}, entityType={}", factoryId, entityType);

        Optional<FormTemplate> templateOpt = formTemplateService.getByFactoryAndEntityType(factoryId, entityType);

        if (templateOpt.isEmpty()) {
            // 返回空结果表示无自定义模板，前端使用默认 Schema
            return ApiResponse.success("无自定义模板", null);
        }

        FormTemplate template = templateOpt.get();
        Map<String, Object> result = new HashMap<>();
        result.put("id", template.getId());
        result.put("entityType", template.getEntityType());
        result.put("name", template.getName());
        result.put("schemaJson", template.getSchemaJson());
        result.put("uiSchemaJson", template.getUiSchemaJson());
        result.put("version", template.getVersion());
        result.put("source", template.getSource());

        return ApiResponse.success(result);
    }

    /**
     * 仅获取 Schema JSON 字符串
     * 轻量接口，仅返回 schema_json 内容
     */
    @GetMapping("/{entityType}/schema")
    @Operation(summary = "仅获取Schema JSON", description = "轻量级接口，仅返回该实体类型的schema_json原始内容，适合前端直接解析使用。如无自定义模板则返回空对象{}")
    public ResponseEntity<String> getSchemaJson(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "实体类型: MATERIAL_BATCH/QUALITY_CHECK/PRODUCTION_BATCH等", example = "MATERIAL_BATCH") String entityType) {

        log.debug("获取 Schema JSON: factoryId={}, entityType={}", factoryId, entityType);

        Optional<String> schemaOpt = formTemplateService.getSchemaJson(factoryId, entityType);

        if (schemaOpt.isEmpty()) {
            return ResponseEntity.ok("{}");
        }

        return ResponseEntity
                .ok()
                .header("Content-Type", "application/json")
                .body(schemaOpt.get());
    }

    /**
     * 分页获取工厂的所有表单模板
     */
    @GetMapping
    @Operation(summary = "分页获取表单模板列表", description = "获取工厂的所有表单模板列表，支持分页，按创建时间倒序排列")
    public ApiResponse<Map<String, Object>> getTemplateList(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页数量", example = "10") int size) {

        log.debug("获取模板列表: factoryId={}, page={}, size={}", factoryId, page, size);

        PageRequest pageable = PageRequest.of(
                Math.max(0, page - 1),
                size,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<FormTemplate> templatePage = formTemplateService.getByFactoryId(factoryId, pageable);

        Map<String, Object> result = new HashMap<>();
        result.put("content", templatePage.getContent());
        result.put("page", page);
        result.put("size", size);
        result.put("totalElements", templatePage.getTotalElements());
        result.put("totalPages", templatePage.getTotalPages());

        return ApiResponse.success(result);
    }

    /**
     * 创建表单模板
     */
    @PostMapping
    @Operation(summary = "创建表单模板", description = "为指定实体类型创建新的表单模板，包含Schema JSON定义。同一工厂同一实体类型只能有一个活跃模板")
    public ApiResponse<FormTemplate> createTemplate(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestHeader("Authorization") @Parameter(description = "Bearer Token") String authorization,
            @Valid @RequestBody @Parameter(description = "模板创建请求，包含实体类型、名称、Schema JSON") CreateTemplateRequest request) {

        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("创建表单模板: factoryId={}, entityType={}, name={}",
                factoryId, request.getEntityType(), request.getName());

        FormTemplate template = formTemplateService.create(
                factoryId,
                request.getEntityType(),
                request.getName(),
                request.getSchemaJson(),
                userId
        );

        return ApiResponse.success("表单模板创建成功", template);
    }

    /**
     * 创建或更新表单模板
     * 如果同类型模板已存在则更新，否则创建
     */
    @PutMapping("/{entityType}")
    @Operation(summary = "创建或更新表单模板", description = "如果该实体类型的模板已存在则更新，否则创建新模板。更新时会自动创建版本记录")
    public ApiResponse<FormTemplate> createOrUpdateTemplate(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "实体类型: MATERIAL_BATCH/QUALITY_CHECK/PRODUCTION_BATCH等", example = "QUALITY_CHECK") String entityType,
            @RequestHeader("Authorization") @Parameter(description = "Bearer Token") String authorization,
            @Valid @RequestBody @Parameter(description = "模板更新请求，包含名称、Schema JSON、UI Schema JSON") UpdateTemplateRequest request) {

        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("创建或更新表单模板: factoryId={}, entityType={}", factoryId, entityType);

        FormTemplate template = formTemplateService.createOrUpdate(
                factoryId,
                entityType,
                request.getName(),
                request.getSchemaJson(),
                userId
        );

        return ApiResponse.success("表单模板保存成功", template);
    }

    /**
     * 更新模板
     */
    @PutMapping("/id/{id}")
    @Operation(summary = "更新表单模板", description = "根据模板ID更新表单模板内容，包括名称、Schema JSON和UI Schema JSON")
    public ApiResponse<FormTemplate> updateTemplate(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @Valid @RequestBody @Parameter(description = "模板更新请求") UpdateTemplateRequest request) {

        log.info("更新表单模板: id={}", id);

        FormTemplate template = formTemplateService.update(
                id,
                request.getName(),
                request.getSchemaJson(),
                request.getUiSchemaJson()
        );

        return ApiResponse.success("表单模板更新成功", template);
    }

    /**
     * 启用/禁用模板
     */
    @PatchMapping("/id/{id}/active")
    @Operation(summary = "启用/禁用模板", description = "切换表单模板的启用状态。禁用后前端将使用内置默认Schema")
    public ApiResponse<FormTemplate> toggleActive(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @RequestParam @Parameter(description = "是否启用：true-启用，false-禁用", example = "true") boolean active) {

        log.info("切换模板状态: id={}, active={}", id, active);

        FormTemplate template = formTemplateService.setActive(id, active);

        return ApiResponse.success(
                active ? "模板已启用" : "模板已禁用",
                template
        );
    }

    /**
     * 删除模板
     */
    @DeleteMapping("/id/{id}")
    @Operation(summary = "删除表单模板", description = "永久删除指定的表单模板及其所有版本记录，删除后无法恢复")
    public ApiResponse<Void> deleteTemplate(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id) {

        log.info("删除表单模板: id={}", id);

        formTemplateService.delete(id);

        return ApiResponse.success("表单模板删除成功", null);
    }

    /**
     * 获取支持的实体类型列表
     */
    @GetMapping("/entity-types")
    @Operation(summary = "获取支持的实体类型", description = "获取系统支持自定义表单的所有实体类型列表，如MATERIAL_BATCH、QUALITY_CHECK、PRODUCTION_BATCH等")
    public ApiResponse<List<String>> getSupportedEntityTypes(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        List<String> entityTypes = formTemplateService.getSupportedEntityTypes();
        return ApiResponse.success(entityTypes);
    }

    /**
     * 获取模板统计信息
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取模板统计信息", description = "获取工厂表单模板的使用统计，包括总模板数、各类型模板数、启用/禁用数量等")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.debug("获取模板统计: factoryId={}", factoryId);

        Map<String, Object> statistics = formTemplateService.getStatistics(factoryId);
        return ApiResponse.success(statistics);
    }

    /**
     * 检查是否有自定义模板
     */
    @GetMapping("/{entityType}/exists")
    @Operation(summary = "检查是否存在自定义模板", description = "检查指定实体类型是否已配置自定义表单模板，用于前端判断是否需要请求自定义Schema")
    public ApiResponse<Boolean> checkExists(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "实体类型", example = "QUALITY_CHECK") String entityType) {

        boolean exists = formTemplateService.hasCustomTemplate(factoryId, entityType);
        return ApiResponse.success(exists);
    }

    // ============ Version Management APIs ============

    /**
     * 获取模板的版本历史
     */
    @GetMapping("/id/{id}/versions")
    @Operation(summary = "获取版本历史", description = "获取模板的所有历史版本列表，按版本号倒序排列，包含每个版本的变更摘要和创建者信息")
    public ApiResponse<List<VersionDTO>> getVersionHistory(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id) {

        log.debug("获取版本历史: templateId={}", id);

        try {
            List<FormTemplateVersion> versions = versionRepository
                    .findByTemplateIdOrderByVersionDesc(id);

            List<VersionDTO> dtos = versions.stream()
                    .map(this::convertToVersionDTO)
                    .toList();

            return ApiResponse.success(dtos);
        } catch (Exception e) {
            log.error("获取版本历史失败: templateId={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("获取版本历史失败: " + e.getMessage());
        }
    }

    /**
     * 获取特定版本详情
     */
    @GetMapping("/id/{id}/versions/{version}")
    @Operation(summary = "获取特定版本详情", description = "获取模板指定历史版本的完整信息，包含完整的Schema JSON内容")
    public ApiResponse<FormTemplateVersion> getVersionDetail(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @PathVariable @Parameter(description = "版本号", example = "3") Integer version) {

        log.debug("获取版本详情: templateId={}, version={}", id, version);

        try {
            Optional<FormTemplateVersion> optVersion = versionRepository
                    .findByTemplateIdAndVersion(id, version);

            if (optVersion.isEmpty()) {
                return ApiResponse.error("版本不存在: " + version);
            }

            return ApiResponse.success(optVersion.get());
        } catch (Exception e) {
            log.error("获取版本详情失败: error={}", e.getMessage(), e);
            return ApiResponse.error("获取版本详情失败: " + e.getMessage());
        }
    }

    /**
     * 回滚到指定版本
     */
    @PostMapping("/id/{id}/rollback")
    @Operation(summary = "回滚版本", description = "将模板回滚到指定的历史版本，回滚后会创建新的版本记录，记录回滚原因")
    public ApiResponse<FormTemplate> rollbackToVersion(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @RequestBody @Parameter(description = "回滚请求，包含目标版本号和回滚原因") RollbackRequest request,
            @RequestHeader("Authorization") @Parameter(description = "Bearer Token") String authorization) {

        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("回滚模板: templateId={}, toVersion={}, userId={}", id, request.getVersion(), userId);

        try {
            FormTemplate result = formTemplateService.rollbackToVersion(
                    id, request.getVersion(), request.getReason(), userId);
            return ApiResponse.success("回滚成功", result);
        } catch (Exception e) {
            log.error("回滚版本失败: templateId={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("回滚版本失败: " + e.getMessage());
        }
    }

    /**
     * 比较两个版本的差异
     */
    @GetMapping("/id/{id}/versions/compare")
    @Operation(summary = "比较版本差异", description = "比较两个历史版本之间的差异，返回两个版本的Schema JSON和变更摘要供前端进行差异展示")
    public ApiResponse<VersionCompareResult> compareVersions(
            @PathVariable @NotBlank @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @NotBlank @Parameter(description = "模板ID（UUID）", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @RequestParam @Parameter(description = "起始版本号", example = "1") Integer fromVersion,
            @RequestParam @Parameter(description = "目标版本号", example = "3") Integer toVersion) {

        log.debug("比较版本差异: templateId={}, from={}, to={}", id, fromVersion, toVersion);

        try {
            Optional<FormTemplateVersion> optFrom = versionRepository
                    .findByTemplateIdAndVersion(id, fromVersion);
            Optional<FormTemplateVersion> optTo = versionRepository
                    .findByTemplateIdAndVersion(id, toVersion);

            if (optFrom.isEmpty() || optTo.isEmpty()) {
                return ApiResponse.error("版本不存在");
            }

            FormTemplateVersion from = optFrom.get();
            FormTemplateVersion to = optTo.get();

            VersionCompareResult result = new VersionCompareResult();
            result.setFromVersion(fromVersion);
            result.setToVersion(toVersion);
            result.setFromSchema(from.getSchemaJson());
            result.setToSchema(to.getSchemaJson());
            result.setFromChangeSummary(from.getChangeSummary());
            result.setToChangeSummary(to.getChangeSummary());

            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("比较版本失败: error={}", e.getMessage(), e);
            return ApiResponse.error("比较版本失败: " + e.getMessage());
        }
    }

    // ============ Helper Methods ============

    private VersionDTO convertToVersionDTO(FormTemplateVersion version) {
        VersionDTO dto = new VersionDTO();
        dto.setId(version.getId());
        dto.setVersion(version.getVersion());
        dto.setName(version.getName());
        dto.setChangeSummary(version.getChangeSummary());
        dto.setSource(version.getSource());
        dto.setCreatedAt(version.getCreatedAt());
        dto.setCreatedBy(version.getCreatedBy());
        return dto;
    }

    // ============ Request DTOs ============

    /**
     * 创建模板请求
     */
    public static class CreateTemplateRequest {
        @NotBlank(message = "实体类型不能为空")
        private String entityType;

        @NotBlank(message = "模板名称不能为空")
        private String name;

        @NotBlank(message = "Schema JSON 不能为空")
        private String schemaJson;

        private String uiSchemaJson;

        private String description;

        // Getters and Setters
        public String getEntityType() { return entityType; }
        public void setEntityType(String entityType) { this.entityType = entityType; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getSchemaJson() { return schemaJson; }
        public void setSchemaJson(String schemaJson) { this.schemaJson = schemaJson; }
        public String getUiSchemaJson() { return uiSchemaJson; }
        public void setUiSchemaJson(String uiSchemaJson) { this.uiSchemaJson = uiSchemaJson; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    /**
     * 更新模板请求
     */
    public static class UpdateTemplateRequest {
        private String name;
        private String schemaJson;
        private String uiSchemaJson;
        private String description;

        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getSchemaJson() { return schemaJson; }
        public void setSchemaJson(String schemaJson) { this.schemaJson = schemaJson; }
        public String getUiSchemaJson() { return uiSchemaJson; }
        public void setUiSchemaJson(String uiSchemaJson) { this.uiSchemaJson = uiSchemaJson; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    /**
     * 版本信息DTO
     */
    public static class VersionDTO {
        private String id;
        private Integer version;
        private String name;
        private String changeSummary;
        private String source;
        private LocalDateTime createdAt;
        private Long createdBy;

        // Getters and Setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public Integer getVersion() { return version; }
        public void setVersion(Integer version) { this.version = version; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getChangeSummary() { return changeSummary; }
        public void setChangeSummary(String changeSummary) { this.changeSummary = changeSummary; }
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public Long getCreatedBy() { return createdBy; }
        public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    }

    /**
     * 回滚请求
     */
    public static class RollbackRequest {
        private Integer version;
        private String reason;

        public Integer getVersion() { return version; }
        public void setVersion(Integer version) { this.version = version; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    /**
     * 版本比较结果
     */
    public static class VersionCompareResult {
        private Integer fromVersion;
        private Integer toVersion;
        private String fromSchema;
        private String toSchema;
        private String fromChangeSummary;
        private String toChangeSummary;

        public Integer getFromVersion() { return fromVersion; }
        public void setFromVersion(Integer fromVersion) { this.fromVersion = fromVersion; }
        public Integer getToVersion() { return toVersion; }
        public void setToVersion(Integer toVersion) { this.toVersion = toVersion; }
        public String getFromSchema() { return fromSchema; }
        public void setFromSchema(String fromSchema) { this.fromSchema = fromSchema; }
        public String getToSchema() { return toSchema; }
        public void setToSchema(String toSchema) { this.toSchema = toSchema; }
        public String getFromChangeSummary() { return fromChangeSummary; }
        public void setFromChangeSummary(String fromChangeSummary) { this.fromChangeSummary = fromChangeSummary; }
        public String getToChangeSummary() { return toChangeSummary; }
        public void setToChangeSummary(String toChangeSummary) { this.toChangeSummary = toChangeSummary; }
    }
}
