package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.dto.analysis.FactoryAnalysisDTO;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.service.FactoryAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 工厂分析服务实现
 * 集成LLM API进行实时AI分析，使用Redis缓存
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FactoryAnalysisServiceImpl implements FactoryAnalysisService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final StringRedisTemplate redisTemplate;
    private final MerchantMapper merchantMapper;

    @Value("${ai.llm.api-key:}")
    private String llmApiKey;

    @Value("${ai.llm.base-url:}")
    private String llmBaseUrl;

    @Value("${ai.llm.model:}")
    private String llmModel;

    // 缓存配置
    private static final String CACHE_KEY_PREFIX = "factory:analysis:";
    private static final long CACHE_TTL_MINUTES = 60;

    // AI提示词模板
    private static final String FACTORY_ANALYSIS_PROMPT = """
        你是食品供应链行业的资深分析师。请基于以下工厂/商户信息生成分析报告。

        工厂/商户信息:
        - ID: %s
        - 名称: %s
        - 类型: %s
        - 地址: %s
        - 经营年限: %s年
        - 商品数量: %s
        - 订单数量: %s
        - 总销售额: %s
        - 评分: %s
        - 好评率: %s%%
        - 状态: %s
        - 当前日期: %s

        请以JSON格式返回以下结构的分析:
        {
          "factory": {
            "id": "%s",
            "name": "%s"
          },
          "reportDate": "%s",
          "overallScore": "85",
          "scoreLevel": "良好",
          "percentile": "领先 75%% 的同类工厂",
          "keyMetrics": [
            {"label": "生产规模", "value": "中型"},
            {"label": "合规性评分", "value": "95"},
            {"label": "年销售额", "value": "¥%s"}
          ],
          "monthlyData": [
            {"month": "8月", "percent": 70},
            {"month": "9月", "percent": 75},
            {"month": "10月", "percent": 80},
            {"month": "11月", "percent": 82},
            {"month": "12月", "percent": 85}
          ],
          "strengths": ["供应链完善，配送时效有保障", "产品品质稳定，好评率高", "经营资质齐全，合规经营"],
          "weaknesses": ["产品线相对单一", "市场覆盖范围有待扩大"],
          "insights": [
            {"icon": "chart-line", "title": "销售趋势", "desc": "近6个月销售额稳步增长，同比增长约XX%%。"},
            {"icon": "star", "title": "客户评价", "desc": "客户满意度保持在较高水平，好评率达到XX%%。"},
            {"icon": "lightbulb", "title": "发展建议", "desc": "建议拓展产品品类，增强市场竞争力。"}
          ]
        }

        要求:
        1. 数据要基于提供的工厂信息进行合理推断
        2. 评分数据应在60-100之间
        3. 分析要有针对性，结合实际业务场景
        4. 月度数据应体现增长趋势
        5. 只返回JSON，不要有其他内容
        """;

    @Override
    public FactoryAnalysisDTO getFactoryAnalysis(Long factoryId) {
        log.info("生成工厂分析报告: factoryId={}", factoryId);

        // 1. 检查缓存
        String cacheKey = CACHE_KEY_PREFIX + factoryId;
        try {
            String cachedJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedJson != null) {
                FactoryAnalysisDTO cached = objectMapper.readValue(cachedJson, FactoryAnalysisDTO.class);
                log.info("返回缓存的工厂分析报告: factoryId={}", factoryId);
                return cached;
            }
        } catch (Exception e) {
            log.warn("读取缓存失败，将重新生成", e);
        }

        // 2. 获取商户信息
        Merchant merchant = merchantMapper.selectById(factoryId);
        if (merchant == null) {
            return buildErrorResponse("工厂/商户不存在: " + factoryId);
        }

        // 3. 调用AI生成分析
        FactoryAnalysisDTO result = generateAnalysisFromAI(merchant);

        // 4. 存入缓存
        if ("success".equals(result.getStatus())) {
            saveToCache(cacheKey, result);
        }

        return result;
    }

    /**
     * 调用AI生成工厂分析
     */
    private FactoryAnalysisDTO generateAnalysisFromAI(Merchant merchant) {
        // 检查API Key配置
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            log.error("LLM API Key未配置");
            return buildErrorResponse("AI服务未配置，请联系管理员");
        }

        try {
            // 构建请求
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            String currentDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
            String reportDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

            // 格式化销售额
            String totalSalesStr = merchant.getTotalSales() != null
                    ? formatMoney(merchant.getTotalSales().longValue())
                    : "暂无数据";

            // 获取状态描述
            String statusStr = getStatusDescription(merchant.getStatus());

            String prompt = String.format(FACTORY_ANALYSIS_PROMPT,
                    merchant.getId(),
                    merchant.getMerchantName() != null ? merchant.getMerchantName() : "未命名商户",
                    merchant.getCompanyType() != null ? getCompanyTypeDescription(merchant.getCompanyType()) : "未分类",
                    merchant.getAddress() != null ? merchant.getAddress() : "未知",
                    merchant.getOperatingYears() != null ? merchant.getOperatingYears().toString() : "1",
                    merchant.getProductCount() != null ? merchant.getProductCount().toString() : "0",
                    merchant.getOrderCount() != null ? merchant.getOrderCount().toString() : "0",
                    totalSalesStr,
                    merchant.getRating() != null ? merchant.getRating().toString() : "4.0",
                    merchant.getReviewRate() != null ? merchant.getReviewRate().toString() : "90",
                    statusStr,
                    currentDate,
                    merchant.getId(),
                    merchant.getMerchantName() != null ? merchant.getMerchantName() : "未命名商户",
                    reportDate,
                    totalSalesStr
            );

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", "你是一个专业的食品供应链分析师，擅长分析工厂和商户的经营状况。"),
                    Map.of("role", "user", "content", prompt)
            ));
            requestBody.put("temperature", 0.7);
            requestBody.put("response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            // 调用API
            ResponseEntity<String> response = restTemplate.exchange(
                    llmBaseUrl + "/v1/chat/completions",
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // 解析响应
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();

                log.info("LLM API响应成功，解析工厂分析内容");
                return parseAIResponse(content);
            } else {
                log.error("LLM API响应异常: {}", response.getStatusCode());
                return buildErrorResponse("AI服务响应异常，请稍后重试");
            }

        } catch (Exception e) {
            log.error("调用LLM API失败", e);
            return buildErrorResponse("AI分析服务暂时不可用: " + e.getMessage());
        }
    }

    /**
     * 解析AI响应内容
     */
    private FactoryAnalysisDTO parseAIResponse(String content) {
        try {
            JsonNode json = objectMapper.readTree(content);

            // 解析工厂信息
            FactoryAnalysisDTO.FactoryInfo factoryInfo = objectMapper.convertValue(
                    json.get("factory"),
                    FactoryAnalysisDTO.FactoryInfo.class
            );

            // 解析各部分数据
            List<FactoryAnalysisDTO.MetricItem> keyMetrics = objectMapper.convertValue(
                    json.get("keyMetrics"),
                    new TypeReference<List<FactoryAnalysisDTO.MetricItem>>() {}
            );

            List<FactoryAnalysisDTO.MonthlyDataItem> monthlyData = objectMapper.convertValue(
                    json.get("monthlyData"),
                    new TypeReference<List<FactoryAnalysisDTO.MonthlyDataItem>>() {}
            );

            List<String> strengths = objectMapper.convertValue(
                    json.get("strengths"),
                    new TypeReference<List<String>>() {}
            );

            List<String> weaknesses = objectMapper.convertValue(
                    json.get("weaknesses"),
                    new TypeReference<List<String>>() {}
            );

            List<FactoryAnalysisDTO.InsightItem> insights = objectMapper.convertValue(
                    json.get("insights"),
                    new TypeReference<List<FactoryAnalysisDTO.InsightItem>>() {}
            );

            return FactoryAnalysisDTO.builder()
                    .factory(factoryInfo)
                    .reportDate(json.path("reportDate").asText())
                    .overallScore(json.path("overallScore").asText())
                    .scoreLevel(json.path("scoreLevel").asText())
                    .percentile(json.path("percentile").asText())
                    .keyMetrics(keyMetrics)
                    .monthlyData(monthlyData)
                    .strengths(strengths)
                    .weaknesses(weaknesses)
                    .insights(insights)
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
    private FactoryAnalysisDTO buildErrorResponse(String errorMessage) {
        return FactoryAnalysisDTO.builder()
                .status("failed")
                .errorMessage(errorMessage)
                .build();
    }

    /**
     * 保存到缓存
     */
    private void saveToCache(String cacheKey, FactoryAnalysisDTO data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
            log.info("工厂分析报告已缓存，有效期{}分钟", CACHE_TTL_MINUTES);
        } catch (Exception e) {
            log.error("保存缓存失败", e);
        }
    }

    /**
     * 格式化金额
     */
    private String formatMoney(long amount) {
        if (amount >= 100000000) {
            return String.format("%.2f亿", amount / 100000000.0);
        } else if (amount >= 10000) {
            return String.format("%.2f万", amount / 10000.0);
        } else {
            return String.valueOf(amount);
        }
    }

    /**
     * 获取公司类型描述
     */
    private String getCompanyTypeDescription(String type) {
        if (type == null) return "未分类";
        switch (type) {
            case "manufacturer": return "生产商";
            case "distributor": return "分销商";
            case "restaurant": return "餐饮企业";
            case "retailer": return "零售商";
            default: return "其他";
        }
    }

    /**
     * 获取状态描述
     */
    private String getStatusDescription(Integer status) {
        if (status == null) return "未知";
        switch (status) {
            case 0: return "待审核";
            case 1: return "已认证";
            case 2: return "已封禁";
            case 3: return "已注销";
            default: return "未知";
        }
    }
}























