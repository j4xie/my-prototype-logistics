package com.cretas.aims.service.impl;

import com.cretas.aims.service.EmbeddingClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * No-op Embedding Client - 当 DJL 未启用时的 fallback 实现
 *
 * 返回零向量，允许应用在没有 ONNX Runtime 的环境中正常启动
 * 语义匹配功能将被禁用
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Service
@ConditionalOnMissingBean(DjlEmbeddingClient.class)
@Slf4j
public class NoOpEmbeddingClient implements EmbeddingClient {

    private static final int VECTOR_DIMENSION = 768;

    public NoOpEmbeddingClient() {
        log.warn("⚠️ NoOpEmbeddingClient initialized - semantic matching is disabled. " +
                 "Set embedding.djl.enabled=true to enable DJL-based embeddings.");
    }

    @Override
    public float[] encode(String text) {
        return new float[VECTOR_DIMENSION];
    }

    @Override
    public List<float[]> encodeBatch(List<String> texts) {
        return texts.stream()
                .map(t -> new float[VECTOR_DIMENSION])
                .collect(Collectors.toList());
    }

    @Override
    public double computeSimilarity(String text1, String text2) {
        return 0.0;
    }

    @Override
    public List<SimilarityResult> findSimilar(String query, List<String> candidates,
                                               double threshold, int topK) {
        return Collections.emptyList();
    }

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public int getDimension() {
        return VECTOR_DIMENSION;
    }

    @Override
    public String getModelName() {
        return "no-op";
    }
}
