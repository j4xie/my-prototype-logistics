package com.cretas.aims.dto.intent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.DecimalMax;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Size;
import java.util.List;

/**
 * LLM 意图分类响应 DTO（软 Schema 验证）
 *
 * 设计原则：
 * - 使用 @JsonIgnoreProperties(ignoreUnknown = true) 容错未知字段
 * - 所有字段提供默认值，防止 NPE
 * - 置信度自动 clamp 到 [0.0, 1.0] 范围
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)  // 软验证：忽略未知字段
public class LlmIntentClassifyResponse {

    /**
     * 响应状态
     */
    @Builder.Default
    private Boolean success = false;

    /**
     * 匹配的意图代码
     * 软验证：不强制大写格式，由业务层处理
     */
    @JsonProperty("matched_intent_code")
    @Builder.Default
    private String matchedIntentCode = "UNKNOWN";

    /**
     * 置信度 [0.0, 1.0]
     * 软验证：超出范围会被 clamp
     */
    @DecimalMin("0.0")
    @DecimalMax("1.0")
    @Builder.Default
    private Double confidence = 0.5;

    /**
     * LLM 推理过程说明
     */
    @Size(max = 1000)
    private String reasoning;

    /**
     * 其他候选意图
     */
    @JsonProperty("other_candidates")
    @Size(max = 5)
    private List<CandidateResponse> otherCandidates;

    /**
     * 备用字段名（兼容不同 Python 端返回格式）
     */
    private List<CandidateResponse> candidates;

    /**
     * 错误消息（当 success=false 时）
     */
    private String message;

    /**
     * 嵌套的 data 字段（兼容包装格式）
     */
    private LlmIntentClassifyResponse data;

    /**
     * 安全获取置信度（自动 clamp 到 [0.0, 1.0]）
     */
    public Double getSafeConfidence() {
        if (confidence == null) {
            return 0.5;
        }
        return Math.max(0.0, Math.min(1.0, confidence));
    }

    /**
     * 安全获取意图代码（处理 null 和空值）
     */
    public String getSafeIntentCode() {
        if (matchedIntentCode == null || matchedIntentCode.trim().isEmpty()) {
            return "UNKNOWN";
        }
        return matchedIntentCode.trim().toUpperCase();
    }

    /**
     * 合并候选意图列表（兼容两种字段名）
     */
    public List<CandidateResponse> getMergedCandidates() {
        if (otherCandidates != null && !otherCandidates.isEmpty()) {
            return otherCandidates;
        }
        return candidates;
    }

    /**
     * 获取实际数据（处理 data 包装）
     */
    public LlmIntentClassifyResponse getActualData() {
        if (data != null) {
            return data;
        }
        return this;
    }

    /**
     * 候选意图响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CandidateResponse {

        @JsonProperty("intent_code")
        private String intentCode;

        @JsonProperty("intent_name")
        private String intentName;

        private String description;

        @Builder.Default
        private Double confidence = 0.0;

        /**
         * 安全获取置信度
         */
        public Double getSafeConfidence() {
            if (confidence == null) {
                return 0.0;
            }
            return Math.max(0.0, Math.min(1.0, confidence));
        }
    }
}
