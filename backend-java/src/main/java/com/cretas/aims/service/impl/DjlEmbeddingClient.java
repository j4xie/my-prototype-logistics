package com.cretas.aims.service.impl;

import ai.djl.MalformedModelException;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.inference.Predictor;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import com.cretas.aims.service.EmbeddingClient;
import com.cretas.aims.service.embedding.SentenceEmbeddingTranslator;
import com.cretas.aims.util.VectorUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 基于 DJL + ONNX Runtime 的纯 Java Embedding 客户端
 *
 * 替代原有的 Python 服务调用，实现本地语义向量生成。
 * 使用 GTE-base-zh 中文模型，输出 768 维向量。
 *
 * 模型对比测试结果 (2026-01-05):
 * - gte-base-zh:  93.3% 准确率, 768维, 105ms
 * - bge-large-zh: 86.7% 准确率, 1024维, 360ms
 * - bge-base-zh:  80.0% 准确率, 768维, 105ms
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-05
 */
@Service
@Primary
@Lazy
@ConditionalOnProperty(name = "embedding.djl.enabled", havingValue = "true", matchIfMissing = false)
@Slf4j
public class DjlEmbeddingClient implements EmbeddingClient {

    private static final int VECTOR_DIMENSION = 768;
    private static final int MAX_SEQUENCE_LENGTH = 128;

    @Value("${embedding.model-path:models/gte-base-zh}")
    private String modelPath;

    private ZooModel<String, float[]> model;
    private Predictor<String, float[]> predictor;
    private HuggingFaceTokenizer tokenizer;
    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        try {
            log.info("Initializing DJL Embedding Client...");
            long startTime = System.currentTimeMillis();

            // 1. 获取模型路径 (从 classpath 或文件系统)
            Path modelDir = resolveModelPath();
            log.info("Model directory: {}", modelDir);

            // 2. 加载 HuggingFace tokenizer
            Path tokenizerPath = modelDir.resolve("tokenizer.json");
            tokenizer = HuggingFaceTokenizer.newInstance(tokenizerPath);
            log.info("Tokenizer loaded from: {}", tokenizerPath);

            // 3. 创建自定义 Translator
            SentenceEmbeddingTranslator translator =
                    new SentenceEmbeddingTranslator(tokenizer, MAX_SEQUENCE_LENGTH);

            // 4. 加载 ONNX 模型
            Criteria<String, float[]> criteria = Criteria.builder()
                    .setTypes(String.class, float[].class)
                    .optModelPath(modelDir)
                    .optModelName("model")
                    .optEngine("OnnxRuntime")
                    .optTranslator(translator)
                    .build();

            model = criteria.loadModel();
            predictor = model.newPredictor();
            initialized = true;

            long duration = System.currentTimeMillis() - startTime;
            log.info("DJL Embedding Client initialized successfully in {}ms", duration);

        } catch (Exception e) {
            // 捕获所有异常，包括 DJL 原生库加载失败等
            // 允许应用程序继续启动，但禁用语义匹配功能
            log.warn("⚠️ DJL Embedding Client initialization failed: {} - semantic matching will be disabled",
                     e.getMessage());
            log.debug("DJL initialization error details:", e);
            initialized = false;
        }
    }

    @PreDestroy
    public void destroy() {
        if (predictor != null) {
            predictor.close();
        }
        if (model != null) {
            model.close();
        }
        log.info("DJL Embedding Client destroyed");
    }

    /**
     * 解析模型路径
     */
    private Path resolveModelPath() {
        // 优先尝试从文件系统加载 (便于外部配置)
        Path fsPath = Paths.get(modelPath);
        if (fsPath.toFile().exists()) {
            return fsPath;
        }

        // 尝试从 classpath 加载
        try {
            var resource = getClass().getClassLoader().getResource(modelPath);
            if (resource != null) {
                return Paths.get(resource.toURI());
            }
        } catch (Exception e) {
            log.warn("Failed to load model from classpath: {}", e.getMessage());
        }

        // 回退到相对路径
        return Paths.get("src/main/resources", modelPath);
    }

    @Override
    public float[] encode(String text) {
        if (!initialized) {
            log.warn("Embedding client not initialized, returning zero vector");
            return new float[VECTOR_DIMENSION];
        }

        if (text == null || text.trim().isEmpty()) {
            return new float[VECTOR_DIMENSION];
        }

        try {
            return predictor.predict(text);
        } catch (Exception e) {
            log.error("Embedding encode failed for text '{}': {}",
                    text.substring(0, Math.min(50, text.length())), e.getMessage());
            throw new EmbeddingException("向量化失败: " + e.getMessage(), e);
        }
    }

    @Override
    public List<float[]> encodeBatch(List<String> texts) {
        if (!initialized) {
            log.warn("Embedding client not initialized, returning zero vectors");
            return texts.stream()
                    .map(t -> new float[VECTOR_DIMENSION])
                    .collect(Collectors.toList());
        }

        List<float[]> results = new ArrayList<>();
        for (String text : texts) {
            try {
                results.add(encode(text));
            } catch (Exception e) {
                log.warn("Batch encoding failed for one text, using zero vector");
                results.add(new float[VECTOR_DIMENSION]);
            }
        }
        return results;
    }

    @Override
    public double computeSimilarity(String text1, String text2) {
        float[] vec1 = encode(text1);
        float[] vec2 = encode(text2);
        return VectorUtils.cosineSimilarity(vec1, vec2);
    }

    @Override
    public List<SimilarityResult> findSimilar(String query, List<String> candidates,
                                               double threshold, int topK) {
        float[] queryVec = encode(query);
        List<float[]> candidateVecs = encodeBatch(candidates);

        List<SimilarityResultImpl> results = new ArrayList<>();
        for (int i = 0; i < candidates.size(); i++) {
            double score = VectorUtils.cosineSimilarity(queryVec, candidateVecs.get(i));
            if (score >= threshold) {
                results.add(new SimilarityResultImpl(i, candidates.get(i), score));
            }
        }

        return results.stream()
                .sorted(Comparator.comparingDouble(SimilarityResultImpl::getScore).reversed())
                .limit(topK)
                .collect(Collectors.toList());
    }

    @Override
    public boolean isAvailable() {
        return initialized;
    }

    @Override
    public int getDimension() {
        return VECTOR_DIMENSION;
    }

    @Override
    public String getModelName() {
        return "gte-base-zh";
    }

    /**
     * SimilarityResult 实现
     */
    private static class SimilarityResultImpl implements SimilarityResult {
        private final int index;
        private final String text;
        private final double score;

        public SimilarityResultImpl(int index, String text, double score) {
            this.index = index;
            this.text = text;
            this.score = score;
        }

        @Override
        public int getIndex() {
            return index;
        }

        @Override
        public String getText() {
            return text;
        }

        @Override
        public double getScore() {
            return score;
        }
    }
}
