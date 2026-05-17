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
 * Internal-only mutating endpoints for field visibility — Issue #789 follow-up to PR #785 / #718.
 *
 * <p>Previously these endpoints lived under {@code /api/mobile/{factoryId}/...} with
 * {@code isPublicEndpoint()} carve-outs in {@code JwtAuthInterceptor:227-228}, meaning
 * any unauthenticated client could trigger:
 * <ul>
 *   <li>{@code POST /field-visibility/recompute} — schema-level recompute</li>
 *   <li>{@code POST /link-survey-company} — re-link factory to arbitrary survey company</li>
 * </ul>
 *
 * <p>Now moved under {@code /api/internal/*} which {@code JwtAuthInterceptor:155} enforces
 * with {@code X-Internal-Key} header check (env var {@code INTERNAL_API_SECRET}). The
 * Python wizard backend at {@code backend/python/client_requirement/wizard_api.py} is
 * the only legitimate caller and sends the header. External clients without the secret
 * receive HTTP 403.
 *
 * @author Cretas Team
 * @since 2026-05-17 (Issue #789)
 */
@RestController
@RequestMapping("/api/internal/field-visibility")
public class InternalFieldVisibilityController {

    private static final Logger log = LoggerFactory.getLogger(InternalFieldVisibilityController.class);

    @Autowired
    private FieldVisibilityService fieldVisibilityService;

    @Autowired
    private FactoryRepository factoryRepository;

    @Autowired
    private UserService userService;

    /**
     * Trigger schema-level visibility recompute for a factory. Called by Python wizard
     * backend after survey company answers persisted (wizard_api.py:185-196).
     */
    @PostMapping("/{factoryId}/recompute")
    public ResponseEntity<?> recomputeVisibility(@PathVariable String factoryId) {
        try {
            fieldVisibilityService.recomputeVisibility(factoryId);
            log.info("[internal] Visibility recomputed for factory {}", factoryId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Visibility recomputed"));
        } catch (Exception e) {
            log.error("[internal] Visibility recompute failed for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }

    /**
     * Link a survey company to a factory + auto-provision default users + trigger
     * visibility recompute. Called by Python wizard backend on link-factory flow
     * (wizard_api.py:746-758).
     */
    @PostMapping("/{factoryId}/link-survey-company")
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
                log.info("[internal] Auto-provisioned {} users for factory {}",
                        provisionedUsers.size(), factoryId);
            }

            log.info("[internal] Linked factory {} to survey company {}", factoryId, companyId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Linked successfully"));
        } catch (Exception e) {
            log.error("[internal] Failed to link survey company for factory {}", factoryId, e);
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", ErrorSanitizer.sanitize(e))
            );
        }
    }
}
