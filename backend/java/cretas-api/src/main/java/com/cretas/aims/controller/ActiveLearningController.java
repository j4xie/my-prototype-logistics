package com.cretas.aims.controller;

import com.cretas.aims.entity.learning.*;
import com.cretas.aims.scheduler.ActiveLearningScheduler;
import com.cretas.aims.service.ActiveLearningService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Active Learning Controller
 *
 * Provides REST API endpoints for managing the active learning system:
 * - View and manage learning suggestions
 * - Monitor model performance
 * - Manage annotation queue
 * - Trigger manual learning tasks
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/ai/active-learning")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ActiveLearningController {

    private final ActiveLearningService activeLearningService;
    private final ActiveLearningScheduler activeLearningScheduler;

    // ==================== Suggestions ====================

    /**
     * Get pending learning suggestions
     */
    @GetMapping("/suggestions")
    public ResponseEntity<Map<String, Object>> getPendingSuggestions(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "20") int limit) {

        List<LearningSuggestion> suggestions = activeLearningService
                .getPendingSuggestions(factoryId, limit);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", suggestions);
        response.put("total", suggestions.size());

        return ResponseEntity.ok(response);
    }

    /**
     * Approve a learning suggestion
     */
    @PostMapping("/suggestions/{suggestionId}/approve")
    public ResponseEntity<Map<String, Object>> approveSuggestion(
            @PathVariable String factoryId,
            @PathVariable Long suggestionId,
            @RequestParam String reviewer,
            @RequestParam(required = false) String notes) {

        activeLearningService.approveSuggestion(suggestionId, reviewer, notes);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Suggestion approved successfully");

        return ResponseEntity.ok(response);
    }

    /**
     * Reject a learning suggestion
     */
    @PostMapping("/suggestions/{suggestionId}/reject")
    public ResponseEntity<Map<String, Object>> rejectSuggestion(
            @PathVariable String factoryId,
            @PathVariable Long suggestionId,
            @RequestParam String reviewer,
            @RequestParam String reason) {

        activeLearningService.rejectSuggestion(suggestionId, reviewer, reason);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Suggestion rejected");

        return ResponseEntity.ok(response);
    }

    /**
     * Apply an approved suggestion
     */
    @PostMapping("/suggestions/{suggestionId}/apply")
    public ResponseEntity<Map<String, Object>> applySuggestion(
            @PathVariable String factoryId,
            @PathVariable Long suggestionId,
            @RequestParam String applier) {

        activeLearningService.applySuggestion(suggestionId, applier);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Suggestion applied successfully");

        return ResponseEntity.ok(response);
    }

    // ==================== Performance Monitoring ====================

    /**
     * Get model performance trend
     */
    @GetMapping("/performance")
    public ResponseEntity<Map<String, Object>> getPerformanceTrend(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "DAILY") ModelPerformanceLog.PeriodType periodType,
            @RequestParam(defaultValue = "30") int days) {

        List<ModelPerformanceLog> trend = activeLearningService
                .getPerformanceTrend(factoryId, periodType, days);

        boolean isDegrading = activeLearningService.isPerformanceDegrading(factoryId, 0.05);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", trend);
        response.put("isDegrading", isDegrading);
        response.put("periodType", periodType);
        response.put("days", days);

        return ResponseEntity.ok(response);
    }

    // ==================== Cross-Factory Knowledge ====================

    /**
     * Get available global knowledge for adoption
     */
    @GetMapping("/knowledge/available")
    public ResponseEntity<Map<String, Object>> getAvailableKnowledge(
            @PathVariable String factoryId) {

        List<CrossFactoryKnowledge> available = activeLearningService
                .getAvailableGlobalKnowledge(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", available);
        response.put("total", available.size());

        return ResponseEntity.ok(response);
    }

    /**
     * Adopt global knowledge
     */
    @PostMapping("/knowledge/{knowledgeId}/adopt")
    public ResponseEntity<Map<String, Object>> adoptKnowledge(
            @PathVariable String factoryId,
            @PathVariable Long knowledgeId) {

        CrossFactoryKnowledgeAdoption adoption = activeLearningService
                .adoptKnowledge(factoryId, knowledgeId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", adoption);
        response.put("message", "Knowledge adopted successfully");

        return ResponseEntity.ok(response);
    }

    /**
     * Record feedback for knowledge
     */
    @PostMapping("/knowledge/{knowledgeId}/feedback")
    public ResponseEntity<Map<String, Object>> recordKnowledgeFeedback(
            @PathVariable String factoryId,
            @PathVariable Long knowledgeId,
            @RequestParam boolean isPositive) {

        activeLearningService.recordKnowledgeFeedback(knowledgeId, factoryId, isPositive);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Feedback recorded");

        return ResponseEntity.ok(response);
    }

    /**
     * Get keyword effectiveness evaluation
     */
    @GetMapping("/keywords/effectiveness")
    public ResponseEntity<Map<String, Object>> getKeywordEffectiveness(
            @PathVariable String factoryId) {

        Map<String, BigDecimal> effectiveness = activeLearningService
                .evaluateKeywordEffectiveness(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", effectiveness);
        response.put("total", effectiveness.size());

        return ResponseEntity.ok(response);
    }

    // ==================== Annotation Queue ====================

    /**
     * Assign annotations to an annotator
     */
    @PostMapping("/annotations/assign")
    public ResponseEntity<Map<String, Object>> assignAnnotations(
            @PathVariable String factoryId,
            @RequestParam String annotator,
            @RequestParam(defaultValue = "10") int count) {

        List<AnnotationQueue> assigned = activeLearningService
                .assignAnnotations(factoryId, annotator, count);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", assigned);
        response.put("assigned", assigned.size());

        return ResponseEntity.ok(response);
    }

    /**
     * Complete an annotation
     */
    @PostMapping("/annotations/{annotationId}/complete")
    public ResponseEntity<Map<String, Object>> completeAnnotation(
            @PathVariable String factoryId,
            @PathVariable Long annotationId,
            @RequestParam String intentCode,
            @RequestParam String annotator,
            @RequestParam(required = false) String notes) {

        activeLearningService.completeAnnotation(annotationId, intentCode, annotator, notes);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Annotation completed");

        return ResponseEntity.ok(response);
    }

    // ==================== Intent Transitions ====================

    /**
     * Get most likely next intents from a given intent
     */
    @GetMapping("/transitions/{fromIntent}/next")
    public ResponseEntity<Map<String, Object>> getMostLikelyNextIntents(
            @PathVariable String factoryId,
            @PathVariable String fromIntent,
            @RequestParam(defaultValue = "5") int topN) {

        List<Map.Entry<String, BigDecimal>> nextIntents = activeLearningService
                .getMostLikelyNextIntents(factoryId, fromIntent, topN);

        // Convert to list of maps for JSON serialization
        List<Map<String, Object>> results = nextIntents.stream()
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("intentCode", e.getKey());
                    m.put("probability", e.getValue());
                    return m;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("fromIntent", fromIntent);
        response.put("data", results);

        return ResponseEntity.ok(response);
    }

    // ==================== Manual Triggers ====================

    /**
     * Trigger sample analysis manually
     */
    @PostMapping("/trigger/analyze-samples")
    public ResponseEntity<Map<String, Object>> triggerSampleAnalysis(
            @PathVariable String factoryId) {

        int suggestions = activeLearningScheduler.triggerSampleAnalysis(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Sample analysis completed");
        response.put("suggestionsGenerated", suggestions);

        return ResponseEntity.ok(response);
    }

    /**
     * Trigger transition matrix update manually
     */
    @PostMapping("/trigger/update-transitions")
    public ResponseEntity<Map<String, Object>> triggerTransitionUpdate(
            @PathVariable String factoryId) {

        activeLearningScheduler.triggerTransitionMatrixUpdate(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Transition matrix updated");

        return ResponseEntity.ok(response);
    }

    /**
     * Trigger knowledge promotion check
     */
    @PostMapping("/trigger/promote-knowledge")
    public ResponseEntity<Map<String, Object>> triggerKnowledgePromotion(
            @PathVariable String factoryId) {

        int promoted = activeLearningScheduler.triggerKnowledgePromotion();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Knowledge promotion check completed");
        response.put("promotedCount", promoted);

        return ResponseEntity.ok(response);
    }

    // ==================== Statistics ====================

    /**
     * Get active learning statistics overview
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStatistics(
            @PathVariable String factoryId) {

        List<LearningSuggestion> pendingSuggestions = activeLearningService
                .getPendingSuggestions(factoryId, 100);
        List<CrossFactoryKnowledge> availableKnowledge = activeLearningService
                .getAvailableGlobalKnowledge(factoryId);
        Map<String, BigDecimal> keywordEffectiveness = activeLearningService
                .evaluateKeywordEffectiveness(factoryId);
        boolean isDegrading = activeLearningService.isPerformanceDegrading(factoryId, 0.05);

        Map<String, Object> stats = new HashMap<>();
        stats.put("pendingSuggestions", pendingSuggestions.size());
        stats.put("availableGlobalKnowledge", availableKnowledge.size());
        stats.put("trackedKeywords", keywordEffectiveness.size());
        stats.put("performanceDegrading", isDegrading);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", stats);

        return ResponseEntity.ok(response);
    }
}
