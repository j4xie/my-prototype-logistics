package com.cretas.aims.service.embedding;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;

/**
 * 句子嵌入转换器 - 将文本转换为向量
 *
 * 使用 HuggingFace Tokenizer 进行分词，
 * 通过 ONNX Runtime 推理得到句子向量。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public class SentenceEmbeddingTranslator implements Translator<String, float[]> {

    private final HuggingFaceTokenizer tokenizer;
    private final int maxLength;

    /**
     * 构造函数
     *
     * @param tokenizer HuggingFace tokenizer
     */
    public SentenceEmbeddingTranslator(HuggingFaceTokenizer tokenizer) {
        this(tokenizer, 128); // 默认最大长度 128
    }

    /**
     * 构造函数
     *
     * @param tokenizer HuggingFace tokenizer
     * @param maxLength 最大序列长度
     */
    public SentenceEmbeddingTranslator(HuggingFaceTokenizer tokenizer, int maxLength) {
        this.tokenizer = tokenizer;
        this.maxLength = maxLength;
    }

    @Override
    public NDList processInput(TranslatorContext ctx, String input) throws Exception {
        // 使用 tokenizer 编码输入文本
        Encoding encoding = tokenizer.encode(input);

        NDManager manager = ctx.getNDManager();

        // 获取 token ids 和 attention mask
        long[] inputIds = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        long[] tokenTypeIds = encoding.getTypeIds();

        // 截断到最大长度
        if (inputIds.length > maxLength) {
            inputIds = truncate(inputIds, maxLength);
            attentionMask = truncate(attentionMask, maxLength);
            tokenTypeIds = truncate(tokenTypeIds, maxLength);
        }

        // 创建 NDArray 并扩展维度 [seq_len] -> [1, seq_len]
        NDArray inputIdsArray = manager.create(inputIds).expandDims(0);
        NDArray attentionMaskArray = manager.create(attentionMask).expandDims(0);
        NDArray tokenTypeIdsArray = manager.create(tokenTypeIds).expandDims(0);

        // 返回模型输入 (input_ids, attention_mask, token_type_ids)
        return new NDList(inputIdsArray, attentionMaskArray, tokenTypeIdsArray);
    }

    @Override
    public float[] processOutput(TranslatorContext ctx, NDList list) throws Exception {
        // ONNX 模型输出: last_hidden_state [1, seq_len, hidden_size]
        // 由于 ONNX Runtime NDArray 不支持 mean/norm 操作,
        // 我们先转换为 float 数组再用 Java 处理
        NDArray lastHiddenState = list.get(0);

        // 获取形状信息: [1, seq_len, hidden_size]
        long[] shape = lastHiddenState.getShape().getShape();
        int seqLen = (int) shape[1];
        int hiddenSize = (int) shape[2];

        // 转换为 float 数组进行处理
        float[] rawOutput = lastHiddenState.toFloatArray();

        // Mean pooling: 对 token embeddings 取平均 (使用 Java 实现)
        float[] meanPooled = new float[hiddenSize];
        for (int h = 0; h < hiddenSize; h++) {
            float sum = 0.0f;
            for (int s = 0; s < seqLen; s++) {
                // 索引: [0, s, h] = s * hiddenSize + h
                sum += rawOutput[s * hiddenSize + h];
            }
            meanPooled[h] = sum / seqLen;
        }

        // L2 归一化 (使用 Java 实现)
        float norm = 0.0f;
        for (float v : meanPooled) {
            norm += v * v;
        }
        norm = (float) Math.sqrt(norm) + 1e-12f; // 防止除零

        float[] normalized = new float[hiddenSize];
        for (int i = 0; i < hiddenSize; i++) {
            normalized[i] = meanPooled[i] / norm;
        }

        return normalized;
    }

    @Override
    public Batchifier getBatchifier() {
        return null; // 单条处理，不使用批处理
    }

    /**
     * 截断数组到指定长度
     */
    private long[] truncate(long[] array, int maxLen) {
        if (array.length <= maxLen) {
            return array;
        }
        long[] result = new long[maxLen];
        System.arraycopy(array, 0, result, 0, maxLen);
        return result;
    }
}
