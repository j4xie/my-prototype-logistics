package com.cretas.aims.controller;

import com.cretas.aims.service.FieldVisibilityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * Field visibility read endpoints — JWT-protected via standard /api/mobile/* path.
 *
 * <p>Issue #789 follow-up to PR #785 / #718 (2026-05-17): mutating endpoints
 * ({@code recompute}, {@code link-survey-company}) have been moved to
 * {@link InternalFieldVisibilityController} under {@code /api/internal/field-visibility/*}
 * which {@code JwtAuthInterceptor:155} enforces with {@code X-Internal-Key} header check.
 * The previous {@code isPublicEndpoint()} carve-outs that allowed unauthenticated callers
 * to trigger schema-level recompute / re-link survey company are gone.
 *
 * <p>Read endpoints (GET) remain here under the standard JWT-protected factory path —
 * those are called from the web admin frontend.
 *
 * @author Cretas Team
 * @since 2026-05-17 (Issue #789 split — write endpoints extracted to InternalFieldVisibilityController)
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}")
public class FieldVisibilityController {

    private static final Logger log = LoggerFactory.getLogger(FieldVisibilityController.class);

    @Autowired
    private FieldVisibilityService fieldVisibilityService;

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
