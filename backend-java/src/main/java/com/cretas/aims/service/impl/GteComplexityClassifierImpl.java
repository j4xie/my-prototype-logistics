package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.ProcessingMode;
import com.cretas.aims.service.ComplexityClassifier;
import com.cretas.aims.service.EmbeddingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

/**
 * 基于 GTE Embedding + Softmax 分类器的复杂度检测
 *
 * 实现原理：
 * 1. 使用 GTE-base-zh 生成 768 维 embedding
 * 2. 使用预训练的 Softmax 权重矩阵分类到 5 个等级
 * 3. 权重矩阵由 Qwen Max 生成的标注数据训练得到
 *
 * 优点：
 * - 不需要调用 LLM API
 * - 推理速度 <50ms
 * - 可在 CPU 上运行
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
public class GteComplexityClassifierImpl implements ComplexityClassifier {

    private static final int EMBEDDING_DIM = 768;
    private static final int NUM_CLASSES = 5;

    @Autowired
    private EmbeddingClient embeddingClient;

    /**
     * 模型文件路径（优先从文件系统加载，其次从 classpath）
     */
    @Value("${ai.complexity.classifier.model-path:config/complexity_classifier.json}")
    private String modelPath;

    /**
     * classpath 中的默认模型路径
     */
    private static final String CLASSPATH_MODEL = "config/complexity_classifier.json";

    /**
     * 权重矩阵 [NUM_CLASSES x EMBEDDING_DIM]
     */
    private double[][] weights;

    /**
     * 偏置向量 [NUM_CLASSES]
     */
    private double[] biases;

    /**
     * 是否已加载模型
     */
    private volatile boolean trained = false;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        reload();
    }

    @Override
    public void reload() {
        try {
            loadModel();
            trained = true;
            log.info("✅ 复杂度分类器加载成功");
        } catch (Exception e) {
            log.warn("⚠️ 复杂度分类器加载失败，将使用默认权重: {}", e.getMessage());
            initializeDefaultWeights();
            trained = true;
        }
    }

    /**
     * 加载预训练模型
     */
    private void loadModel() throws Exception {
        // 优先从文件系统加载（训练后的模型）
        Path path = Paths.get(modelPath);
        InputStream is = null;
        String source = null;

        if (Files.exists(path)) {
            is = Files.newInputStream(path);
            source = "文件系统: " + path.toAbsolutePath();
        } else {
            // 从 classpath 加载默认模型
            is = getClass().getClassLoader().getResourceAsStream(CLASSPATH_MODEL);
            if (is != null) {
                source = "classpath: " + CLASSPATH_MODEL;
            }
        }

        if (is == null) {
            throw new RuntimeException("找不到分类器模型文件: " + modelPath);
        }

        log.info("从 {} 加载分类器模型", source);

        @SuppressWarnings("unchecked")
        Map<String, Object> model = objectMapper.readValue(is, Map.class);
        is.close();

        // 解析权重和偏置
        @SuppressWarnings("unchecked")
        var weightsList = (java.util.List<java.util.List<Double>>) model.get("weights");
        @SuppressWarnings("unchecked")
        var biasesList = (java.util.List<Double>) model.get("biases");

        // 检查权重是否为空（未训练的模型）
        if (weightsList == null || weightsList.isEmpty()) {
            log.warn("模型权重为空，使用默认权重");
            initializeDefaultWeights();
            return;
        }

        weights = new double[NUM_CLASSES][EMBEDDING_DIM];
        biases = new double[NUM_CLASSES];

        for (int i = 0; i < NUM_CLASSES; i++) {
            for (int j = 0; j < EMBEDDING_DIM; j++) {
                weights[i][j] = weightsList.get(i).get(j);
            }
            biases[i] = biasesList.get(i);
        }

        log.info("✅ 模型加载成功，已训练样本数: {}", model.get("trained_samples"));
    }

    /**
     * 初始化默认权重（基于规则的近似）
     */
    private void initializeDefaultWeights() {
        weights = new double[NUM_CLASSES][EMBEDDING_DIM];
        biases = new double[NUM_CLASSES];

        // 简单初始化：使用较小的随机值
        // 实际使用时会被训练好的权重替换
        for (int i = 0; i < NUM_CLASSES; i++) {
            biases[i] = -0.5 + i * 0.25;  // 渐进偏置
            for (int j = 0; j < EMBEDDING_DIM; j++) {
                weights[i][j] = 0.001 * (i - 2);  // 微小权重
            }
        }

        log.info("使用默认权重初始化分类器");
    }

    @Override
    public ProcessingMode predict(String userInput) {
        double[] probs = predictProbabilities(userInput);

        // 找到最大概率的类别
        int maxIdx = 0;
        for (int i = 1; i < probs.length; i++) {
            if (probs[i] > probs[maxIdx]) {
                maxIdx = i;
            }
        }

        // 转换为 ProcessingMode (类别索引 0-4 对应等级 1-5)
        int level = maxIdx + 1;
        ProcessingMode mode = ProcessingMode.fromLevel(level);

        log.debug("复杂度分类: input='{}', level={}, mode={}, probs={}",
                userInput.length() > 30 ? userInput.substring(0, 30) + "..." : userInput,
                level, mode, formatProbs(probs));

        return mode;
    }

    @Override
    public double predictScore(String userInput) {
        double[] probs = predictProbabilities(userInput);

        // 计算加权复杂度分数 (等级 1-5 映射到 0.1-0.9)
        double score = 0.0;
        double[] levelScores = {0.1, 0.3, 0.5, 0.7, 0.9};
        for (int i = 0; i < NUM_CLASSES; i++) {
            score += probs[i] * levelScores[i];
        }

        return score;
    }

    @Override
    public double[] predictProbabilities(String userInput) {
        if (!embeddingClient.isAvailable()) {
            log.warn("Embedding 服务不可用，返回默认概率分布");
            return new double[]{0.2, 0.3, 0.3, 0.15, 0.05};  // 偏向中等复杂度
        }

        // 1. 获取 embedding
        float[] embedding = embeddingClient.encode(userInput);

        // 2. 计算 logits: z = W * x + b
        double[] logits = new double[NUM_CLASSES];
        for (int i = 0; i < NUM_CLASSES; i++) {
            logits[i] = biases[i];
            for (int j = 0; j < EMBEDDING_DIM; j++) {
                logits[i] += weights[i][j] * embedding[j];
            }
        }

        // 3. Softmax 归一化
        return softmax(logits);
    }

    /**
     * Softmax 函数
     */
    private double[] softmax(double[] logits) {
        double[] result = new double[logits.length];

        // 数值稳定性：减去最大值
        double max = logits[0];
        for (int i = 1; i < logits.length; i++) {
            if (logits[i] > max) max = logits[i];
        }

        double sum = 0.0;
        for (int i = 0; i < logits.length; i++) {
            result[i] = Math.exp(logits[i] - max);
            sum += result[i];
        }

        for (int i = 0; i < result.length; i++) {
            result[i] /= sum;
        }

        return result;
    }

    @Override
    public boolean isTrained() {
        return trained && embeddingClient.isAvailable();
    }

    /**
     * 格式化概率输出
     */
    private String formatProbs(double[] probs) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < probs.length; i++) {
            if (i > 0) sb.append(", ");
            sb.append(String.format("L%d:%.2f", i + 1, probs[i]));
        }
        sb.append("]");
        return sb.toString();
    }
}
