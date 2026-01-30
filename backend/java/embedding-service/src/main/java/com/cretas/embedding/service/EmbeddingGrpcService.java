package com.cretas.embedding.service;

import com.cretas.embedding.config.DjlConfig;
import com.cretas.embedding.grpc.*;
import com.cretas.embedding.util.VectorUtils;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * gRPC Embedding Service Implementation
 *
 * Provides text embedding and similarity computation via gRPC.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@GrpcService
@RequiredArgsConstructor
@Slf4j
public class EmbeddingGrpcService extends EmbeddingServiceGrpc.EmbeddingServiceImplBase {

    private final DjlConfig djlConfig;

    /**
     * Encode single text to embedding vector
     */
    @Override
    public void encode(EncodeRequest request, StreamObserver<EncodeResponse> responseObserver) {
        try {
            String text = request.getText();
            log.debug("Encoding text: {}", text.substring(0, Math.min(50, text.length())));

            float[] embedding = djlConfig.encode(text);

            EncodeResponse response = EncodeResponse.newBuilder()
                    .addAllEmbedding(toFloatList(embedding))
                    .setSuccess(true)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Encode failed: {}", e.getMessage());
            EncodeResponse response = EncodeResponse.newBuilder()
                    .setSuccess(false)
                    .setErrorMessage(e.getMessage())
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }

    /**
     * Batch encode multiple texts
     */
    @Override
    public void encodeBatch(EncodeBatchRequest request, StreamObserver<EncodeBatchResponse> responseObserver) {
        try {
            List<String> texts = request.getTextsList();
            log.debug("Batch encoding {} texts", texts.size());

            List<EmbeddingVector> embeddings = new ArrayList<>();
            for (String text : texts) {
                float[] embedding = djlConfig.encode(text);
                EmbeddingVector vector = EmbeddingVector.newBuilder()
                        .addAllValues(toFloatList(embedding))
                        .build();
                embeddings.add(vector);
            }

            EncodeBatchResponse response = EncodeBatchResponse.newBuilder()
                    .addAllEmbeddings(embeddings)
                    .setSuccess(true)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Batch encode failed: {}", e.getMessage());
            EncodeBatchResponse response = EncodeBatchResponse.newBuilder()
                    .setSuccess(false)
                    .setErrorMessage(e.getMessage())
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }

    /**
     * Compute similarity between two texts
     */
    @Override
    public void computeSimilarity(SimilarityRequest request, StreamObserver<SimilarityResponse> responseObserver) {
        try {
            String text1 = request.getText1();
            String text2 = request.getText2();

            float[] vec1 = djlConfig.encode(text1);
            float[] vec2 = djlConfig.encode(text2);
            double similarity = VectorUtils.cosineSimilarity(vec1, vec2);

            SimilarityResponse response = SimilarityResponse.newBuilder()
                    .setSimilarity(similarity)
                    .setSuccess(true)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Compute similarity failed: {}", e.getMessage());
            SimilarityResponse response = SimilarityResponse.newBuilder()
                    .setSuccess(false)
                    .setErrorMessage(e.getMessage())
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }

    /**
     * Find similar texts from candidates
     */
    @Override
    public void findSimilar(FindSimilarRequest request, StreamObserver<FindSimilarResponse> responseObserver) {
        try {
            String query = request.getQuery();
            List<String> candidates = request.getCandidatesList();
            double threshold = request.getThreshold();
            int topK = request.getTopK();

            log.debug("Finding similar texts for query, {} candidates, threshold={}, topK={}",
                    candidates.size(), threshold, topK);

            // Encode query
            float[] queryVec = djlConfig.encode(query);

            // Encode candidates and compute similarities
            List<SimilarityResult> results = new ArrayList<>();
            for (int i = 0; i < candidates.size(); i++) {
                float[] candidateVec = djlConfig.encode(candidates.get(i));
                double score = VectorUtils.cosineSimilarity(queryVec, candidateVec);

                if (score >= threshold) {
                    SimilarityResult result = SimilarityResult.newBuilder()
                            .setIndex(i)
                            .setText(candidates.get(i))
                            .setScore(score)
                            .build();
                    results.add(result);
                }
            }

            // Sort by score descending and limit to topK
            List<SimilarityResult> sortedResults = results.stream()
                    .sorted(Comparator.comparingDouble(SimilarityResult::getScore).reversed())
                    .limit(topK)
                    .collect(Collectors.toList());

            FindSimilarResponse response = FindSimilarResponse.newBuilder()
                    .addAllResults(sortedResults)
                    .setSuccess(true)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Find similar failed: {}", e.getMessage());
            FindSimilarResponse response = FindSimilarResponse.newBuilder()
                    .setSuccess(false)
                    .setErrorMessage(e.getMessage())
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }

    /**
     * Health check
     */
    @Override
    public void healthCheck(HealthCheckRequest request, StreamObserver<HealthCheckResponse> responseObserver) {
        boolean available = djlConfig.isInitialized();
        String status = available ? "SERVING" : "NOT_SERVING";

        HealthCheckResponse response = HealthCheckResponse.newBuilder()
                .setAvailable(available)
                .setStatus(status)
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * Get model info
     */
    @Override
    public void getModelInfo(ModelInfoRequest request, StreamObserver<ModelInfoResponse> responseObserver) {
        ModelInfoResponse response = ModelInfoResponse.newBuilder()
                .setModelName(djlConfig.getModelName())
                .setDimension(djlConfig.getVectorDimension())
                .setInitialized(djlConfig.isInitialized())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * Convert float array to List<Float>
     */
    private List<Float> toFloatList(float[] array) {
        List<Float> list = new ArrayList<>(array.length);
        for (float f : array) {
            list.add(f);
        }
        return list;
    }
}
