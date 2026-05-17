package com.cretas.aims.controller;

import com.cretas.aims.dto.user.UserDTO;
import com.cretas.aims.entity.Factory;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.service.FieldVisibilityService;
import com.cretas.aims.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * Field visibility controller — read-mostly; mutating endpoints (recompute,
 * link-survey-company) restricted to admin roles per Issue #718 (2026-05-17).
 * Previously any auth factory user could trigger schema-level recompute or
 * link factory to arbitrary survey company.
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}")
public class FieldVisibilityController {

    private static final Logger log = LoggerFactory.getLogger(FieldVisibilityController.class);

    @Autowired
    private FieldVisibilityService fieldVisibilityService;

    @Autowired
    private FactoryRepository factoryRepository;

    @Autowired
    private UserService userService;

    @GetMapping("/field-visibility")
    public ResponseEntity<?> getFieldVisibility(@PathVariable String factoryId) {
        try {
            Map<String, List<String>> hiddenFields = fieldVisibilityService.getHiddenFields(factoryId);
            return ResponseEntity.ok(Map.of("success", true, "data", hiddenFields));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }

    /**
     * Issue #718 audit (2026-05-17): isPublicEndpoint() classifies this as
     * Python→Java internal call (JwtAuthInterceptor:228), so @RequireRole would
     * NOT fire even if added. Real protection lives at NetworkSecurityGroup —
     * /field-visibility/recompute should only be reachable from VPC internal IPs.
     * Followup: convert to /api/internal/* path with X-Internal-Key (BB).
     */
    @PostMapping("/field-visibility/recompute")
    public ResponseEntity<?> recomputeVisibility(@PathVariable String factoryId) {
        try {
            fieldVisibilityService.recomputeVisibility(factoryId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Visibility recomputed"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }

    /**
     * Issue #718 audit (2026-05-17): isPublicEndpoint() classifies this as
     * Python→Java internal call (JwtAuthInterceptor:227), so @RequireRole would
     * NOT fire even if added. Real protection lives at NetworkSecurityGroup —
     * /link-survey-company should only be reachable from VPC internal IPs.
     * Followup: convert to /api/internal/* path with X-Internal-Key (BB).
     */
    @PostMapping("/link-survey-company")
    public ResponseEntity<?> linkSurveyCompany(
            @PathVariable String factoryId,
            @RequestBody Map<String, String> body) {
        try {
            String companyId = body.get("companyId");
            if (companyId == null || companyId.isBlank()) {
                return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "companyId is required"));
            }

            Optional<Factory> factoryOpt = factoryRepository.findById(factoryId);
            if (factoryOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "Factory not found: " + factoryId));
            }

            Factory factory = factoryOpt.get();
            factory.setSurveyCompanyId(companyId);
            factoryRepository.save(factory);

            // Trigger visibility recompute
            fieldVisibilityService.recomputeVisibility(factoryId);

            // Auto-provision default users for the factory
            List<UserDTO> provisionedUsers = userService.provisionDefaultUsers(factoryId);
            if (!provisionedUsers.isEmpty()) {
                log.info("Auto-provisioned {} users for factory {}", provisionedUsers.size(), factoryId);
            }

            log.info("Linked factory {} to survey company {}", factoryId, companyId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Linked successfully"));
        } catch (Exception e) {
            log.error("Failed to link survey company for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }

    @GetMapping("/field-null-counts/{entityType}")
    public ResponseEntity<?> getFieldNullCounts(
            @PathVariable String factoryId,
            @PathVariable String entityType) {
        try {
            Map<String, Double> nullRates = fieldVisibilityService.getFieldNullCounts(factoryId, entityType);
            return ResponseEntity.ok(Map.of("success", true, "data", nullRates));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }
}
