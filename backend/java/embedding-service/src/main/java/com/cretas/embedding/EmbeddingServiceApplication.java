package com.cretas.embedding;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Embedding Service Application
 *
 * gRPC-based Embedding Service using DJL/ONNX Runtime.
 * Provides text-to-vector encoding and similarity computation.
 *
 * Default gRPC port: 9090
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@SpringBootApplication
public class EmbeddingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EmbeddingServiceApplication.class, args);
    }
}
