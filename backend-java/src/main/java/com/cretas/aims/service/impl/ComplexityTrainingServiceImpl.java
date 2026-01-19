package com.cretas.aims.service.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.service.ComplexityTrainingService;
import com.cretas.aims.service.EmbeddingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.FileWriter;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 复杂度分类器训练服务实现
 *
 * 使用 Qwen Max 生成标注数据，训练 Softmax 分类器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
public class ComplexityTrainingServiceImpl implements ComplexityTrainingService {

    private static final int EMBEDDING_DIM = 768;
    private static final int NUM_CLASSES = 5;
    private static final double LEARNING_RATE = 0.1;
    private static final int EPOCHS = 100;

    @Autowired
    private DashScopeClient dashScopeClient;

    @Autowired
    private EmbeddingClient embeddingClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 数据生成 Prompt
     */
    private static final String DATA_GENERATION_PROMPT = """
        你是一个食品生产企业管理系统的查询样本生成器。
        请为以下复杂度等级生成 %d 个真实的用户查询样本。

        复杂度等级 %d 的定义：
        %s

        要求：
        1. 每个样本一行，不要编号
        2. 样本要贴近食品生产企业的实际场景
        3. 涵盖不同的业务领域（生产、质检、库存、出货、设备等）
        4. 语言风格要自然，像真实用户会说的话

        只输出查询样本，不要其他任何内容。
        """;

    /**
     * 各等级的定义
     */
    private static final Map<Integer, String> LEVEL_DEFINITIONS = Map.of(
            1, "简单查询 - 单一数据查询，答案明确。例如：今天库存多少、设备状态、当前温度",
            2, "标准查询 - 多数据源或带时间范围的查询。例如：最近一周的出货记录、本月质检报告",
            3, "中等分析 - 需要数据整合和基础分析。例如：分析本月销售情况、总结质检问题",
            4, "复杂分析 - 多维度对比分析。例如：对比各产品线质检趋势、分析各车间效率差异",
            5, "深度分析 - 战略建议+因果推理。例如：分析销售下降原因并给出改进方案、预测下月产能并提出优化建议"
    );

    @Override
    public List<TrainingSample> generateTrainingData(int samplesPerLevel) {
        List<TrainingSample> allSamples = new ArrayList<>();

        for (int level = 1; level <= 5; level++) {
            log.info("正在生成等级 {} 的训练样本 ({} 个)...", level, samplesPerLevel);

            try {
                String prompt = String.format(DATA_GENERATION_PROMPT,
                        samplesPerLevel, level, LEVEL_DEFINITIONS.get(level));

                String response = dashScopeClient.chat(
                        "你是一个数据生成助手，严格按照要求生成样本。",
                        prompt
                );

                // 解析响应
                List<String> samples = parseGeneratedSamples(response);
                log.info("等级 {} 解析到 {} 个样本", level, samples.size());

                for (String sample : samples) {
                    if (sample != null && !sample.trim().isEmpty()) {
                        allSamples.add(new TrainingSample(sample.trim(), level));
                    }
                }

                // 避免 API 限流
                Thread.sleep(1000);

            } catch (Exception e) {
                log.error("生成等级 {} 样本失败: {}", level, e.getMessage());
            }
        }

        log.info("共生成 {} 个训练样本", allSamples.size());
        return allSamples;
    }

    /**
     * 解析生成的样本
     */
    private List<String> parseGeneratedSamples(String response) {
        List<String> samples = new ArrayList<>();
        if (response == null) return samples;

        String[] lines = response.split("\n");
        for (String line : lines) {
            String cleaned = line.trim();
            // 移除可能的编号前缀
            cleaned = cleaned.replaceAll("^\\d+[.、)\\]]\\s*", "");
            cleaned = cleaned.replaceAll("^[-*]\\s*", "");

            if (!cleaned.isEmpty() && cleaned.length() > 3) {
                samples.add(cleaned);
            }
        }
        return samples;
    }

    @Override
    public Map<String, Object> train(List<TrainingSample> samples) {
        log.info("开始训练分类器，样本数: {}", samples.size());

        // 1. 获取所有样本的 embedding
        log.info("计算样本 embedding...");
        List<float[]> embeddings = new ArrayList<>();
        List<Integer> labels = new ArrayList<>();

        for (TrainingSample sample : samples) {
            try {
                float[] emb = embeddingClient.encode(sample.text());
                embeddings.add(emb);
                labels.add(sample.level() - 1);  // 转为 0-based 索引
            } catch (Exception e) {
                log.warn("样本 embedding 失败，跳过: {}", sample.text());
            }
        }

        log.info("成功获取 {} 个样本的 embedding", embeddings.size());

        // 2. 初始化权重
        double[][] weights = new double[NUM_CLASSES][EMBEDDING_DIM];
        double[] biases = new double[NUM_CLASSES];
        Random random = new Random(42);

        for (int i = 0; i < NUM_CLASSES; i++) {
            biases[i] = 0.0;
            for (int j = 0; j < EMBEDDING_DIM; j++) {
                weights[i][j] = random.nextGaussian() * 0.01;
            }
        }

        // 3. 梯度下降训练
        log.info("开始梯度下降训练 (epochs={}, lr={})...", EPOCHS, LEARNING_RATE);

        for (int epoch = 0; epoch < EPOCHS; epoch++) {
            double totalLoss = 0.0;
            int correct = 0;

            // 遍历每个样本
            for (int i = 0; i < embeddings.size(); i++) {
                float[] x = embeddings.get(i);
                int y = labels.get(i);

                // Forward: 计算 logits 和 softmax
                double[] logits = new double[NUM_CLASSES];
                for (int c = 0; c < NUM_CLASSES; c++) {
                    logits[c] = biases[c];
                    for (int j = 0; j < EMBEDDING_DIM; j++) {
                        logits[c] += weights[c][j] * x[j];
                    }
                }
                double[] probs = softmax(logits);

                // 计算损失
                totalLoss -= Math.log(Math.max(probs[y], 1e-10));

                // 计算准确率
                int pred = argmax(probs);
                if (pred == y) correct++;

                // Backward: 计算梯度并更新
                for (int c = 0; c < NUM_CLASSES; c++) {
                    double grad = probs[c] - (c == y ? 1.0 : 0.0);
                    biases[c] -= LEARNING_RATE * grad;
                    for (int j = 0; j < EMBEDDING_DIM; j++) {
                        weights[c][j] -= LEARNING_RATE * grad * x[j];
                    }
                }
            }

            if (epoch % 10 == 0 || epoch == EPOCHS - 1) {
                double accuracy = (double) correct / embeddings.size() * 100;
                log.info("Epoch {}: loss={:.4f}, accuracy={:.1f}%",
                        epoch, totalLoss / embeddings.size(), accuracy);
            }
        }

        // 4. 构建模型
        List<List<Double>> weightsList = new ArrayList<>();
        List<Double> biasesList = new ArrayList<>();

        for (int i = 0; i < NUM_CLASSES; i++) {
            List<Double> row = new ArrayList<>();
            for (int j = 0; j < EMBEDDING_DIM; j++) {
                row.add(weights[i][j]);
            }
            weightsList.add(row);
            biasesList.add(biases[i]);
        }

        Map<String, Object> model = new HashMap<>();
        model.put("weights", weightsList);
        model.put("biases", biasesList);
        model.put("embedding_dim", EMBEDDING_DIM);
        model.put("num_classes", NUM_CLASSES);
        model.put("trained_samples", embeddings.size());
        model.put("trained_at", new Date().toString());

        log.info("✅ 训练完成!");
        return model;
    }

    @Override
    public void saveModel(Map<String, Object> model, String path) {
        try {
            Path filePath = Paths.get(path);
            Files.createDirectories(filePath.getParent());

            String json = objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(model);

            try (FileWriter writer = new FileWriter(filePath.toFile())) {
                writer.write(json);
            }

            log.info("✅ 模型已保存到: {}", path);
        } catch (Exception e) {
            log.error("保存模型失败: {}", e.getMessage());
            throw new RuntimeException("保存模型失败", e);
        }
    }

    @Override
    public void trainAndSave(int samplesPerLevel, String modelPath) {
        log.info("=== 开始完整训练流程 ===");
        log.info("每个等级样本数: {}", samplesPerLevel);
        log.info("模型保存路径: {}", modelPath);

        // 1. 生成训练数据
        List<TrainingSample> samples = generateTrainingData(samplesPerLevel);

        if (samples.isEmpty()) {
            throw new RuntimeException("未生成任何训练样本");
        }

        // 2. 训练模型
        Map<String, Object> model = train(samples);

        // 3. 保存模型
        saveModel(model, modelPath);

        log.info("=== 训练流程完成 ===");
    }

    @Override
    public List<TrainingSample> loadTrainingDataFromFile(String filePath) {
        log.info("从文件加载训练数据: {}", filePath);

        try {
            InputStream is = null;
            Path path = Paths.get(filePath);

            // 优先从文件系统加载
            if (Files.exists(path)) {
                is = Files.newInputStream(path);
                log.info("从文件系统加载: {}", path.toAbsolutePath());
            } else {
                // 从 classpath 加载
                is = getClass().getClassLoader().getResourceAsStream(filePath);
                if (is != null) {
                    log.info("从 classpath 加载: {}", filePath);
                }
            }

            if (is == null) {
                throw new RuntimeException("找不到训练数据文件: " + filePath);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(is, Map.class);
            is.close();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> samples = (List<Map<String, Object>>) data.get("samples");

            List<TrainingSample> result = new ArrayList<>();
            for (Map<String, Object> sample : samples) {
                String text = (String) sample.get("text");
                int level = ((Number) sample.get("level")).intValue();
                result.add(new TrainingSample(text, level));
            }

            log.info("✅ 成功加载 {} 条训练样本", result.size());
            return result;

        } catch (Exception e) {
            log.error("加载训练数据失败: {}", e.getMessage());
            throw new RuntimeException("加载训练数据失败", e);
        }
    }

    /**
     * Softmax 函数
     */
    private double[] softmax(double[] logits) {
        double max = Arrays.stream(logits).max().orElse(0.0);
        double[] exp = new double[logits.length];
        double sum = 0.0;

        for (int i = 0; i < logits.length; i++) {
            exp[i] = Math.exp(logits[i] - max);
            sum += exp[i];
        }

        for (int i = 0; i < exp.length; i++) {
            exp[i] /= sum;
        }

        return exp;
    }

    /**
     * 找到最大值索引
     */
    private int argmax(double[] arr) {
        int maxIdx = 0;
        for (int i = 1; i < arr.length; i++) {
            if (arr[i] > arr[maxIdx]) {
                maxIdx = i;
            }
        }
        return maxIdx;
    }
}
