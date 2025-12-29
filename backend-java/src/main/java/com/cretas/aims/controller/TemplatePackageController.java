package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.template.IndustryTemplatePackageDTO;
import com.cretas.aims.entity.IndustryTemplatePackage;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.repository.FormTemplateRepository;
import com.cretas.aims.repository.IndustryTemplatePackageRepository;
import com.cretas.aims.utils.JwtUtil;
import com.cretas.aims.utils.TokenUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 行业模板包控制器
 *
 * 提供行业模板管理功能：
 * - 获取可用模板列表
 * - 为工厂初始化模板配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@RestController
@RequestMapping("/api/platform")
@Tag(name = "行业模板包", description = "行业模板包管理，用于工厂快速初始化配置")
@Validated
public class TemplatePackageController {

    @Autowired
    private IndustryTemplatePackageRepository templatePackageRepository;

    @Autowired
    private FormTemplateRepository formTemplateRepository;

    @Autowired
    private JwtUtil jwtUtil;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ==================== DTO定义 ====================

    /**
     * 初始化模板请求
     */
    @Data
    public static class InitializeTemplateRequest {
        @NotBlank(message = "模板ID不能为空")
        private String templatePackageId;

        /**
         * 是否覆盖已有配置
         */
        private Boolean overwrite = false;
    }

    /**
     * 初始化结果
     */
    @Data
    public static class InitializeTemplateResult {
        private boolean success;
        private int templatesImported;
        private List<String> entityTypes;
        private String message;
    }

    /**
     * 创建模板包请求
     */
    @Data
    public static class CreateTemplatePackageRequest {
        @NotBlank(message = "行业代码不能为空")
        private String industryCode;

        @NotBlank(message = "行业名称不能为空")
        private String industryName;

        private String description;

        @NotBlank(message = "模板JSON不能为空")
        private String templatesJson;

        private Boolean isDefault = false;
    }

    /**
     * 更新模板包请求
     */
    @Data
    public static class UpdateTemplatePackageRequest {
        private String industryName;
        private String description;
        private String templatesJson;
        private Boolean isDefault;
    }

    /**
     * 模板使用情况DTO
     */
    @Data
    public static class TemplateUsageInfo {
        private String templateId;
        private int usageCount;
        private List<FactoryUsageInfo> factories;
    }

    @Data
    public static class FactoryUsageInfo {
        private String factoryId;
        private String factoryName;
        private String initializedAt;
    }

    // ==================== API端点 ====================

    /**
     * 获取所有可用的行业模板包
     */
    @GetMapping("/template-packages")
    @Operation(summary = "获取行业模板包列表",
               description = "获取所有可用的行业配置模板包，用于工厂初始化")
    public ApiResponse<List<IndustryTemplatePackageDTO>> listTemplatePackages(
            HttpServletRequest request) {

        log.info("获取行业模板包列表");

        try {
            List<IndustryTemplatePackage> packages = templatePackageRepository.findAllAvailable();

            List<IndustryTemplatePackageDTO> result = packages.stream()
                    .map(this::convertToDTO)
                    .toList();

            log.info("获取行业模板包成功: count={}", result.size());
            return ApiResponse.success(result);

        } catch (Exception e) {
            log.error("获取行业模板包失败: error={}", e.getMessage(), e);
            return ApiResponse.error("获取模板包失败: " + e.getMessage());
        }
    }

    /**
     * 获取单个模板包详情
     */
    @GetMapping("/template-packages/{id}")
    @Operation(summary = "获取模板包详情",
               description = "获取指定行业模板包的详细配置")
    public ApiResponse<IndustryTemplatePackageDTO> getTemplatePackage(
            @PathVariable @Parameter(description = "模板包ID") String id) {

        log.info("获取模板包详情: id={}", id);

        try {
            Optional<IndustryTemplatePackage> optPackage = templatePackageRepository.findById(id);

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + id);
            }

            IndustryTemplatePackageDTO dto = convertToDTO(optPackage.get());
            return ApiResponse.success(dto);

        } catch (Exception e) {
            log.error("获取模板包详情失败: id={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("获取模板包失败: " + e.getMessage());
        }
    }

    /**
     * 为工厂初始化模板配置
     *
     * 将选定的行业模板导入到工厂的form_templates表中
     */
    @PostMapping("/factories/{factoryId}/initialize-templates")
    @Operation(summary = "初始化工厂模板",
               description = "将行业模板包导入到指定工厂，快速完成配置初始化")
    public ApiResponse<InitializeTemplateResult> initializeFactoryTemplates(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody @Parameter(description = "初始化请求") InitializeTemplateRequest request,
            HttpServletRequest httpRequest) {

        // 1. 权限验证
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        String userRole = jwtUtil.getRoleFromToken(token);

        // 仅平台管理员和工厂超级管理员可以初始化模板
        if (userRole == null ||
            (!userRole.equals("super_admin") &&
             !userRole.equals("factory_super_admin"))) {
            log.warn("初始化模板权限不足: factoryId={}, role={}", factoryId, userRole);
            return ApiResponse.error("权限不足：仅平台管理员或工厂超级管理员可初始化模板");
        }

        log.info("初始化工厂模板: factoryId={}, templatePackageId={}, overwrite={}",
                factoryId, request.getTemplatePackageId(), request.getOverwrite());

        try {
            // 2. 获取模板包
            Optional<IndustryTemplatePackage> optPackage =
                    templatePackageRepository.findById(request.getTemplatePackageId());

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + request.getTemplatePackageId());
            }

            IndustryTemplatePackage templatePackage = optPackage.get();

            // 3. 解析模板JSON
            Map<String, Object> templates = parseTemplatesJson(templatePackage.getTemplatesJson());

            // 4. 导入每个实体类型的模板
            List<String> importedEntityTypes = new ArrayList<>();
            int importedCount = 0;

            for (Map.Entry<String, Object> entry : templates.entrySet()) {
                String entityType = entry.getKey();
                Object schemaConfig = entry.getValue();

                // 检查是否已存在
                Optional<FormTemplate> existing = formTemplateRepository
                        .findActiveByFactoryIdAndEntityType(factoryId, entityType);

                if (existing.isPresent() && !Boolean.TRUE.equals(request.getOverwrite())) {
                    log.info("跳过已存在的模板: factoryId={}, entityType={}", factoryId, entityType);
                    continue;
                }

                // 创建或更新模板
                FormTemplate formTemplate = existing.orElse(new FormTemplate());

                if (formTemplate.getId() == null) {
                    formTemplate.setId(UUID.randomUUID().toString());
                }

                formTemplate.setFactoryId(factoryId);
                formTemplate.setEntityType(entityType);
                formTemplate.setName(templatePackage.getIndustryName() + " - " + entityType);
                formTemplate.setSchemaJson(objectMapper.writeValueAsString(schemaConfig));
                formTemplate.setSource("IMPORT");
                formTemplate.setSourcePackageId(templatePackage.getId());
                formTemplate.setDescription("从行业模板包导入: " + templatePackage.getIndustryName());
                formTemplate.setIsActive(true);

                // 递增版本号
                if (existing.isPresent()) {
                    formTemplate.incrementVersion();
                } else {
                    formTemplate.setVersion(1);
                }

                formTemplateRepository.save(formTemplate);

                importedEntityTypes.add(entityType);
                importedCount++;
            }

            // 5. 构建结果
            InitializeTemplateResult result = new InitializeTemplateResult();
            result.setSuccess(true);
            result.setTemplatesImported(importedCount);
            result.setEntityTypes(importedEntityTypes);
            result.setMessage(String.format("成功导入 %d 个模板配置", importedCount));

            log.info("初始化工厂模板成功: factoryId={}, importedCount={}, entityTypes={}",
                    factoryId, importedCount, importedEntityTypes);

            return ApiResponse.success(result);

        } catch (Exception e) {
            log.error("初始化工厂模板失败: factoryId={}, error={}", factoryId, e.getMessage(), e);

            InitializeTemplateResult errorResult = new InitializeTemplateResult();
            errorResult.setSuccess(false);
            errorResult.setTemplatesImported(0);
            errorResult.setEntityTypes(List.of());
            errorResult.setMessage("初始化失败: " + e.getMessage());

            return ApiResponse.error("初始化模板失败: " + e.getMessage());
        }
    }

    /**
     * 创建新的行业模板包
     */
    @PostMapping("/template-packages")
    @Operation(summary = "创建行业模板包",
               description = "创建新的行业配置模板包")
    public ApiResponse<IndustryTemplatePackageDTO> createTemplatePackage(
            @Valid @RequestBody CreateTemplatePackageRequest request,
            HttpServletRequest httpRequest) {

        // 权限验证 - 仅平台管理员可创建
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        String userRole = jwtUtil.getRoleFromToken(token);

        if (!"super_admin".equals(userRole)) {
            log.warn("创建模板包权限不足: role={}", userRole);
            return ApiResponse.error("权限不足：仅平台管理员可创建模板包");
        }

        log.info("创建行业模板包: industryCode={}, industryName={}",
                request.getIndustryCode(), request.getIndustryName());

        try {
            // 检查行业代码是否已存在
            if (templatePackageRepository.existsByIndustryCodeAndDeletedAtIsNull(request.getIndustryCode())) {
                return ApiResponse.error("行业代码已存在: " + request.getIndustryCode());
            }

            // 验证JSON格式
            try {
                parseTemplatesJson(request.getTemplatesJson());
            } catch (Exception e) {
                return ApiResponse.error("模板JSON格式无效: " + e.getMessage());
            }

            // 创建新模板包
            IndustryTemplatePackage templatePackage = new IndustryTemplatePackage();
            templatePackage.setId(UUID.randomUUID().toString());
            templatePackage.setIndustryCode(request.getIndustryCode());
            templatePackage.setIndustryName(request.getIndustryName());
            templatePackage.setDescription(request.getDescription());
            templatePackage.setTemplatesJson(request.getTemplatesJson());
            templatePackage.setVersion(1);
            templatePackage.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
            templatePackage.setCreatedAt(LocalDateTime.now());
            templatePackage.setUpdatedAt(LocalDateTime.now());

            // 如果设为默认，清除其他默认标记
            if (Boolean.TRUE.equals(request.getIsDefault())) {
                templatePackageRepository.clearAllDefaults();
            }

            templatePackageRepository.save(templatePackage);

            log.info("创建行业模板包成功: id={}", templatePackage.getId());
            return ApiResponse.success(convertToDTO(templatePackage));

        } catch (Exception e) {
            log.error("创建行业模板包失败: error={}", e.getMessage(), e);
            return ApiResponse.error("创建模板包失败: " + e.getMessage());
        }
    }

    /**
     * 更新行业模板包
     */
    @PutMapping("/template-packages/{id}")
    @Operation(summary = "更新行业模板包",
               description = "更新现有行业模板包配置")
    public ApiResponse<IndustryTemplatePackageDTO> updateTemplatePackage(
            @PathVariable @Parameter(description = "模板包ID") String id,
            @Valid @RequestBody UpdateTemplatePackageRequest request,
            HttpServletRequest httpRequest) {

        // 权限验证
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        String userRole = jwtUtil.getRoleFromToken(token);

        if (!"super_admin".equals(userRole)) {
            log.warn("更新模板包权限不足: role={}", userRole);
            return ApiResponse.error("权限不足：仅平台管理员可更新模板包");
        }

        log.info("更新行业模板包: id={}", id);

        try {
            Optional<IndustryTemplatePackage> optPackage = templatePackageRepository.findById(id);

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + id);
            }

            IndustryTemplatePackage templatePackage = optPackage.get();

            // 更新字段
            if (request.getIndustryName() != null) {
                templatePackage.setIndustryName(request.getIndustryName());
            }
            if (request.getDescription() != null) {
                templatePackage.setDescription(request.getDescription());
            }
            if (request.getTemplatesJson() != null) {
                // 验证JSON格式
                try {
                    parseTemplatesJson(request.getTemplatesJson());
                } catch (Exception e) {
                    return ApiResponse.error("模板JSON格式无效: " + e.getMessage());
                }
                templatePackage.setTemplatesJson(request.getTemplatesJson());
            }

            // 处理默认标记
            if (request.getIsDefault() != null) {
                if (Boolean.TRUE.equals(request.getIsDefault()) && !templatePackage.getIsDefault()) {
                    templatePackageRepository.clearAllDefaults();
                }
                templatePackage.setIsDefault(request.getIsDefault());
            }

            // 递增版本号
            templatePackage.setVersion(templatePackage.getVersion() + 1);
            templatePackage.setUpdatedAt(LocalDateTime.now());

            templatePackageRepository.save(templatePackage);

            log.info("更新行业模板包成功: id={}, newVersion={}", id, templatePackage.getVersion());
            return ApiResponse.success(convertToDTO(templatePackage));

        } catch (Exception e) {
            log.error("更新行业模板包失败: id={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("更新模板包失败: " + e.getMessage());
        }
    }

    /**
     * 删除行业模板包 (软删除)
     */
    @DeleteMapping("/template-packages/{id}")
    @Operation(summary = "删除行业模板包",
               description = "删除指定的行业模板包 (软删除)")
    public ApiResponse<Void> deleteTemplatePackage(
            @PathVariable @Parameter(description = "模板包ID") String id,
            HttpServletRequest httpRequest) {

        // 权限验证
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        String userRole = jwtUtil.getRoleFromToken(token);

        if (!"super_admin".equals(userRole)) {
            log.warn("删除模板包权限不足: role={}", userRole);
            return ApiResponse.error("权限不足：仅平台管理员可删除模板包");
        }

        log.info("删除行业模板包: id={}", id);

        try {
            Optional<IndustryTemplatePackage> optPackage = templatePackageRepository.findById(id);

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + id);
            }

            IndustryTemplatePackage templatePackage = optPackage.get();

            // 检查是否有工厂正在使用
            long usageCount = formTemplateRepository.countBySourceContaining(id);
            if (usageCount > 0) {
                return ApiResponse.error("无法删除：该模板包已被 " + usageCount + " 个工厂使用");
            }

            // 软删除
            templatePackage.setDeletedAt(LocalDateTime.now());
            templatePackageRepository.save(templatePackage);

            log.info("删除行业模板包成功: id={}", id);
            return ApiResponse.success(null);

        } catch (Exception e) {
            log.error("删除行业模板包失败: id={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("删除模板包失败: " + e.getMessage());
        }
    }

    /**
     * 设置默认模板包
     */
    @PutMapping("/template-packages/{id}/set-default")
    @Operation(summary = "设为默认模板",
               description = "将指定模板包设为默认模板")
    public ApiResponse<IndustryTemplatePackageDTO> setDefaultTemplate(
            @PathVariable @Parameter(description = "模板包ID") String id,
            HttpServletRequest httpRequest) {

        // 权限验证
        String token = TokenUtils.extractToken(httpRequest.getHeader("Authorization"));
        String userRole = jwtUtil.getRoleFromToken(token);

        if (!"super_admin".equals(userRole)) {
            log.warn("设置默认模板权限不足: role={}", userRole);
            return ApiResponse.error("权限不足：仅平台管理员可设置默认模板");
        }

        log.info("设置默认模板包: id={}", id);

        try {
            Optional<IndustryTemplatePackage> optPackage = templatePackageRepository.findById(id);

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + id);
            }

            // 清除所有默认标记
            templatePackageRepository.clearAllDefaults();

            // 设置新默认
            IndustryTemplatePackage templatePackage = optPackage.get();
            templatePackage.setIsDefault(true);
            templatePackage.setUpdatedAt(LocalDateTime.now());
            templatePackageRepository.save(templatePackage);

            log.info("设置默认模板包成功: id={}", id);
            return ApiResponse.success(convertToDTO(templatePackage));

        } catch (Exception e) {
            log.error("设置默认模板包失败: id={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("设置默认模板失败: " + e.getMessage());
        }
    }

    /**
     * 获取模板使用情况
     */
    @GetMapping("/template-packages/{id}/usage")
    @Operation(summary = "获取模板使用情况",
               description = "查看哪些工厂使用了该模板包")
    public ApiResponse<TemplateUsageInfo> getTemplateUsage(
            @PathVariable @Parameter(description = "模板包ID") String id,
            HttpServletRequest httpRequest) {

        log.info("获取模板使用情况: id={}", id);

        try {
            Optional<IndustryTemplatePackage> optPackage = templatePackageRepository.findById(id);

            if (optPackage.isEmpty()) {
                return ApiResponse.error("模板包不存在: " + id);
            }

            // 查找使用该模板的工厂
            List<FormTemplate> usages = formTemplateRepository.findBySourceContaining(id);

            // 按工厂分组
            Map<String, List<FormTemplate>> byFactory = new HashMap<>();
            for (FormTemplate template : usages) {
                byFactory.computeIfAbsent(template.getFactoryId(), k -> new ArrayList<>())
                        .add(template);
            }

            // 构建使用情况
            TemplateUsageInfo usageInfo = new TemplateUsageInfo();
            usageInfo.setTemplateId(id);
            usageInfo.setUsageCount(byFactory.size());

            List<FactoryUsageInfo> factoryUsages = new ArrayList<>();
            for (Map.Entry<String, List<FormTemplate>> entry : byFactory.entrySet()) {
                FactoryUsageInfo factoryUsage = new FactoryUsageInfo();
                factoryUsage.setFactoryId(entry.getKey());
                factoryUsage.setFactoryName("工厂 " + entry.getKey()); // 简化，实际应查询工厂名

                // 取最早的导入时间
                entry.getValue().stream()
                        .map(FormTemplate::getCreatedAt)
                        .filter(Objects::nonNull)
                        .min(LocalDateTime::compareTo)
                        .ifPresent(dt -> factoryUsage.setInitializedAt(dt.toString()));

                factoryUsages.add(factoryUsage);
            }

            usageInfo.setFactories(factoryUsages);

            log.info("获取模板使用情况成功: id={}, usageCount={}", id, usageInfo.getUsageCount());
            return ApiResponse.success(usageInfo);

        } catch (Exception e) {
            log.error("获取模板使用情况失败: id={}, error={}", id, e.getMessage(), e);
            return ApiResponse.error("获取使用情况失败: " + e.getMessage());
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 转换实体为DTO
     */
    private IndustryTemplatePackageDTO convertToDTO(IndustryTemplatePackage entity) {
        IndustryTemplatePackageDTO dto = new IndustryTemplatePackageDTO();
        dto.setId(entity.getId());
        dto.setIndustryCode(entity.getIndustryCode());
        dto.setIndustryName(entity.getIndustryName());
        dto.setDescription(entity.getDescription());
        dto.setVersion(entity.getVersion());
        dto.setIsDefault(entity.getIsDefault());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());

        // 解析模板JSON
        try {
            Map<String, Object> templates = parseTemplatesJson(entity.getTemplatesJson());
            dto.setTemplates(templates);
            dto.setEntityTypes(new ArrayList<>(templates.keySet()));
        } catch (Exception e) {
            log.warn("解析模板JSON失败: id={}, error={}", entity.getId(), e.getMessage());
            dto.setTemplates(Map.of());
            dto.setEntityTypes(List.of());
        }

        return dto;
    }

    /**
     * 解析模板JSON字符串
     */
    private Map<String, Object> parseTemplatesJson(String json) throws JsonProcessingException {
        if (json == null || json.trim().isEmpty()) {
            return new HashMap<>();
        }
        return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    }
}
