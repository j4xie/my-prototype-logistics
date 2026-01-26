package com.cretas.embedding.translator;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;

/**
 * Sentence Embedding Translator - converts text to embedding vector
 *
 * Uses HuggingFace Tokenizer for tokenization,
 * runs ONNX Runtime inference to get sentence embeddings.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public class SentenceEmbeddingTranslator implements Translator<String, float[]> {

    private final HuggingFaceTokenizer tokenizer;
    private final int maxLength;
    private final boolean useTokenTypeIds;

    /**
     * Constructor with default max length 128 and token_type_ids enabled
     *
     * @param tokenizer HuggingFace tokenizer
     */
    public SentenceEmbeddingTranslator(HuggingFaceTokenizer tokenizer) {
        this(tokenizer, 128, true);
    }

    /**
     * Constructor with token_type_ids enabled
     *
     * @param tokenizer HuggingFace tokenizer
     * @param maxLength max sequence length
     */
    public SentenceEmbeddingTranslator(HuggingFaceTokenizer tokenizer, int maxLength) {
        this(tokenizer, maxLength, true);
    }

    /**
     * Constructor with full control
     *
     * @param tokenizer HuggingFace tokenizer
     * @param maxLength max sequence length
     * @param useTokenTypeIds whether to include token_type_ids (fine-tuned models may not need it)
     */
    public SentenceEmbeddingTranslator(HuggingFaceTokenizer tokenizer, int maxLength, boolean useTokenTypeIds) {
        this.tokenizer = tokenizer;
        this.maxLength = maxLength;
        this.useTokenTypeIds = useTokenTypeIds;
    }

    @Override
    public NDList processInput(TranslatorContext ctx, String input) throws Exception {
        // Tokenize input text
        Encoding encoding = tokenizer.encode(input);

        NDManager manager = ctx.getNDManager();

        // Get token ids and attention mask
        long[] inputIds = encoding.getIds();
        long[] attentionMask = encoding.getAttentionMask();
        boolean needTruncate = inputIds.length > maxLength;

        // Truncate to max length
        if (needTruncate) {
            inputIds = truncate(inputIds, maxLength);
            attentionMask = truncate(attentionMask, maxLength);
        }

        // Create NDArray and expand dims [seq_len] -> [1, seq_len]
        NDArray inputIdsArray = manager.create(inputIds).expandDims(0);
        NDArray attentionMaskArray = manager.create(attentionMask).expandDims(0);

        // Return model input based on model requirements
        // Fine-tuned models may only need (input_ids, attention_mask)
        // Original models need (input_ids, attention_mask, token_type_ids)
        if (useTokenTypeIds) {
            long[] tokenTypeIds = encoding.getTypeIds();
            if (needTruncate) {
                tokenTypeIds = truncate(tokenTypeIds, maxLength);
            }
            NDArray tokenTypeIdsArray = manager.create(tokenTypeIds).expandDims(0);
            return new NDList(inputIdsArray, attentionMaskArray, tokenTypeIdsArray);
        } else {
            return new NDList(inputIdsArray, attentionMaskArray);
        }
    }

    @Override
    public float[] processOutput(TranslatorContext ctx, NDList list) throws Exception {
        // Get the first output tensor
        NDArray output = list.get(0);
        long[] shape = output.getShape().getShape();

        // Handle different output formats:
        // 1. Fine-tuned models: sentence_embedding [batch, hidden_size] - already pooled & normalized
        // 2. Original models: last_hidden_state [batch, seq_len, hidden_size] - needs mean pooling
        if (shape.length == 2) {
            // 2D output: already a sentence embedding [1, hidden_size]
            float[] embedding = output.toFloatArray();

            // L2 normalize (in case not already normalized)
            float norm = 0.0f;
            for (float v : embedding) {
                norm += v * v;
            }
            norm = (float) Math.sqrt(norm);

            // Only normalize if not already normalized (norm should be ~1.0)
            if (Math.abs(norm - 1.0f) > 0.01f && norm > 1e-6f) {
                for (int i = 0; i < embedding.length; i++) {
                    embedding[i] = embedding[i] / norm;
                }
            }
            return embedding;
        } else {
            // 3D output: last_hidden_state [1, seq_len, hidden_size] - needs mean pooling
            int seqLen = (int) shape[1];
            int hiddenSize = (int) shape[2];

            float[] rawOutput = output.toFloatArray();

            // Mean pooling: average over token embeddings
            float[] meanPooled = new float[hiddenSize];
            for (int h = 0; h < hiddenSize; h++) {
                float sum = 0.0f;
                for (int s = 0; s < seqLen; s++) {
                    sum += rawOutput[s * hiddenSize + h];
                }
                meanPooled[h] = sum / seqLen;
            }

            // L2 normalize
            float norm = 0.0f;
            for (float v : meanPooled) {
                norm += v * v;
            }
            norm = (float) Math.sqrt(norm) + 1e-12f;

            float[] normalized = new float[hiddenSize];
            for (int i = 0; i < hiddenSize; i++) {
                normalized[i] = meanPooled[i] / norm;
            }
            return normalized;
        }
    }

    @Override
    public Batchifier getBatchifier() {
        return null; // Single item processing, no batching
    }

    /**
     * Truncate array to specified length
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
