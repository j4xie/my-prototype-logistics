package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.service.VectorSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 向量搜索服务实现
 * 使用通义千问 text-embedding-v3 模型生成向量
 * 向量存储在 Redis 中，支持快速检索
 */
@Slf4j
@Service
public class VectorSearchServiceImpl implements VectorSearchService {

    private final GoodsSpuMapper goodsSpuMapper;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    public VectorSearchServiceImpl(
            GoodsSpuMapper goodsSpuMapper,
            ObjectMapper objectMapper,
            RestTemplate restTemplate,
            @Qualifier("stringObjectRedisTemplate") RedisTemplate<String, Object> redisTemplate) {
        this.goodsSpuMapper = goodsSpuMapper;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
    }

    // API Key - fallback to LLM API Key for compatibility
    @Value("${ai.dashscope.api-key:${ai.llm.api-key:}}")
    private String apiKey;

    @Value("${ai.dashscope.embedding-url:https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding}")
    private String embeddingUrl;

    @Value("${ai.dashscope.embedding-model:text-embedding-v3}")
    private String embeddingModel;

    private static final String PRODUCT_VECTOR_KEY_PREFIX = "mall:product:vector:";
    private static final int VECTOR_DIMENSION = 1536;
    private static final long VECTOR_CACHE_TTL_HOURS = 24;

    @Override
    public float[] generateEmbedding(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new float[VECTOR_DIMENSION];
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", embeddingModel);

            Map<String, Object> input = new HashMap<>();
            input.put("texts", List.of(text.substring(0, Math.min(text.length(), 2048))));
            requestBody.put("input", input);

            Map<String, Object> parameters = new HashMap<>();
            parameters.put("text_type", "query");
            requestBody.put("parameters", parameters);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    embeddingUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode embeddingNode = root.path("output").path("embeddings").path(0).path("embedding");

                if (embeddingNode.isArray()) {
                    float[] embedding = new float[embeddingNode.size()];
                    for (int i = 0; i < embeddingNode.size(); i++) {
                        embedding[i] = (float) embeddingNode.get(i).asDouble();
                    }
                    return embedding;
                }
            }
        } catch (Exception e) {
            log.error("生成向量失败: text={}", text.substring(0, Math.min(text.length(), 50)), e);
        }

        return new float[VECTOR_DIMENSION];
    }

    @Override
    public double cosineSimilarity(float[] v1, float[] v2) {
        if (v1 == null || v2 == null || v1.length != v2.length) {
            return 0.0;
        }

        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (int i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            norm1 += v1[i] * v1[i];
            norm2 += v2[i] * v2[i];
        }

        if (norm1 == 0 || norm2 == 0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    @Override
    public List<GoodsSpu> searchSimilarProducts(String query, int limit) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        try {
            // 1. 生成查询向量
            float[] queryVector = generateEmbedding(query);
            if (isZeroVector(queryVector)) {
                log.warn("查询向量生成失败，降级到关键词搜索: query={}", query);
                return fallbackKeywordSearch(query, limit);
            }

            // 2. 获取所有上架商品
            LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(GoodsSpu::getShelf, "1");
            List<GoodsSpu> allProducts = goodsSpuMapper.selectList(wrapper);

            // 3. 计算相似度并排序
            List<ProductSimilarity> similarities = new ArrayList<>();
            for (GoodsSpu product : allProducts) {
                float[] productVector = getProductVector(product);
                if (!isZeroVector(productVector)) {
                    double similarity = cosineSimilarity(queryVector, productVector);
                    similarities.add(new ProductSimilarity(product, similarity));
                }
            }

            // 4. 按相似度降序排序，取前limit个
            return similarities.stream()
                    .sorted((a, b) -> Double.compare(b.similarity, a.similarity))
                    .limit(limit)
                    .filter(s -> s.similarity > 0.3) // 相似度阈值
                    .map(s -> s.product)
                    .collect(Collectors.toList());

        } catch (Exception e) {
            log.error("向量搜索失败: query={}", query, e);
            return fallbackKeywordSearch(query, limit);
        }
    }

    @Override
    public float[] vectorizeProduct(GoodsSpu product) {
        if (product == null) {
            return new float[VECTOR_DIMENSION];
        }

        // 构建商品文本：名称 + 卖点 + 描述
        StringBuilder textBuilder = new StringBuilder();
        if (product.getName() != null) {
            textBuilder.append(product.getName()).append(" ");
        }
        if (product.getSellPoint() != null) {
            textBuilder.append(product.getSellPoint()).append(" ");
        }
        if (product.getDescription() != null) {
            textBuilder.append(product.getDescription());
        }

        String text = textBuilder.toString().trim();
        return generateEmbedding(text);
    }

    @Override
    public void batchVectorizeProducts(List<GoodsSpu> products) {
        if (products == null || products.isEmpty()) {
            return;
        }

        log.info("开始批量向量化商品，共 {} 个", products.size());
        int successCount = 0;
        int failCount = 0;

        for (GoodsSpu product : products) {
            try {
                float[] vector = vectorizeProduct(product);
                if (!isZeroVector(vector)) {
                    cacheProductVector(product.getId(), vector);
                    successCount++;
                } else {
                    failCount++;
                }
                // 避免API限流
                Thread.sleep(100);
            } catch (Exception e) {
                log.warn("向量化商品失败: productId={}", product.getId(), e);
                failCount++;
            }
        }

        log.info("批量向量化完成: 成功={}, 失败={}", successCount, failCount);
    }

    @Override
    public void refreshProductVector(String productId) {
        if (productId == null) {
            return;
        }

        GoodsSpu product = goodsSpuMapper.selectById(productId);
        if (product != null) {
            float[] vector = vectorizeProduct(product);
            cacheProductVector(productId, vector);
            log.info("刷新商品向量缓存: productId={}", productId);
        }
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /**
     * 获取商品向量（优先从缓存获取）
     */
    private float[] getProductVector(GoodsSpu product) {
        String cacheKey = PRODUCT_VECTOR_KEY_PREFIX + product.getId();

        // 尝试从缓存获取
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof List) {
            List<Number> cachedList = (List<Number>) cached;
            float[] vector = new float[cachedList.size()];
            for (int i = 0; i < cachedList.size(); i++) {
                vector[i] = cachedList.get(i).floatValue();
            }
            return vector;
        }

        // 缓存未命中，生成向量并缓存
        float[] vector = vectorizeProduct(product);
        if (!isZeroVector(vector)) {
            cacheProductVector(product.getId(), vector);
        }
        return vector;
    }

    /**
     * 缓存商品向量
     */
    private void cacheProductVector(String productId, float[] vector) {
        String cacheKey = PRODUCT_VECTOR_KEY_PREFIX + productId;
        List<Float> vectorList = new ArrayList<>();
        for (float v : vector) {
            vectorList.add(v);
        }
        redisTemplate.opsForValue().set(cacheKey, vectorList, VECTOR_CACHE_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * 检查是否为零向量
     */
    private boolean isZeroVector(float[] vector) {
        if (vector == null || vector.length == 0) {
            return true;
        }
        for (float v : vector) {
            if (v != 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * 降级关键词搜索
     */
    private List<GoodsSpu> fallbackKeywordSearch(String query, int limit) {
        LambdaQueryWrapper<GoodsSpu> wrapper = new LambdaQueryWrapper<>();
        wrapper.and(w -> {
            String[] words = query.split("\\s+");
            for (String word : words) {
                w.or(q -> q.like(GoodsSpu::getName, word)
                        .or().like(GoodsSpu::getDescription, word)
                        .or().like(GoodsSpu::getSellPoint, word));
            }
        });
        wrapper.eq(GoodsSpu::getShelf, "1")
                .last("LIMIT " + limit);
        return goodsSpuMapper.selectList(wrapper);
    }

    /**
     * 商品相似度辅助类
     */
    private static class ProductSimilarity {
        GoodsSpu product;
        double similarity;

        ProductSimilarity(GoodsSpu product, double similarity) {
            this.product = product;
            this.similarity = similarity;
        }
    }
}
