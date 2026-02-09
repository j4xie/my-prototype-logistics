package com.cretas.aims.controller;

import com.cretas.aims.config.OssConfig;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.sop.SopAnalysisResult;
import com.cretas.aims.dto.sop.SopUploadResponse;
import com.cretas.aims.event.SopUploadedEvent;
import com.cretas.aims.service.OssService;
import com.cretas.aims.service.SopAgentOrchestrator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * SOP 文档上传控制器
 *
 * <p>提供 SOP 文档上传和分析功能：
 * <ul>
 *   <li>上传 SOP 文档（PDF、Excel、图片）</li>
 *   <li>自动/手动触发 SOP 分析</li>
 *   <li>分析 SKU 生产复杂度</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/sop")
@RequiredArgsConstructor
@Tag(name = "SOP文档管理", description = "SOP文档上传、分析和复杂度评估相关接口")
public class SopController {

    private final ApplicationEventPublisher eventPublisher;
    private final OssConfig ossConfig;
    private final OssService ossService;
    private final SopAgentOrchestrator sopAgentOrchestrator;

    /**
     * 支持的文件类型
     */
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
            // PDF
            "application/pdf",
            // Excel
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            // 图片
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    /**
     * 上传 SOP 文档
     *
     * @param factoryId 工厂ID
     * @param file SOP 文档文件
     * @param skuCode SKU 编码（可选）
     * @param productTypeId 产品类型ID（可选）
     * @param autoAnalyze 是否自动分析（默认 true）
     * @param request HTTP 请求
     * @return 上传响应
     */
    @PostMapping("/upload")
    @Operation(summary = "上传SOP文档", description = "上传SOP文档（支持PDF、Excel、图片），可选择自动触发复杂度分析")
    public ApiResponse<SopUploadResponse> uploadSop(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam("file") @Parameter(description = "SOP文档文件") MultipartFile file,
            @RequestParam(value = "skuCode", required = false) @Parameter(description = "关联的SKU编码") String skuCode,
            @RequestParam(value = "productTypeId", required = false) @Parameter(description = "产品类型ID") String productTypeId,
            @RequestParam(value = "autoAnalyze", defaultValue = "true") @Parameter(description = "是否自动分析") Boolean autoAnalyze,
            HttpServletRequest request) {

        log.info("上传SOP文档: factoryId={}, fileName={}, skuCode={}, autoAnalyze={}",
                factoryId, file.getOriginalFilename(), skuCode, autoAnalyze);

        // 1. 验证文件类型
        String contentType = file.getContentType();
        if (contentType == null || !SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            log.warn("不支持的文件类型: {}", contentType);
            return ApiResponse.error(400, "不支持的文件类型，仅支持 PDF、Excel 和图片格式");
        }

        // 2. 生成唯一 sopId
        String sopId = UUID.randomUUID().toString().replace("-", "");

        // 3. 上传文件
        String fileUrl;
        try {
            if (isOssAvailable()) {
                fileUrl = ossService.uploadFile(file, "sop", factoryId);
            } else {
                // OSS 不可用时使用临时路径
                fileUrl = String.format("/tmp/sop/%s/%s/%s",
                        factoryId, sopId, file.getOriginalFilename());
                log.warn("OSS 不可用，使用临时路径: {}", fileUrl);
            }
        } catch (Exception e) {
            log.error("文件上传失败: {}", e.getMessage(), e);
            return ApiResponse.error(500, "文件上传失败: " + e.getMessage());
        }

        // 4. 获取用户ID
        Long userId = getUserIdFromRequest(request);

        // 5. 确定文件类型
        String fileType = determineFileType(contentType);
        String originalFileName = file.getOriginalFilename();

        // 6. 发布 SopUploadedEvent 事件
        SopUploadedEvent event = new SopUploadedEvent(
                this,
                factoryId,
                sopId,
                fileUrl,
                fileType,
                skuCode,
                productTypeId,
                userId,
                originalFileName
        );
        eventPublisher.publishEvent(event);
        log.info("已发布 SopUploadedEvent: {}", event);

        // 7. 构建响应
        SopUploadResponse response = SopUploadResponse.builder()
                .sopId(sopId)
                .fileUrl(fileUrl)
                .fileType(fileType)
                .originalFileName(originalFileName)
                .skuCode(skuCode)
                .productTypeId(productTypeId)
                .autoAnalyzeTriggered(autoAnalyze && StringUtils.hasText(skuCode))
                .uploadedAt(LocalDateTime.now())
                .uploadedBy(userId)
                .build();

        // 8. 如果 autoAnalyze=true 且有 skuCode，直接调用分析
        if (Boolean.TRUE.equals(autoAnalyze) && StringUtils.hasText(skuCode)) {
            try {
                log.info("触发自动分析: factoryId={}, fileUrl={}, skuCode={}", factoryId, fileUrl, skuCode);
                Map<String, Object> analysisResultMap = sopAgentOrchestrator.analyzeSopAndUpdateComplexity(
                        factoryId, fileUrl, skuCode);
                response.setAnalysisResultMap(analysisResultMap);
                // 同时转换为 SopAnalysisResult 对象
                response.setAnalysisResult(convertToAnalysisResult(analysisResultMap, fileUrl, skuCode));
                log.info("自动分析完成: {}", analysisResultMap);
            } catch (Exception e) {
                log.error("自动分析失败: {}", e.getMessage(), e);
                // 分析失败不影响上传结果，只记录日志
                response.setAnalysisResultMap(Map.of(
                        "success", false,
                        "errorMessage", e.getMessage()
                ));
                response.setAnalysisResult(SopAnalysisResult.builder()
                        .success(false)
                        .fileUrl(fileUrl)
                        .skuCode(skuCode)
                        .errorMessage(e.getMessage())
                        .analyzedAt(LocalDateTime.now())
                        .build());
            }
        }

        return ApiResponse.success("SOP文档上传成功", response);
    }

    /**
     * 手动触发 SOP 分析
     *
     * @param factoryId 工厂ID
     * @param requestBody 分析请求
     * @return 分析结果
     */
    @PostMapping("/analyze")
    @Operation(summary = "手动触发SOP分析", description = "手动触发SOP文档分析，解析内容并更新SKU复杂度")
    public ApiResponse<SopAnalysisResult> analyzeSop(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody @Parameter(description = "分析请求") Map<String, String> requestBody) {

        String fileUrl = requestBody.get("fileUrl");
        String skuCode = requestBody.get("skuCode");

        log.info("手动触发SOP分析: factoryId={}, fileUrl={}, skuCode={}", factoryId, fileUrl, skuCode);

        // 参数校验
        if (!StringUtils.hasText(fileUrl)) {
            return ApiResponse.error(400, "fileUrl 不能为空");
        }
        if (!StringUtils.hasText(skuCode)) {
            return ApiResponse.error(400, "skuCode 不能为空");
        }

        try {
            Map<String, Object> result = sopAgentOrchestrator.analyzeSopAndUpdateComplexity(
                    factoryId, fileUrl, skuCode);

            // 转换为 SopAnalysisResult
            SopAnalysisResult analysisResult = convertToAnalysisResult(result, fileUrl, skuCode);
            log.info("SOP分析完成: skuCode={}, complexityScore={}", skuCode, analysisResult.getComplexityScore());

            return ApiResponse.success("SOP分析完成", analysisResult);
        } catch (Exception e) {
            log.error("SOP分析失败: {}", e.getMessage(), e);
            SopAnalysisResult errorResult = SopAnalysisResult.builder()
                    .success(false)
                    .fileUrl(fileUrl)
                    .skuCode(skuCode)
                    .errorMessage(e.getMessage())
                    .analyzedAt(LocalDateTime.now())
                    .build();
            return ApiResponse.error(500, "SOP分析失败: " + e.getMessage());
        }
    }

    /**
     * 检查 OSS 服务是否可用
     */
    private boolean isOssAvailable() {
        try {
            return ossConfig != null
                    && StringUtils.hasText(ossConfig.getAccessKeyId())
                    && ossService != null
                    && ossService.isAvailable();
        } catch (Exception e) {
            log.warn("检查 OSS 可用性时出错: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 从请求中获取用户ID
     */
    private Long getUserIdFromRequest(HttpServletRequest request) {
        Object userIdObj = request.getAttribute("userId");
        if (userIdObj instanceof Long) {
            return (Long) userIdObj;
        } else if (userIdObj instanceof Integer) {
            return ((Integer) userIdObj).longValue();
        } else if (userIdObj instanceof String) {
            try {
                return Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                log.warn("无法解析用户ID: {}", userIdObj);
            }
        }
        return null;
    }

    /**
     * 根据 contentType 确定文件类型
     */
    private String determineFileType(String contentType) {
        if (contentType == null) {
            return "UNKNOWN";
        }
        if (contentType.equals("application/pdf")) {
            return "PDF";
        } else if (contentType.contains("excel") || contentType.contains("spreadsheet")) {
            return "EXCEL";
        } else if (contentType.startsWith("image/")) {
            return "IMAGE";
        }
        return "UNKNOWN";
    }

    /**
     * 将分析结果 Map 转换为 SopAnalysisResult
     */
    @SuppressWarnings("unchecked")
    private SopAnalysisResult convertToAnalysisResult(Map<String, Object> result, String fileUrl, String skuCode) {
        SopAnalysisResult.SopAnalysisResultBuilder builder = SopAnalysisResult.builder()
                .success(true)
                .fileUrl(fileUrl)
                .skuCode(skuCode)
                .analyzedAt(LocalDateTime.now())
                .rawData(result);

        // 提取复杂度评分
        if (result.containsKey("complexityScore")) {
            Object score = result.get("complexityScore");
            if (score instanceof Number) {
                builder.complexityScore(new BigDecimal(score.toString()));
            }
        }

        // 提取预估工时
        if (result.containsKey("estimatedWorkMinutes")) {
            Object minutes = result.get("estimatedWorkMinutes");
            if (minutes instanceof Number) {
                builder.estimatedWorkMinutes(((Number) minutes).intValue());
            }
        }

        // 提取加工步骤
        if (result.containsKey("processingSteps")) {
            Object steps = result.get("processingSteps");
            if (steps instanceof List) {
                builder.processingSteps((List<Map<String, Object>>) steps);
            }
        }

        // 提取技能要求
        if (result.containsKey("skillRequirements")) {
            Object skills = result.get("skillRequirements");
            if (skills instanceof List) {
                builder.skillRequirements((List<String>) skills);
            }
        }

        // 提取设备要求
        if (result.containsKey("equipmentRequirements")) {
            Object equipment = result.get("equipmentRequirements");
            if (equipment instanceof List) {
                builder.equipmentRequirements((List<String>) equipment);
            }
        }

        // 提取摘要
        if (result.containsKey("summary")) {
            builder.summary((String) result.get("summary"));
        }

        return builder.build();
    }
}
