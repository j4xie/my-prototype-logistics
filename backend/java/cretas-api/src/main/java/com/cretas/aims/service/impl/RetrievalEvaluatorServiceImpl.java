package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.RetrievalQualityScore;
import com.cretas.aims.service.RetrievalEvaluatorService;
import com.cretas.aims.service.EmbeddingClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 检索评估服务实现 (CRAG)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetrievalEvaluatorServiceImpl implements RetrievalEvaluatorService {

    private final EmbeddingClient embeddingClient;

    // 相关性阈值
    private static final double CORRECT_THRESHOLD = 0.8;
    private static final double AMBIGUOUS_THRESHOLD = 0.5;

    @Override
    public RetrievalQualityScore evaluateRetrieval(String query, List<Map<String, Object>> retrievalResults) {
        if (retrievalResults == null || retrievalResults.isEmpty()) {
            log.debug("检索结果为空，返回 INCORRECT");
            return RetrievalQualityScore.INCORRECT;
        }

        // 计算所有结果的平均相关性
        double avgRelevance = retrievalResults.stream()
                .mapToDouble(result -> calculateRelevanceScore(query, result))
                .average()
                .orElse(0.0);

        RetrievalQualityScore score = RetrievalQualityScore.fromScore(avgRelevance);

        log.debug("检索评估完成: query='{}', resultCount={}, avgRelevance={:.3f}, score={}",
                query.length() > 30 ? query.substring(0, 30) + "..." : query,
                retrievalResults.size(), avgRelevance, score);

        return score;
    }

    @Override
    public double calculateRelevanceScore(String query, Map<String, Object> result) {
        try {
            // 获取检索结果的内容
            String content = extractContent(result);
            if (content == null || content.isEmpty()) {
                return 0.0;
            }

            // 使用 embedding 计算语义相似度
            float[] queryEmbedding = embeddingClient.encode(query);
            float[] contentEmbedding = embeddingClient.encode(content);

            return cosineSimilarity(queryEmbedding, contentEmbedding);

        } catch (Exception e) {
            log.warn("计算相关性分数失败: {}", e.getMessage());
            // 降级到关键词匹配
            return calculateKeywordRelevance(query, result);
        }
    }

    @Override
    public List<String> decomposeToKnowledgeStrips(String content) {
        if (content == null || content.isEmpty()) {
            return Collections.emptyList();
        }

        // 按段落和句子分解
        List<String> strips = new ArrayList<>();

        // 先按段落分割
        String[] paragraphs = content.split("\n\n+");
        for (String paragraph : paragraphs) {
            String trimmed = paragraph.trim();
            if (trimmed.length() > 200) {
                // 长段落按句子分割
                String[] sentences = trimmed.split("[。！？；]");
                for (String sentence : sentences) {
                    String s = sentence.trim();
                    if (!s.isEmpty() && s.length() > 10) {
                        strips.add(s);
                    }
                }
            } else if (trimmed.length() > 10) {
                strips.add(trimmed);
            }
        }

        log.debug("知识分解完成: contentLength={}, stripsCount={}", content.length(), strips.size());

        return strips;
    }

    @Override
    public List<String> filterRelevantStrips(String query, List<String> strips) {
        if (strips == null || strips.isEmpty()) {
            return Collections.emptyList();
        }

        // 计算每个片段的相关性并过滤
        List<String> relevantStrips = strips.stream()
                .filter(strip -> {
                    double relevance = calculateTextRelevance(query, strip);
                    return relevance >= AMBIGUOUS_THRESHOLD;
                })
                .collect(Collectors.toList());

        log.debug("知识过滤完成: originalCount={}, filteredCount={}",
                strips.size(), relevantStrips.size());

        return relevantStrips;
    }

    /**
     * 提取检索结果内容
     */
    private String extractContent(Map<String, Object> result) {
        // 尝试多种可能的字段名
        for (String key : Arrays.asList("content", "text", "description", "summary")) {
            Object value = result.get(key);
            if (value != null) {
                return value.toString();
            }
        }
        return null;
    }

    /**
     * 计算余弦相似度
     */
    private double cosineSimilarity(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA == 0 || normB == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 关键词相关性计算 (降级方案)
     */
    private double calculateKeywordRelevance(String query, Map<String, Object> result) {
        String content = extractContent(result);
        if (content == null) return 0.0;

        return calculateTextRelevance(query, content);
    }

    /**
     * 文本相关性计算
     */
    private double calculateTextRelevance(String query, String content) {
        String normalizedQuery = query.toLowerCase();
        String normalizedContent = content.toLowerCase();

        // 分词统计匹配
        String[] queryWords = normalizedQuery.split("[\\s,，。！？、]+");
        int matchCount = 0;
        for (String word : queryWords) {
            if (word.length() > 1 && normalizedContent.contains(word)) {
                matchCount++;
            }
        }

        return queryWords.length > 0 ? (double) matchCount / queryWords.length : 0.0;
    }
}
