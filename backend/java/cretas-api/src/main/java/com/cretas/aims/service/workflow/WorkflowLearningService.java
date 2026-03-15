package com.cretas.aims.service.workflow;

import com.cretas.aims.entity.rules.StateMachine;
import com.cretas.aims.repository.StateMachineRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Workflow Learning Service
 *
 * Analyzes published workflow configurations to:
 * 1. Extract pattern features for knowledge base indexing
 * 2. Detect similar configurations across factories
 * 3. Auto-generate workflow templates when similarity threshold is met
 *
 * Designed as a post-publish hook — called after StateMachine publish succeeds.
 * Knowledge base ingestion is via the existing food_kb Python RAG pipeline
 * (category = "workflow_config", subcategory = "published_config").
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowLearningService {

    private final StateMachineRepository stateMachineRepository;
    private final ObjectMapper objectMapper;

    /**
     * Called after a workflow is published. Extracts pattern features
     * and prepares a knowledge document for RAG ingestion.
     *
     * @return knowledge document text suitable for embedding + indexing
     */
    public Map<String, Object> analyzeAndIndex(StateMachine published) {
        try {
            List<Map<String, Object>> states = objectMapper.readValue(
                    published.getStatesJson(),
                    new TypeReference<List<Map<String, Object>>>() {});
            List<Map<String, Object>> transitions = objectMapper.readValue(
                    published.getTransitionsJson(),
                    new TypeReference<List<Map<String, Object>>>() {});

            // Extract pattern features
            Map<String, Object> features = new LinkedHashMap<>();
            features.put("factoryId", published.getFactoryId());
            features.put("entityType", published.getEntityType());
            features.put("version", published.getVersion());
            features.put("stateCount", states.size());
            features.put("transitionCount", transitions.size());
            features.put("stateCodes", states.stream()
                    .map(s -> s.getOrDefault("code", "").toString())
                    .collect(Collectors.toList()));
            features.put("hasSupplementing", states.stream()
                    .anyMatch(s -> "supplementing".equals(s.get("code"))));
            features.put("hasQualityCheck", states.stream()
                    .anyMatch(s -> s.getOrDefault("code", "").toString().contains("quality")));

            // Count guards and actions
            long guardCount = transitions.stream()
                    .filter(t -> t.get("guard") != null && !t.get("guard").toString().isEmpty())
                    .count();
            long actionCount = transitions.stream()
                    .filter(t -> t.get("action") != null && !t.get("action").toString().isEmpty())
                    .count();
            features.put("guardCount", guardCount);
            features.put("actionCount", actionCount);

            // Build knowledge document text
            StringBuilder doc = new StringBuilder();
            doc.append("工厂 ").append(published.getFactoryId())
               .append(" 的 ").append(published.getEntityType())
               .append(" 工作流 v").append(published.getVersion()).append(":\n");
            doc.append("状态: ").append(states.stream()
                    .map(s -> s.getOrDefault("name", s.get("code")).toString())
                    .collect(Collectors.joining(" → "))).append("\n");
            doc.append("转换数: ").append(transitions.size()).append(", ");
            doc.append("守卫条件: ").append(guardCount).append(", ");
            doc.append("动作: ").append(actionCount).append("\n");

            if ((boolean) features.get("hasSupplementing")) {
                doc.append("特征: 包含补报(SUPPLEMENTING)流程\n");
            }
            if ((boolean) features.get("hasQualityCheck")) {
                doc.append("特征: 包含质检环节\n");
            }

            features.put("knowledgeDocument", doc.toString());

            log.info("工作流配置分析完成 - factoryId: {}, entityType: {}, states: {}, transitions: {}",
                    published.getFactoryId(), published.getEntityType(),
                    states.size(), transitions.size());

            return features;

        } catch (Exception e) {
            log.error("工作流配置分析失败", e);
            return Map.of("error", e.getMessage());
        }
    }

    /**
     * Find published workflows with similar structure (state count, transition count, key states).
     * Used for template auto-generation when similarity threshold is met.
     *
     * @return list of similar factory IDs and their similarity scores
     */
    public List<Map<String, Object>> findSimilarWorkflows(String factoryId, String entityType) {
        List<Map<String, Object>> results = new ArrayList<>();

        try {
            // Get all published workflows of the same entity type
            List<StateMachine> allPublished = stateMachineRepository
                    .findAll().stream()
                    .filter(sm -> entityType.equals(sm.getEntityType())
                            && "published".equals(sm.getPublishStatus())
                            && !factoryId.equals(sm.getFactoryId()))
                    .collect(Collectors.toList());

            // Get reference workflow
            Optional<StateMachine> reference = stateMachineRepository
                    .findByFactoryIdAndEntityTypeAndPublishStatus(factoryId, entityType, "published");

            if (reference.isEmpty() || allPublished.isEmpty()) {
                return results;
            }

            Map<String, Object> refFeatures = analyzeAndIndex(reference.get());
            List<String> refStates = (List<String>) refFeatures.get("stateCodes");

            for (StateMachine other : allPublished) {
                Map<String, Object> otherFeatures = analyzeAndIndex(other);
                List<String> otherStates = (List<String>) otherFeatures.get("stateCodes");

                // Jaccard similarity on state codes
                Set<String> union = new HashSet<>(refStates);
                union.addAll(otherStates);
                Set<String> intersection = new HashSet<>(refStates);
                intersection.retainAll(otherStates);

                double similarity = union.isEmpty() ? 0 : (double) intersection.size() / union.size();

                if (similarity >= 0.5) {
                    results.add(Map.of(
                            "factoryId", other.getFactoryId(),
                            "similarity", Math.round(similarity * 100),
                            "stateCount", otherStates.size()
                    ));
                }
            }

            results.sort((a, b) -> (int) b.get("similarity") - (int) a.get("similarity"));

        } catch (Exception e) {
            log.error("查找相似工作流失败", e);
        }

        return results;
    }
}
