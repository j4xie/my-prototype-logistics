package com.cretas.aims.dto.onboarding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request DTO for creating a factory from the AI onboarding wizard.
 * Called by Python service after AI assessment is complete.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateFactoryFromSurveyRequest {

    // Basic info
    private String factoryName;
    private String contactName;
    private String contactPhone;
    private String industryCode;
    private String regionCode;

    // Survey linkage
    private String surveyCompanyId;

    // Module configs (from AI assessment)
    private List<ModuleConfigDTO> moduleConfigs;

    // Form schemas (entityType -> Formily JSON Schema string)
    private Map<String, String> formSchemas;

    // Stage templates
    private List<StageTemplateDTO> stageTemplates;

    // Alert thresholds
    private List<AlertThresholdDTO> alertThresholds;

    // Analysis config
    private List<String> analysisDimensions;
    private Map<String, Object> benchmarks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleConfigDTO {
        private String moduleId;
        private String moduleName;
        private boolean enabled;
        private Map<String, Object> config;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StageTemplateDTO {
        private String stageName;
        private String displayName;
        private int order;
        private boolean isKey;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AlertThresholdDTO {
        private String metric;
        private double threshold;
        private String severity;
    }
}
