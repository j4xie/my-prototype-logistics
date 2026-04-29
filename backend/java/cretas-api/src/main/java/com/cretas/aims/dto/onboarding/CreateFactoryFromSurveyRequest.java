package com.cretas.aims.dto.onboarding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Size;
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
    @Size(max = 200, message = "工厂名称长度不能超过200个字符")
    private String factoryName;
    @Size(max = 100, message = "联系人长度不能超过100个字符")
    private String contactName;
    @Size(max = 20, message = "联系电话长度不能超过20个字符")
    private String contactPhone;
    @Size(max = 50, message = "行业代码长度不能超过50个字符")
    private String industryCode;
    @Size(max = 50, message = "地区代码长度不能超过50个字符")
    private String regionCode;

    // Survey linkage
    @Size(max = 191, message = "问卷ID长度不能超过191个字符")
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
