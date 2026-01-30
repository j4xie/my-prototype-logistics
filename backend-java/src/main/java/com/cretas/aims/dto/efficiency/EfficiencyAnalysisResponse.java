package com.cretas.aims.dto.efficiency;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 效率分析响应 DTO
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencyAnalysisResponse {

    private boolean success;
    private String timestamp;

    @JsonProperty("analysis_types")
    private List<String> analysisTypes;

    private Map<String, Object> results;
    private String error;

    // ==================== 便捷访问方法 ====================

    /**
     * 获取效率分析结果
     */
    @SuppressWarnings("unchecked")
    public EfficiencyResult getEfficiencyResult() {
        if (results == null || !results.containsKey("efficiency")) {
            return null;
        }
        Map<String, Object> effData = (Map<String, Object>) results.get("efficiency");
        return EfficiencyResult.fromMap(effData);
    }

    /**
     * 获取OCR结果
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getOcrResult() {
        if (results == null) return null;
        return (Map<String, Object>) results.get("ocr");
    }

    /**
     * 获取计数结果
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getCountingResult() {
        if (results == null) return null;
        return (Map<String, Object>) results.get("counting");
    }

    // ==================== 内嵌类 ====================

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EfficiencyResult {
        @JsonProperty("worker_count")
        private int workerCount;

        @JsonProperty("active_workers")
        private int activeWorkers;

        @JsonProperty("idle_workers")
        private int idleWorkers;

        @JsonProperty("completed_actions")
        private int completedActions;

        @JsonProperty("process_stage")
        private String processStage;

        @JsonProperty("efficiency_score")
        private double efficiencyScore;

        @JsonProperty("safety_issues")
        private List<String> safetyIssues;

        @JsonProperty("scene_description")
        private String sceneDescription;

        private List<WorkerInfo> workers;

        @SuppressWarnings("unchecked")
        public static EfficiencyResult fromMap(Map<String, Object> map) {
            if (map == null) return null;

            return EfficiencyResult.builder()
                    .workerCount(getInt(map, "worker_count"))
                    .activeWorkers(getInt(map, "active_workers"))
                    .idleWorkers(getInt(map, "idle_workers"))
                    .completedActions(getInt(map, "completed_actions"))
                    .processStage((String) map.get("process_stage"))
                    .efficiencyScore(getDouble(map, "efficiency_score"))
                    .safetyIssues((List<String>) map.get("safety_issues"))
                    .sceneDescription((String) map.get("scene_description"))
                    .build();
        }

        private static int getInt(Map<String, Object> map, String key) {
            Object val = map.get(key);
            if (val instanceof Number) {
                return ((Number) val).intValue();
            }
            return 0;
        }

        private static double getDouble(Map<String, Object> map, String key) {
            Object val = map.get(key);
            if (val instanceof Number) {
                return ((Number) val).doubleValue();
            }
            return 0.0;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkerInfo {
        private String position;
        private String status;
        private String action;
        @JsonProperty("safety_gear")
        private Map<String, Boolean> safetyGear;
        private double confidence;
    }
}
