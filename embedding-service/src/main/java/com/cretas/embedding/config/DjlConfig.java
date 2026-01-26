package com.cretas.embedding.config;

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.inference.Predictor;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ZooModel;
import com.cretas.embedding.translator.SentenceEmbeddingTranslator;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * DJL Configuration - initializes ONNX model and tokenizer
 *
 * Uses GTE-base-zh Chinese model, outputs 768-dimensional vectors.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Configuration
@Slf4j
public class DjlConfig {

    private static final int MAX_SEQUENCE_LENGTH = 128;

    @Value("${embedding.model-path:models/gte-base-zh}")
    private String modelPath;

    /**
     * Whether to include token_type_ids in model input.
     * Set to false for fine-tuned models exported with Sentence Transformers.
     */
    @Value("${embedding.use-token-type-ids:true}")
    private boolean useTokenTypeIds;

    @Getter
    private ZooModel<String, float[]> model;

    @Getter
    private Predictor<String, float[]> predictor;

    @Getter
    private HuggingFaceTokenizer tokenizer;

    @Getter
    private volatile boolean initialized = false;

    @Getter
    private int vectorDimension = 768;

    @Getter
    private String modelName = "gte-base-zh";

    @PostConstruct
    public void init() {
        try {
            log.info("Initializing DJL Embedding Model...");
            long startTime = System.currentTimeMillis();

            // 1. Resolve model path
            Path modelDir = resolveModelPath();
            log.info("Model directory: {}", modelDir);

            // 2. Load HuggingFace tokenizer
            Path tokenizerPath = modelDir.resolve("tokenizer.json");
            tokenizer = HuggingFaceTokenizer.newInstance(tokenizerPath);
            log.info("Tokenizer loaded from: {}", tokenizerPath);

            // 3. Create custom Translator
            // useTokenTypeIds=false for fine-tuned models exported with Sentence Transformers
            SentenceEmbeddingTranslator translator =
                    new SentenceEmbeddingTranslator(tokenizer, MAX_SEQUENCE_LENGTH, useTokenTypeIds);
            log.info("Translator created with useTokenTypeIds={}", useTokenTypeIds);

            // 4. Load ONNX model
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
            log.info("DJL Embedding Model initialized successfully in {}ms", duration);

        } catch (Exception e) {
            log.error("DJL Embedding Model initialization failed: {}", e.getMessage(), e);
            initialized = false;
            throw new RuntimeException("Failed to initialize embedding model", e);
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
        log.info("DJL resources released");
    }

    /**
     * Resolve model path from filesystem or classpath
     */
    private Path resolveModelPath() {
        // Try filesystem first (for external configuration)
        Path fsPath = Paths.get(modelPath);
        if (fsPath.toFile().exists()) {
            return fsPath;
        }

        // Try classpath
        try {
            var resource = getClass().getClassLoader().getResource(modelPath);
            if (resource != null) {
                return Paths.get(resource.toURI());
            }
        } catch (Exception e) {
            log.warn("Failed to load model from classpath: {}", e.getMessage());
        }

        // Fallback to relative path
        return Paths.get("src/main/resources", modelPath);
    }

    /**
     * Encode text to embedding vector
     *
     * @param text input text
     * @return 768-dimensional float vector
     */
    public float[] encode(String text) {
        if (!initialized) {
            throw new IllegalStateException("Embedding model not initialized");
        }

        if (text == null || text.trim().isEmpty()) {
            return new float[vectorDimension];
        }

        try {
            return predictor.predict(text);
        } catch (Exception e) {
            log.error("Embedding encode failed: {}", e.getMessage());
            throw new RuntimeException("Encoding failed: " + e.getMessage(), e);
        }
    }
}
