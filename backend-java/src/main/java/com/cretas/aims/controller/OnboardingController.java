package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.onboarding.CreateFactoryFromSurveyRequest;
import com.cretas.aims.dto.platform.CreateFactoryRequest;
import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.AlertThreshold;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.FactoryFeatureConfig;
import com.cretas.aims.repository.AlertThresholdRepository;
import com.cretas.aims.repository.FactoryFeatureConfigRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.FactoryService;
import com.cretas.aims.service.FieldVisibilityService;
import com.cretas.aims.service.FormTemplateService;
import com.cretas.aims.service.UserService;
import com.cretas.aims.util.ErrorSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Internal onboarding endpoint called by Python wizard service.
 * Creates factory + users + feature configs + form templates + alerts.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final FactoryService factoryService;
    private final FactoryRepository factoryRepository;
    private final UserService userService;
    private final FieldVisibilityService fieldVisibilityService;
    private final FormTemplateService formTemplateService;
    private final FactoryFeatureConfigRepository featureConfigRepository;
    private final AlertThresholdRepository alertThresholdRepository;

    @Value("${internal.api.key:cretas-internal-2026}")
    private String internalApiKey;

    @Transactional
    @PostMapping("/create-factory")
    public ApiResponse<Map<String, Object>> createFactoryFromSurvey(
            @RequestHeader(value = "X-Internal-Key", required = false) String apiKey,
            @RequestBody CreateFactoryFromSurveyRequest request) {

        // Validate internal API key
        if (apiKey == null || !apiKey.equals(internalApiKey)) {
            return ApiResponse.error(403, "Invalid internal API key");
        }

        try {
            log.info("Onboarding: creating factory '{}' from survey company '{}'",
                    request.getFactoryName(), request.getSurveyCompanyId());

            // Step 1: Create factory
            CreateFactoryRequest factoryRequest = CreateFactoryRequest.builder()
                    .name(request.getFactoryName())
                    .industryCode(request.getIndustryCode() != null ? request.getIndustryCode() : "OTHER")
                    .regionCode(request.getRegionCode() != null ? request.getRegionCode() : "3101")
                    .contactName(request.getContactName())
                    .contactPhone(request.getContactPhone())
                    .subscriptionPlan("BASIC")
                    .aiWeeklyQuota(50)
                    .isActive(true)
                    .build();

            var factoryDTO = factoryService.createFactory(factoryRequest);
            String factoryId = factoryDTO.getId();
            log.info("Onboarding: factory created with ID '{}'", factoryId);

            // Step 2: Set surveyCompanyId on factory
            factoryRepository.findById(factoryId).ifPresent(factory -> {
                factory.setSurveyCompanyId(request.getSurveyCompanyId());
                factoryRepository.save(factory);
            });

            // Step 3: Recompute field visibility
            try {
                fieldVisibilityService.recomputeVisibility(factoryId);
                log.info("Onboarding: field visibility recomputed for '{}'", factoryId);
            } catch (Exception e) {
                log.warn("Onboarding: visibility recompute failed (non-fatal): {}", e.getMessage());
            }

            // Step 4: Provision default users
            List<UserDTO> users = Collections.emptyList();
            try {
                users = userService.provisionDefaultUsers(factoryId);
                log.info("Onboarding: {} default users created", users.size());
            } catch (Exception e) {
                log.warn("Onboarding: user provisioning failed (non-fatal): {}", e.getMessage());
            }

            // Step 5: Save factory_feature_config rows
            int configCount = 0;
            if (request.getModuleConfigs() != null) {
                for (var mc : request.getModuleConfigs()) {
                    try {
                        FactoryFeatureConfig config = FactoryFeatureConfig.builder()
                                .factoryId(factoryId)
                                .moduleId(mc.getModuleId())
                                .moduleName(mc.getModuleName() != null ? mc.getModuleName() : mc.getModuleId())
                                .enabled(mc.isEnabled())
                                .config(mc.getConfig() != null ? new HashMap<>(mc.getConfig()) : new HashMap<>())
                                .build();
                        featureConfigRepository.save(config);
                        configCount++;
                    } catch (Exception e) {
                        log.warn("Onboarding: failed to save feature config for module '{}': {}",
                                mc.getModuleId(), e.getMessage());
                    }
                }
                log.info("Onboarding: {} feature configs saved", configCount);
            }

            // Step 6: Write FormTemplate for each entity type
            int formTemplateCount = 0;
            if (request.getFormSchemas() != null) {
                for (var entry : request.getFormSchemas().entrySet()) {
                    try {
                        String entityType = entry.getKey();
                        String schemaJson = entry.getValue();
                        formTemplateService.createOrUpdate(
                                factoryId, entityType,
                                entityType + " (AI Generated)",
                                schemaJson, null);
                        formTemplateCount++;
                    } catch (Exception e) {
                        log.warn("Onboarding: failed to save form template for '{}': {}",
                                entry.getKey(), e.getMessage());
                    }
                }
                log.info("Onboarding: {} form templates saved", formTemplateCount);
            }

            // Step 7: Create AlertThreshold entries
            int alertCount = 0;
            if (request.getAlertThresholds() != null) {
                for (var at : request.getAlertThresholds()) {
                    try {
                        AlertThreshold threshold = AlertThreshold.builder()
                                .factoryId(factoryId)
                                .metricName(at.getMetric())
                                .alertType(at.getMetric())
                                .level(at.getSeverity() != null ? at.getSeverity() : "WARNING")
                                .comparison("LESS_THAN")
                                .staticThreshold(at.getThreshold())
                                .enabled(true)
                                .description("AI onboarding auto-configured")
                                .build();
                        alertThresholdRepository.save(threshold);
                        alertCount++;
                    } catch (Exception e) {
                        log.warn("Onboarding: failed to save alert threshold for '{}': {}",
                                at.getMetric(), e.getMessage());
                    }
                }
                log.info("Onboarding: {} alert thresholds saved", alertCount);
            }

            // Build response
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("factoryId", factoryId);
            result.put("users", users);
            result.put("formTemplatesCreated", formTemplateCount);
            result.put("featureConfigsCreated", configCount);
            result.put("alertsCreated", alertCount);

            return ApiResponse.success("工厂入驻成功", result);

        } catch (Exception e) {
            log.error("Onboarding failed: {}", e.getMessage(), e);
            return ApiResponse.error("工厂入驻失败: " + ErrorSanitizer.sanitize(e));
        }
    }

}
