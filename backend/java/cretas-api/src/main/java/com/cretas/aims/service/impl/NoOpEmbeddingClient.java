package com.cretas.aims.service.impl;

import com.cretas.aims.service.EmbeddingClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * No-op Embedding Client - Fallback when gRPC embedding service is not configured
 *
 * Returns zero vectors, allowing the application to start without embedding service.
 * Semantic matching features will be disabled.
 *
 * Active when: embedding.mode != "grpc" OR embedding.mode not set (default fallback)
 *
 * @author Cretas Team
 * @version 2.1.0
 * @since 2026-01-24
 */
@Service
@ConditionalOnProperty(name = "embedding.mode", havingValue = "noop", matchIfMissing = true)
@Slf4j
public class NoOpEmbeddingClient implements EmbeddingClient {

    private static final int VECTOR_DIMENSION = 768;

    public NoOpEmbeddingClient() {
        log.warn("NoOpEmbeddingClient initialized - semantic matching is disabled. " +
                 "Set embedding.mode=grpc and start embedding-service for full functionality.");
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
