package com.cretas.embedding.util;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Vector calculation utilities
 * Provides cosine similarity and serialization methods
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public final class VectorUtils {

    private VectorUtils() {
        // Prevent instantiation
    }

    /**
     * Compute cosine similarity between two vectors
     *
     * @param vec1 vector 1
     * @param vec2 vector 2
     * @return cosine similarity (-1 to 1), returns 0.0 if vectors are invalid
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
     * Serialize float[] embedding to byte[]
     *
     * @param embedding float vector
     * @return byte array
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
     * Deserialize byte[] to float[] embedding
     *
     * @param bytes byte array
     * @return float vector
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
