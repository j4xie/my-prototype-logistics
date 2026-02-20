package com.cretas.aims.controller;

import com.cretas.aims.ai.client.DashScopeVisionClient;
import com.cretas.aims.ai.client.DashScopeVisionClient.CompletionGestureResult;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ProductionProcessPromptConfig;
import com.cretas.aims.repository.config.ProductionProcessPromptConfigRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 图像分析测试 API
 *
 * 用于测试AI视觉识别功能，支持上传图片进行手势/动作检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/image-analysis")
@RequiredArgsConstructor
@Tag(name = "图像分析测试", description = "AI视觉识别功能测试，支持手势检测、动作识别等")
public class ImageAnalysisTestController {

    private final DashScopeVisionClient visionClient;
    private final ProductionProcessPromptConfigRepository promptConfigRepository;

    /**
     * 测试手势/动作检测（使用Base64图片）
     */
    @PostMapping("/test-gesture")
    @Operation(summary = "测试手势检测（Base64）", description = "上传Base64编码的图片，测试AI手势/动作检测功能")
    public ApiResponse<Map<String, Object>> testGestureDetection(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody GestureTestRequest request) {

        log.info("手势检测测试请求: factoryId={}, workstationId={}, processStageType={}",
                factoryId, request.getWorkstationId(), request.getProcessStageType());

        if (request.getImageBase64() == null || request.getImageBase64().isEmpty()) {
            return ApiResponse.error("图片数据不能为空");
        }

        // 移除可能的data:image前缀
        String imageBase64 = request.getImageBase64();
        if (imageBase64.contains(",")) {
            imageBase64 = imageBase64.split(",")[1];
        }

        // 获取自定义Prompt配置（如果有）
        String customPrompt = null;
        if (request.getProcessStageType() != null) {
            List<ProductionProcessPromptConfig> configs = promptConfigRepository.findBestMatchConfig(
                    factoryId,
                    request.getProcessStageType(),
                    request.getProductTypeId(),
                    LocalDate.now(),
                    PageRequest.of(0, 1)
            );
            if (!configs.isEmpty()) {
                customPrompt = configs.get(0).getCompletionDetectionPrompt();
                log.info("使用自定义Prompt配置: {}", configs.get(0).getName());
            }
        }

        // 构建上下文
        Map<String, Object> context = new HashMap<>();
        context.put("workstationId", request.getWorkstationId() != null ? request.getWorkstationId() : "测试工位");
        context.put("productType", request.getProductType() != null ? request.getProductType() : "产品");
        context.put("factoryId", factoryId);
        if (customPrompt != null) {
            context.put("customPrompt", customPrompt);
        }

        // 调用AI分析
        CompletionGestureResult result = visionClient.analyzeCompletionGesture(imageBase64, context);

        // 构建返回结果
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("testTime", LocalDateTime.now().toString());
        response.put("factoryId", factoryId);
        response.put("success", result.isSuccess());
        response.put("completed", result.isCompleted());
        response.put("confidence", result.getConfidence());
        response.put("gestureType", result.getGestureType());
        response.put("workerDetected", result.isWorkerDetected());
        response.put("productDetected", result.isProductDetected());
        response.put("productPosition", result.getProductPosition());
        response.put("workerPosture", result.getWorkerPosture());
        response.put("sceneDescription", result.getSceneDescription());
        response.put("notes", result.getNotes());
        response.put("message", result.getMessage());
        response.put("canConfirmCompletion", result.canConfirmCompletion());

        if (result.isSuccess()) {
            log.info("手势检测结果: completed={}, confidence={}, gesture={}",
                    result.isCompleted(), result.getConfidence(), result.getGestureType());
            return ApiResponse.success("检测完成", response);
        } else {
            log.warn("手势检测失败: {}", result.getMessage());
            return ApiResponse.error(result.getMessage());
        }
    }

    /**
     * 测试手势/动作检测（使用文件上传）
     */
    @PostMapping("/test-gesture/upload")
    @Operation(summary = "测试手势检测（文件上传）", description = "上传图片文件，测试AI手势/动作检测功能")
    public ApiResponse<Map<String, Object>> testGestureDetectionWithFile(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) @Parameter(description = "工位ID") String workstationId,
            @RequestParam(required = false) @Parameter(description = "产品类型") String productType,
            @RequestParam(required = false) @Parameter(description = "工序类型") String processStageType,
            @RequestParam(required = false) @Parameter(description = "产品类型ID") String productTypeId) {

        log.info("手势检测测试请求（文件上传）: factoryId={}, fileName={}, size={}",
                factoryId, file.getOriginalFilename(), file.getSize());

        if (file.isEmpty()) {
            return ApiResponse.error("文件不能为空");
        }

        try {
            // 将文件转换为Base64
            String imageBase64 = Base64.getEncoder().encodeToString(file.getBytes());

            // 构建请求对象
            GestureTestRequest request = new GestureTestRequest();
            request.setImageBase64(imageBase64);
            request.setWorkstationId(workstationId);
            request.setProductType(productType);
            request.setProcessStageType(processStageType);
            request.setProductTypeId(productTypeId);

            return testGestureDetection(factoryId, request);

        } catch (IOException e) {
            log.error("文件读取失败", e);
            return ApiResponse.error("文件读取失败: " + e.getMessage());
        }
    }

    /**
     * 获取当前Prompt配置
     */
    @GetMapping("/prompt-config")
    @Operation(summary = "获取当前Prompt配置", description = "获取指定工序类型的AI检测Prompt配置")
    public ApiResponse<ProductionProcessPromptConfig> getPromptConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "工序类型", example = "PACKAGING") String processStageType,
            @RequestParam(required = false) @Parameter(description = "产品类型ID") String productTypeId) {

        log.info("获取Prompt配置: factoryId={}, processStageType={}", factoryId, processStageType);

        List<ProductionProcessPromptConfig> configs = promptConfigRepository.findBestMatchConfig(
                factoryId,
                processStageType,
                productTypeId,
                LocalDate.now(),
                PageRequest.of(0, 1)
        );

        if (configs.isEmpty()) {
            return ApiResponse.error("未找到匹配的Prompt配置");
        }

        return ApiResponse.success(configs.get(0));
    }

    /**
     * 检查AI服务状态
     */
    @GetMapping("/status")
    @Operation(summary = "检查AI服务状态", description = "检查DashScope视觉服务是否可用")
    public ApiResponse<Map<String, Object>> checkStatus(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("factoryId", factoryId);
        status.put("checkTime", LocalDateTime.now().toString());
        status.put("visionServiceAvailable", visionClient.isAvailable());

        if (visionClient.isAvailable()) {
            status.put("message", "AI视觉服务正常运行");
            return ApiResponse.success("服务正常", status);
        } else {
            status.put("message", "AI视觉服务不可用，请检查DashScope API配置");
            return ApiResponse.error("服务不可用");
        }
    }

    /**
     * 手势测试请求DTO
     */
    @lombok.Data
    public static class GestureTestRequest {
        @Parameter(description = "Base64编码的图片数据", required = true)
        private String imageBase64;

        @Parameter(description = "工位ID")
        private String workstationId;

        @Parameter(description = "产品类型名称")
        private String productType;

        @Parameter(description = "工序类型", example = "PACKAGING")
        private String processStageType;

        @Parameter(description = "产品类型ID")
        private String productTypeId;
    }
}
