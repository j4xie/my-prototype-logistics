package com.cretas.aims.util;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

/**
 * 向量计算工具类
 * 统一的向量相似度计算和序列化方法
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public final class VectorUtils {

    private VectorUtils() {
        // 防止实例化
    }

    /**
     * 计算两个向量的余弦相似度
     *
     * @param vec1 向量1
     * @param vec2 向量2
     * @return 余弦相似度 (-1 到 1)，如果向量无效则返回 0.0
     */
    public static double cosineSimilarity(float[] vec1, float[] vec2) {
        if (vec1 == null || vec2 == null || vec1.length != vec2.length) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (int i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        if (norm1 == 0.0 || norm2 == 0.0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * 将 float[] embedding 序列化为 byte[]
     *
     * @param embedding 浮点数向量
     * @return 字节数组
     */
    public static byte[] serializeEmbedding(float[] embedding) {
        if (embedding == null) {
            return new byte[0];
        }
        ByteBuffer buffer = ByteBuffer.allocate(embedding.length * 4);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        for (float f : embedding) {
            buffer.putFloat(f);
        }
        return buffer.array();
    }

    /**
     * 将 byte[] 反序列化为 float[] embedding
     *
     * @param bytes 字节数组
     * @return 浮点数向量
     */
    public static float[] deserializeEmbedding(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return new float[0];
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        float[] embedding = new float[bytes.length / 4];
        for (int i = 0; i < embedding.length; i++) {
            embedding[i] = buffer.getFloat();
        }
        return embedding;
    }
}
