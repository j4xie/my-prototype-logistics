package com.joolun.mall.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.dto.industry.*;
import com.joolun.mall.service.IndustryAnalysisService;
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
 * 行业分析服务实现
 * 集成LLM API进行实时AI分析，使用Redis缓存
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IndustryAnalysisServiceImpl implements IndustryAnalysisService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final StringRedisTemplate redisTemplate;

    @Value("${ai.llm.api-key:}")
    private String llmApiKey;

    @Value("${ai.llm.base-url:}")
    private String llmBaseUrl;

    @Value("${ai.llm.model:}")
    private String llmModel;

    // 缓存配置
    private static final String CACHE_KEY = "industry:analysis:latest";
    private static final long CACHE_TTL_MINUTES = 30;

    // AI提示词
    private static final String INDUSTRY_ANALYSIS_PROMPT = """
        你是食品溯源行业的资深分析师。请基于你的知识生成一份食品溯源行业分析报告。

        当前日期: %s
        分析维度: 食品溯源行业(中国市场)

        请以JSON格式返回以下结构的分析:
        {
          "highlights": [
            {"label": "市场规模", "value": "¥1280亿", "change": "+12%%", "trend": "up", "icon": "chart-line"},
            {"label": "年增长率", "value": "+23%%", "change": "+5%%", "trend": "up", "icon": "trending-up"},
            {"label": "参与企业", "value": "15,600+", "change": "+8%%", "trend": "up", "icon": "building"},
            {"label": "渗透率", "value": "92%%", "change": "+3%%", "trend": "stable", "icon": "percent"}
          ],
          "trends": [
            {"title": "AI智能溯源兴起", "tag": "hot", "description": "人工智能技术与溯源系统深度融合，实现智能识别、自动追踪", "hotIndex": 95, "keywords": ["AI", "机器学习", "智能识别"]},
            {"title": "区块链溯源标准化", "tag": "rising", "description": "区块链技术应用逐步规范，行业标准正在形成", "hotIndex": 88, "keywords": ["区块链", "标准化", "可信溯源"]},
            {"title": "全链路数字化", "tag": "hot", "description": "从生产到消费全链路数字化管理成为主流", "hotIndex": 92, "keywords": ["数字化", "全链路", "可视化"]}
          ],
          "competitors": [
            {"rank": 1, "name": "蚂蚁链溯源", "share": "18.5%%", "shareValue": 18.5, "change": "up"},
            {"rank": 2, "name": "京东云溯源", "share": "15.2%%", "shareValue": 15.2, "change": "stable"},
            {"rank": 3, "name": "腾讯安心追溯", "share": "12.8%%", "shareValue": 12.8, "change": "up"},
            {"rank": 4, "name": "华为云溯源", "share": "9.5%%", "shareValue": 9.5, "change": "up"},
            {"rank": 5, "name": "阿里健康", "share": "8.3%%", "shareValue": 8.3, "change": "stable"}
          ],
          "opportunities": [
            {"title": "中小企业数字化转型", "description": "大量传统食品企业寻求数字化溯源解决方案，市场需求旺盛", "potential": "high", "potentialScore": 92, "icon": "rocket", "gradientStart": "#667eea", "gradientEnd": "#764ba2", "tags": ["转型", "中小企业", "SaaS"]},
            {"title": "跨境食品溯源", "description": "进出口食品溯源需求增长，国际互认体系建设加速", "potential": "high", "potentialScore": 88, "icon": "globe", "gradientStart": "#f093fb", "gradientEnd": "#f5576c", "tags": ["跨境", "国际", "互认"]},
            {"title": "政策红利释放", "description": "食品安全法规趋严，溯源系统成为合规刚需", "potential": "medium", "potentialScore": 85, "icon": "shield", "gradientStart": "#4facfe", "gradientEnd": "#00f2fe", "tags": ["政策", "合规", "法规"]}
          ],
          "insights": [
            {"title": "技术融合加速", "content": "AI、区块链、IoT等技术与溯源系统深度融合，单一技术方案向综合解决方案演进，技术壁垒持续提升。", "type": "technology", "confidence": 0.92, "importance": "critical", "source": "行业研究"},
            {"title": "市场集中度提升", "content": "头部企业市场份额持续扩大，Top5企业合计占比超过64%%，中小型服务商面临整合压力。", "type": "market", "confidence": 0.88, "importance": "important", "source": "市场分析"},
            {"title": "政策驱动明显", "content": "食品安全法修订和地方配套政策密集出台，溯源系统从可选变为刚需，合规需求成为主要增长动力。", "type": "policy", "confidence": 0.95, "importance": "critical", "source": "政策研究"},
            {"title": "成本下降趋势", "content": "云服务和SaaS模式普及使溯源系统实施成本大幅下降，中小企业采用门槛降低。", "type": "opportunity", "confidence": 0.85, "importance": "important", "source": "成本分析"},
            {"title": "数据安全挑战", "content": "溯源数据涉及企业核心商业信息，数据安全和隐私保护成为行业发展的关键挑战。", "type": "risk", "confidence": 0.90, "importance": "important", "source": "风险评估"}
          ]
        }

        要求:
        1. 数据应基于真实的行业认知，反映当前市场状况
        2. 趋势标签使用 "hot" 或 "rising"
        3. 洞察内容要有深度，每条50-100字
        4. 所有数字要合理，不要过于夸张
        5. 只返回JSON，不要有其他内容
        """;

    @Override
    public IndustryAnalysisDTO getIndustryAnalysis(boolean forceRefresh) {
        // 1. 检查缓存（除非强制刷新）
        if (!forceRefresh && isCacheValid()) {
            try {
                String cachedJson = redisTemplate.opsForValue().get(CACHE_KEY);
                if (cachedJson != null) {
                    IndustryAnalysisDTO cached = objectMapper.readValue(cachedJson, IndustryAnalysisDTO.class);
                    cached.setFromCache(true);
                    cached.setCacheRemainingSeconds(getCacheRemainingSeconds());
                    log.info("返回缓存的行业分析报告，剩余{}秒", cached.getCacheRemainingSeconds());
                    return cached;
                }
            } catch (Exception e) {
                log.warn("读取缓存失败，将重新生成", e);
            }
        }

        // 2. 调用AI生成分析
        log.info("开始调用LLM API生成行业分析报告...");
        IndustryAnalysisDTO result = generateAnalysisFromAI();

        // 3. 存入缓存
        if ("success".equals(result.getStatus())) {
            saveToCache(result);
        }

        return result;
    }

    @Override
    public boolean isCacheValid() {
        try {
            Long ttl = redisTemplate.getExpire(CACHE_KEY, TimeUnit.SECONDS);
            return ttl != null && ttl > 0;
        } catch (Exception e) {
            log.warn("检查缓存状态失败", e);
            return false;
        }
    }

    @Override
    public long getCacheRemainingSeconds() {
        try {
            Long ttl = redisTemplate.getExpire(CACHE_KEY, TimeUnit.SECONDS);
            return ttl != null ? ttl : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    @Override
    public void invalidateCache() {
        try {
            redisTemplate.delete(CACHE_KEY);
            log.info("行业分析缓存已清除");
        } catch (Exception e) {
            log.error("清除缓存失败", e);
        }
    }

    /**
     * 调用LLM API生成行业分析
     */
    private IndustryAnalysisDTO generateAnalysisFromAI() {
        LocalDateTime now = LocalDateTime.now();

        // 检查API Key配置
        if (llmApiKey == null || llmApiKey.isEmpty()) {
            log.error("LLM API Key未配置");
            return buildErrorResponse("AI服务未配置，请联系管理员", now);
        }

        try {
            // 构建请求
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(llmApiKey);

            String currentDate = now.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
            String prompt = String.format(INDUSTRY_ANALYSIS_PROMPT, currentDate);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", llmModel);
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", "你是一个专业的行业分析师，擅长食品溯源行业研究。"),
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

                log.info("LLM API响应成功，开始解析内容");
                return parseAIResponse(content, now);
            } else {
                log.error("LLM API响应异常: {}", response.getStatusCode());
                return buildErrorResponse("AI服务响应异常，请稍后重试", now);
            }

        } catch (Exception e) {
            log.error("调用LLM API失败", e);
            return buildErrorResponse("AI分析服务暂时不可用: " + e.getMessage(), now);
        }
    }

    /**
     * 解析AI响应内容
     */
    private IndustryAnalysisDTO parseAIResponse(String content, LocalDateTime now) {
        try {
            JsonNode json = objectMapper.readTree(content);

            // 解析各部分数据
            List<HighlightMetric> highlights = objectMapper.convertValue(
                    json.get("highlights"),
                    new TypeReference<List<HighlightMetric>>() {}
            );

            List<TrendItem> trends = objectMapper.convertValue(
                    json.get("trends"),
                    new TypeReference<List<TrendItem>>() {}
            );

            List<CompetitorRank> competitors = objectMapper.convertValue(
                    json.get("competitors"),
                    new TypeReference<List<CompetitorRank>>() {}
            );

            List<OpportunityCard> opportunities = objectMapper.convertValue(
                    json.get("opportunities"),
                    new TypeReference<List<OpportunityCard>>() {}
            );

            List<InsightItem> insights = objectMapper.convertValue(
                    json.get("insights"),
                    new TypeReference<List<InsightItem>>() {}
            );

            return IndustryAnalysisDTO.builder()
                    .generatedAt(now)
                    .nextRefreshAt(now.plusMinutes(CACHE_TTL_MINUTES))
                    .fromCache(false)
                    .cacheRemainingSeconds(CACHE_TTL_MINUTES * 60)
                    .status("success")
                    .highlights(highlights)
                    .trends(trends)
                    .competitors(competitors)
                    .opportunities(opportunities)
                    .insights(insights)
                    .reportTitle("食品溯源行业分析报告")
                    .reportSubtitle(now.format(DateTimeFormatter.ofPattern("yyyy年MM月")))
                    .aiModelVersion(llmModel)
                    .build();

        } catch (Exception e) {
            log.error("解析AI响应失败", e);
            return buildErrorResponse("AI响应解析失败: " + e.getMessage(), now);
        }
    }

    /**
     * 构建错误响应
     */
    private IndustryAnalysisDTO buildErrorResponse(String errorMessage, LocalDateTime now) {
        return IndustryAnalysisDTO.builder()
                .generatedAt(now)
                .fromCache(false)
                .status("failed")
                .errorMessage(errorMessage)
                .reportTitle("食品溯源行业分析报告")
                .reportSubtitle("加载失败")
                .build();
    }

    /**
     * 保存到缓存
     */
    private void saveToCache(IndustryAnalysisDTO data) {
        try {
            String json = objectMapper.writeValueAsString(data);
            redisTemplate.opsForValue().set(CACHE_KEY, json, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
            log.info("行业分析报告已缓存，有效期{}分钟", CACHE_TTL_MINUTES);
        } catch (Exception e) {
            log.error("保存缓存失败", e);
        }
    }
}
