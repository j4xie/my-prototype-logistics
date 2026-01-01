package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.dto.analysis.ProductAnalysisDTO;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.mapper.GoodsSpuMapper;
import com.joolun.mall.service.ProductAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 产品分析服务实现
 * 集成DeepSeek/DashScope API进行实时AI分析，使用Redis缓存
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductAnalysisServiceImpl implements ProductAnalysisService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final StringRedisTemplate redisTemplate;
    private final GoodsSpuMapper goodsSpuMapper;

    @Value("${ai.deepseek.api-key:}")
    private String deepseekApiKey;

    @Value("${ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepseekBaseUrl;

    @Value("${ai.deepseek.model:deepseek-chat}")
    private String deepseekModel;

    // 缓存配置
    private static final String CACHE_KEY_PREFIX = "product:analysis:";
    private static final long CACHE_TTL_MINUTES = 60;

    // AI提示词模板
    private static final String PRODUCT_ANALYSIS_PROMPT = """
        你是食品电商行业的资深产品分析师。请基于以下产品信息生成分析报告。

        产品信息:
        - ID: %s
        - 名称: %s
        - 分类: %s
        - 价格: %s元
        - 库存: %s
        - 销量: %s
        - 状态: %s
        - 当前日期: %s

        请以JSON格式返回以下结构的分析:
        {
          "product": {
            "id": "%s",
            "name": "%s",
            "category": "%s",
            "image": "/static/images/product_default.jpg",
            "stars": "4.5",
            "score": "85",
            "reviewCount": "500"
          },
          "coreMetrics": [
            {"label": "复购率", "value": "25%%"},
            {"label": "好评率", "value": "95%%"},
            {"label": "行业排名", "value": "Top 20%%"}
          ],
          "qualityMetrics": [
            {"label": "新鲜度", "score": 88},
            {"label": "包装完好", "score": 92},
            {"label": "物流速度", "score": 85},
            {"label": "性价比", "score": 80}
          ],
          "comparison": [
            {"metric": "价格", "value": "¥%s", "arrow": "down", "average": "¥XX", "better": true},
            {"metric": "月销量", "value": "%s", "arrow": "up", "average": "XXX", "better": true},
            {"metric": "退货率", "value": "1.2%%", "arrow": "down", "average": "2.5%%", "better": true}
          ],
          "reviews": [
            {"id": 1, "user": "张先生", "date": "2025-01-15", "stars": "5.0", "content": "产品质量很好，包装也很专业。"},
            {"id": 2, "user": "李女士", "date": "2025-01-10", "stars": "4.0", "content": "还不错，性价比高。"}
          ],
          "tags": ["热销产品", "品质保障", "快速发货"],
          "aiSuggestion": {
            "strengths": ["产品定价合理，具有竞争力", "库存充足，供应稳定"],
            "improvements": ["可考虑增加规格选项", "建议优化产品描述"]
          }
        }

        要求:
        1. 数据要基于提供的产品信息进行合理推断
        2. 评分数据应在合理范围内(60-100)
        3. 分析要有针对性，不要过于泛化
        4. 所有数字要合理可信
        5. 只返回JSON，不要有其他内容
        """;

    @Override
    public ProductAnalysisDTO getProductAnalysis(Long productId) {
        log.info("生成产品分析报告: productId={}", productId);

        // 1. 检查缓存
        String cacheKey = CACHE_KEY_PREFIX + productId;
        try {
            String cachedJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedJson != null) {
                ProductAnalysisDTO cached = objectMapper.readValue(cachedJson, ProductAnalysisDTO.class);
                log.info("返回缓存的产品分析报告: productId={}", productId);
                return cached;
            }
        } catch (Exception e) {
            log.warn("读取缓存失败，将重新生成", e);
        }

        // 2. 获取产品信息
        GoodsSpu product = goodsSpuMapper.selectById(productId.toString());
        if (product == null) {
            return buildErrorResponse("产品不存在: " + productId);
        }

        // 3. 调用AI生成分析
        ProductAnalysisDTO result = generateAnalysisFromAI(product);

        // 4. 存入缓存
        if ("success".equals(result.getStatus())) {
            saveToCache(cacheKey, result);
        }

        return result;
    }

    /**
     * 调用AI生成产品分析
     */
    private ProductAnalysisDTO generateAnalysisFromAI(GoodsSpu product) {
        // 检查API Key配置
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            log.error("DeepSeek API Key未配置");
            return buildErrorResponse("AI服务未配置，请联系管理员");
        }

        try {
            // 构建请求
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepseekApiKey);

            String currentDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
            String categoryInfo = product.getCategoryFirst() != null ? product.getCategoryFirst() : "未分类";
            String prompt = String.format(PRODUCT_ANALYSIS_PROMPT,
                    product.getId(),
                    product.getName() != null ? product.getName() : "未命名产品",
                    categoryInfo,
                    product.getSalesPrice() != null ? product.getSalesPrice().toString() : "0",
                    product.getStock() != null ? product.getStock().toString() : "0",
                    product.getSaleNum() != null ? product.getSaleNum().toString() : "0",
                    "1".equals(product.getShelf()) ? "上架" : "下架",
                    currentDate,
                    product.getId(),
                    product.getName() != null ? product.getName() : "未命名产品",
                    categoryInfo,
                    product.getSalesPrice() != null ? product.getSalesPrice().toString() : "0",
                    product.getSaleNum() != null ? product.getSaleNum().toString() : "0"
            );

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", deepseekModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", "你是一个专业的食品电商产品分析师，擅长分析产品竞争力和优化建议。"),
                    Map.of("role", "user", "content", prompt)
            ));
            requestBody.put("temperature", 0.7);
            requestBody.put("response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            // 调用API
            ResponseEntity<String> response = restTemplate.exchange(
                    deepseekBaseUrl + "/v1/chat/completions",
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // 解析响应
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();

                log.info("DeepSeek API响应成功，解析产品分析内容");
                return parseAIResponse(content, product);
            } else {
                log.error("DeepSeek API响应异常: {}", response.getStatusCode());
                return buildErrorResponse("AI服务响应异常，请稍后重试");
            }

        } catch (Exception e) {
            log.error("调用DeepSeek API失败", e);
            return buildErrorResponse("AI分析服务暂时不可用: " + e.getMessage());
        }
    }

    /**
     * 解析AI响应内容
     */
    private ProductAnalysisDTO parseAIResponse(String content, GoodsSpu product) {
        try {
            JsonNode json = objectMapper.readTree(content);

            // 解析产品信息
            ProductAnalysisDTO.ProductInfo productInfo = objectMapper.convertValue(
                    json.get("product"),
                    ProductAnalysisDTO.ProductInfo.class
            );

            // 使用实际产品图片
            if (product.getPicUrls() != null && product.getPicUrls().length > 0) {
                productInfo.setImage(product.getPicUrls()[0]);
            }

            // 解析各部分数据
            List<ProductAnalysisDTO.MetricItem> coreMetrics = objectMapper.convertValue(
                    json.get("coreMetrics"),
                    new TypeReference<List<ProductAnalysisDTO.MetricItem>>() {}
            );

            List<ProductAnalysisDTO.QualityMetric> qualityMetrics = objectMapper.convertValue(
                    json.get("qualityMetrics"),
                    new TypeReference<List<ProductAnalysisDTO.QualityMetric>>() {}
            );

            List<ProductAnalysisDTO.ComparisonItem> comparison = objectMapper.convertValue(
                    json.get("comparison"),
                    new TypeReference<List<ProductAnalysisDTO.ComparisonItem>>() {}
            );

            List<ProductAnalysisDTO.ReviewItem> reviews = objectMapper.convertValue(
                    json.get("reviews"),
                    new TypeReference<List<ProductAnalysisDTO.ReviewItem>>() {}
            );

            List<String> tags = objectMapper.convertValue(
                    json.get("tags"),
                    new TypeReference<List<String>>() {}
            );

            ProductAnalysisDTO.AiSuggestion aiSuggestion = objectMapper.convertValue(
                    json.get("aiSuggestion"),
                    ProductAnalysisDTO.AiSuggestion.class
            );

            return ProductAnalysisDTO.builder()
                    .product(productInfo)
                    .coreMetrics(coreMetrics)
                    .qualityMetrics(qualityMetrics)
                    .comparison(comparison)
                    .reviews(reviews)
                    .tags(tags)
                    .aiSuggestion(aiSuggestion)
                    .status("success")
                    .build();

        } catch (Exception e) {
            log.error("解析AI响应失败", e);
            return buildErrorResponse("AI响应解析失败: " + e.getMessage());
        }
    }

    /**
     * 构建错误响应
     */
    private ProductAnalysisDTO buildErrorResponse(String errorMessage) {
        return ProductAnalysisDTO.builder()
                .status("failed")
                .errorMessage(errorMessage)
                .build();
    }

    /**
     * 保存到缓存
     */
    private void saveToCache(String cacheKey, ProductAnalysisDTO data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
            log.info("产品分析报告已缓存，有效期{}分钟", CACHE_TTL_MINUTES);
        } catch (Exception e) {
            log.error("保存缓存失败", e);
        }
    }
}












