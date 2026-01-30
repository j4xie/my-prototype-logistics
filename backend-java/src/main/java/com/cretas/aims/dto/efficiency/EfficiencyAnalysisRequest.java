package com.cretas.aims.dto.efficiency;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 效率分析请求 DTO
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencyAnalysisRequest {

    /**
     * Base64 编码的图片
     */
    @JsonProperty("image_base64")
    private String imageBase64;

    /**
     * 分析类型列表: efficiency, ocr, counting, mixed
     */
    @JsonProperty("analysis_types")
    @Builder.Default
    private List<String> analysisTypes = List.of("efficiency");

    /**
     * 摄像头ID
     */
    @JsonProperty("camera_id")
    private String cameraId;

    /**
     * 位置描述
     */
    private String location;

    /**
     * 工厂类型
     */
    @JsonProperty("factory_type")
    @Builder.Default
    private String factoryType = "食品加工";

    /**
     * 工位ID
     */
    @JsonProperty("workstation_id")
    private String workstationId;

    /**
     * 批次ID（用于OCR验证）
     */
    @JsonProperty("batch_id")
    private String batchId;

    /**
     * 是否自动提交结果到后端
     */
    @JsonProperty("auto_submit")
    @Builder.Default
    private boolean autoSubmit = false;

    /**
     * 认证Token
     */
    @JsonProperty("auth_token")
    private String authToken;

    /**
     * 工人ID
     */
    @JsonProperty("worker_id")
    private Integer workerId;

    /**
     * 工作时长（分钟）
     */
    @JsonProperty("work_minutes")
    @Builder.Default
    private int workMinutes = 60;

    /**
     * 工序提示
     */
    @JsonProperty("process_hint")
    private String processHint;

    /**
     * 创建单帧效率分析请求
     */
    public static EfficiencyAnalysisRequest forEfficiencyAnalysis(
            String imageBase64, String cameraId, String location) {
        return EfficiencyAnalysisRequest.builder()
                .imageBase64(imageBase64)
                .analysisTypes(List.of("efficiency"))
                .cameraId(cameraId)
                .location(location)
                .build();
    }

    /**
     * 创建混合分析请求（效率+OCR+计数）
     */
    public static EfficiencyAnalysisRequest forMixedAnalysis(
            String imageBase64, String cameraId, String location) {
        return EfficiencyAnalysisRequest.builder()
                .imageBase64(imageBase64)
                .analysisTypes(List.of("efficiency", "ocr", "counting"))
                .cameraId(cameraId)
                .location(location)
                .build();
    }
}
