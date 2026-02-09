package com.cretas.aims.controller.platform;

import com.cretas.aims.dto.ai.AIReportPromptConfigDTO;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.AIReportPromptConfigService;
import com.cretas.aims.utils.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * AI报告提示词配置控制器
 *
 * 供平台管理员管理不同类型报告的AI提示词配置:
 * - 支持按报告类型(日/周/月/季/年)配置提示词模板
 * - 支持工厂级别的自定义配置覆盖平台默认
 * - 支持配置分析方向和优先级
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Slf4j
@RestController
@RequestMapping("/api/platform/report-prompts")
@RequiredArgsConstructor
@Validated
@Tag(name = "AI报告提示词配置", description = "平台管理员AI报告提示词配置管理API")
public class AIReportPromptConfigController {

    private final AIReportPromptConfigService configService;
    private final JwtUtil jwtUtil;

    // ==================== 查询接口 ====================

    /**
     * 获取所有配置列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取所有配置列表", description = "分页获取所有AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<Page<AIReportPromptConfigDTO>> getAllConfigs(
            @Parameter(description = "页码（从0开始）") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "20") int size) {

        log.info("API调用: 获取所有AI报告提示词配置 - page={}, size={}", page, size);

        Pageable pageable = PageRequest.of(page, size);
        Page<AIReportPromptConfigDTO> configs = configService.getAllConfigs(pageable);

        return ApiResponse.success(configs);
    }

    /**
     * 获取单个配置详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取单个配置", description = "根据ID获取AI报告提示词配置详情（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIReportPromptConfigDTO> getConfigById(
            @Parameter(description = "配置ID") @PathVariable String id) {

        log.info("API调用: 获取AI报告提示词配置详情 - id={}", id);

        AIReportPromptConfigDTO config = configService.getConfigById(id);
        return ApiResponse.success(config);
    }

    /**
     * 按报告类型获取配置
     */
    @GetMapping("/by-type/{reportType}")
    @Operation(summary = "按报告类型获取配置", description = "根据报告类型获取所有配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<List<AIReportPromptConfigDTO>> getConfigsByReportType(
            @Parameter(description = "报告类型: daily/weekly/monthly/quarterly/yearly")
            @PathVariable String reportType) {

        log.info("API调用: 按报告类型获取配置 - reportType={}", reportType);

        List<AIReportPromptConfigDTO> configs = configService.getConfigsByReportType(reportType);
        return ApiResponse.success(configs);
    }

    // ==================== 创建/更新接口 ====================

    /**
     * 创建新配置
     */
    @PostMapping
    @Operation(summary = "创建新配置", description = "创建新的AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIReportPromptConfigDTO> createConfig(
            @Valid @RequestBody AIReportPromptConfigDTO dto,
            @RequestHeader("Authorization") String authorization) {

        String username = extractUsername(authorization);
        log.info("API调用: 创建AI报告提示词配置 - reportType={}, factoryId={}, createdBy={}",
                dto.getReportType(), dto.getFactoryId(), username);

        AIReportPromptConfigDTO created = configService.createConfig(dto, username);
        return ApiResponse.success("配置创建成功", created);
    }

    /**
     * 更新配置
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新配置", description = "更新指定ID的AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIReportPromptConfigDTO> updateConfig(
            @Parameter(description = "配置ID") @PathVariable String id,
            @Valid @RequestBody AIReportPromptConfigDTO dto,
            @RequestHeader("Authorization") String authorization) {

        String username = extractUsername(authorization);
        log.info("API调用: 更新AI报告提示词配置 - id={}, updatedBy={}", id, username);

        AIReportPromptConfigDTO updated = configService.updateConfig(id, dto, username);
        return ApiResponse.success("配置更新成功", updated);
    }

    // ==================== 删除接口 ====================

    /**
     * 删除配置
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除配置", description = "删除指定ID的AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<String> deleteConfig(
            @Parameter(description = "配置ID") @PathVariable String id) {

        log.info("API调用: 删除AI报告提示词配置 - id={}", id);

        configService.deleteConfig(id);
        return ApiResponse.success("配置删除成功");
    }

    // ==================== 状态管理接口 ====================

    /**
     * 激活配置
     */
    @PostMapping("/{id}/activate")
    @Operation(summary = "激活配置", description = "激活指定ID的AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIReportPromptConfigDTO> activateConfig(
            @Parameter(description = "配置ID") @PathVariable String id,
            @RequestHeader("Authorization") String authorization) {

        String username = extractUsername(authorization);
        log.info("API调用: 激活AI报告提示词配置 - id={}, updatedBy={}", id, username);

        AIReportPromptConfigDTO config = configService.activateConfig(id, username);
        return ApiResponse.success("配置已激活", config);
    }

    /**
     * 停用配置
     */
    @PostMapping("/{id}/deactivate")
    @Operation(summary = "停用配置", description = "停用指定ID的AI报告提示词配置（仅平台管理员）")
    @PreAuthorize("hasAnyAuthority('super_admin', 'platform_admin')")
    public ApiResponse<AIReportPromptConfigDTO> deactivateConfig(
            @Parameter(description = "配置ID") @PathVariable String id,
            @RequestHeader("Authorization") String authorization) {

        String username = extractUsername(authorization);
        log.info("API调用: 停用AI报告提示词配置 - id={}, updatedBy={}", id, username);

        AIReportPromptConfigDTO config = configService.deactivateConfig(id, username);
        return ApiResponse.success("配置已停用", config);
    }

    // ==================== 辅助方法 ====================

    /**
     * 从Authorization头提取用户名
     */
    private String extractUsername(String authorization) {
        try {
            String token = authorization.replace("Bearer ", "");
            return jwtUtil.getUsernameFromToken(token);
        } catch (Exception e) {
            log.warn("从Token提取用户名失败: {}", e.getMessage());
            return "unknown";
        }
    }
}
