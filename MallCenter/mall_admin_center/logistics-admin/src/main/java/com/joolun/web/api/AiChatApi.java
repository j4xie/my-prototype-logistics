package com.joolun.web.api;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.AiDemandRecord;
import com.joolun.mall.entity.GoodsSpu;
import com.joolun.mall.service.AiRecommendService;
import com.joolun.system.service.ISysConfigService;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import com.joolun.web.utils.MerchantUserHelper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * AI聊天API - 小程序端
 * 提供智能客服对话和商品推荐功能
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/ai")
public class AiChatApi {

    private final AiRecommendService aiRecommendService;
    private final MerchantUserHelper merchantUserHelper;
    private final WxUserService wxUserService;
    private final ISysConfigService configService;

    /**
     * 获取当前登录用户
     */
    private WxUser getCurrentWxUser() {
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session == null || session.getWxUserId() == null) {
            return null;
        }
        return wxUserService.getById(session.getWxUserId());
    }

    /**
     * AI对话
     * 接收用户消息，返回AI回复和商品推荐
     *
     * @param params 包含 message, sessionId(可选), productId(可选), productName(可选)
     * @return AI回复和推荐商品
     */
    @PostMapping("/chat")
    public AjaxResult chat(@RequestBody Map<String, Object> params) {
        String message = (String) params.get("message");
        String sessionId = (String) params.get("sessionId");
        // 产品上下文 (从商品详情页跳转时传入)
        String productId = (String) params.get("productId");
        String productName = (String) params.get("productName");

        if (message == null || message.trim().isEmpty()) {
            return AjaxResult.error("消息不能为空");
        }

        // 如果没有sessionId，生成一个新的
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }

        // 如果有产品上下文，增强消息以便AI理解用户正在询问的产品
        String enhancedMessage = message.trim();
        if (productId != null && !productId.isEmpty()) {
            log.info("AI对话带产品上下文: productId={}, productName={}", productId, productName);
            // 在消息中注入产品上下文，帮助AI理解用户意图
            if (productName != null && !productName.isEmpty()) {
                enhancedMessage = String.format("[用户正在查看商品「%s」(ID:%s)] %s", productName, productId, message.trim());
            } else {
                enhancedMessage = String.format("[用户正在查看商品ID:%s] %s", productId, message.trim());
            }
        }

        // 获取当前用户信息
        WxUser wxUser = getCurrentWxUser();
        Long userId = null;
        Long merchantId = null;

        if (wxUser != null) {
            userId = Long.parseLong(wxUser.getId());
            // 获取用户关联的商户ID
            merchantId = merchantUserHelper.getMerchantIdFromUser(wxUser);
        }

        try {
            // 参数顺序: sessionId, userId, merchantId, message (含产品上下文)
            Map<String, Object> chatResult = aiRecommendService.chat(
                sessionId,
                userId,
                merchantId,
                enhancedMessage
            );

            // 添加sessionId到结果
            chatResult.put("sessionId", sessionId);

            return AjaxResult.success(chatResult);
        } catch (Exception e) {
            log.error("AI对话失败: message={}", message, e);

            // 返回友好的错误信息
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("sessionId", sessionId);
            errorResult.put("response", "抱歉，AI助手暂时无法响应，请稍后再试。您可以直接搜索商品名称。");
            errorResult.put("products", List.of());
            errorResult.put("error", true);

            return AjaxResult.success(errorResult);
        }
    }

    /**
     * AI流式对话 (SSE)
     * 实时推送LLM token到客户端，首字延迟 <100ms
     *
     * 事件类型:
     * - meta: 商品推荐数据 (立即发送)
     * - token: LLM生成的文本片段 (逐个推送)
     * - done: 对话完成
     * - error: 错误信息
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@RequestBody Map<String, Object> params) {
        String message = (String) params.get("message");
        String sessionId = (String) params.get("sessionId");
        String productId = (String) params.get("productId");
        String productName = (String) params.get("productName");

        SseEmitter emitter = new SseEmitter(60000L); // 60s超时

        if (message == null || message.trim().isEmpty()) {
            try {
                emitter.send(SseEmitter.event().name("error").data("{\"message\":\"消息不能为空\"}"));
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
            return emitter;
        }

        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }

        String enhancedMessage = message.trim();
        if (productId != null && !productId.isEmpty()) {
            if (productName != null && !productName.isEmpty()) {
                enhancedMessage = String.format("[用户正在查看商品「%s」(ID:%s)] %s", productName, productId, message.trim());
            } else {
                enhancedMessage = String.format("[用户正在查看商品ID:%s] %s", productId, message.trim());
            }
        }

        WxUser wxUser = getCurrentWxUser();
        Long userId = null;
        Long merchantId = null;
        if (wxUser != null) {
            userId = Long.parseLong(wxUser.getId());
            merchantId = merchantUserHelper.getMerchantIdFromUser(wxUser);
        }

        final String finalSessionId = sessionId;
        final String finalMessage = enhancedMessage;
        final Long finalUserId = userId;
        final Long finalMerchantId = merchantId;

        // 异步执行流式对话
        CompletableFuture.runAsync(() -> {
            aiRecommendService.chatStream(finalSessionId, finalUserId, finalMerchantId, finalMessage, emitter);
        });

        emitter.onTimeout(() -> {
            log.warn("SSE超时: sessionId={}", finalSessionId);
            emitter.complete();
        });
        emitter.onError(e -> {
            log.warn("SSE错误: sessionId={}, error={}", finalSessionId, e.getMessage());
        });

        return emitter;
    }

    /**
     * 语义搜索商品
     * 使用AI理解用户意图并搜索相关商品
     *
     * @param query 搜索语句
     * @param limit 返回数量
     * @return 匹配的商品列表
     */
    @GetMapping("/semantic-search")
    public AjaxResult semanticSearch(
            @RequestParam("query") String query,
            @RequestParam(value = "limit", defaultValue = "10") Integer limit) {
        if (query == null || query.trim().isEmpty()) {
            return AjaxResult.success(List.of());
        }

        try {
            List<GoodsSpu> products = aiRecommendService.semanticSearch(query.trim(), limit);
            return AjaxResult.success(products);
        } catch (Exception e) {
            log.error("语义搜索失败: query={}", query, e);
            return AjaxResult.success(List.of());
        }
    }

    /**
     * 获取会话历史
     *
     * @param sessionId 会话ID
     * @return 会话历史记录
     */
    @GetMapping("/session/{sessionId}/history")
    public AjaxResult getSessionHistory(@PathVariable("sessionId") String sessionId) {
        try {
            List<AiDemandRecord> history = aiRecommendService.getSessionHistory(sessionId);
            return AjaxResult.success(history);
        } catch (Exception e) {
            log.error("获取会话历史失败: sessionId={}", sessionId, e);
            return AjaxResult.success(List.of());
        }
    }

    /**
     * 清空会话历史 - 开始新对话时调用
     *
     * @param sessionId 会话ID
     * @return 操作结果
     */
    @DeleteMapping("/session/{sessionId}/history")
    public AjaxResult clearSessionHistory(@PathVariable("sessionId") String sessionId) {
        try {
            aiRecommendService.clearConversationHistory(sessionId);
            log.info("清空会话历史: sessionId={}", sessionId);
            return AjaxResult.success("会话历史已清空");
        } catch (Exception e) {
            log.error("清空会话历史失败: sessionId={}", sessionId, e);
            return AjaxResult.error("清空会话历史失败");
        }
    }

    /**
     * 获取用户所有会话列表
     *
     * @param page 分页参数
     * @return 会话列表
     */
    @GetMapping("/sessions")
    public AjaxResult getUserSessions(Page<AiDemandRecord> page) {
        WxUser wxUser = getCurrentWxUser();
        if (wxUser == null) {
            return AjaxResult.error("请先登录");
        }

        try {
            // 根据用户ID查询其所有会话记录
            AiDemandRecord query = new AiDemandRecord();
            query.setUserId(Long.parseLong(wxUser.getId()));

            // 使用分页查询获取用户的对话记录
            Page<AiDemandRecord> result = (Page<AiDemandRecord>) aiRecommendService.pageDemands(page, query);
            return AjaxResult.success(result);
        } catch (Exception e) {
            log.error("获取会话列表失败: userId={}", wxUser.getId(), e);
            return AjaxResult.success(List.of());
        }
    }

    /**
     * 提交用户反馈
     *
     * @param id 需求记录ID
     * @param params 包含 feedback 反馈评分 (1=满意, 0=不满意, -1=未评价)
     * @return 更新结果
     */
    @PutMapping("/demand/{id}/feedback")
    public AjaxResult updateFeedback(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> params) {
        Object feedbackObj = params.get("feedback");

        if (feedbackObj == null) {
            return AjaxResult.error("反馈内容不能为空");
        }

        try {
            // 支持整数或字符串类型的反馈值
            Integer feedback;
            if (feedbackObj instanceof Integer) {
                feedback = (Integer) feedbackObj;
            } else if (feedbackObj instanceof String) {
                feedback = Integer.parseInt((String) feedbackObj);
            } else {
                feedback = ((Number) feedbackObj).intValue();
            }

            boolean updated = aiRecommendService.updateFeedback(id, feedback);
            return updated ? AjaxResult.success("感谢您的反馈") : AjaxResult.error("反馈提交失败");
        } catch (NumberFormatException e) {
            return AjaxResult.error("反馈格式错误，请提供数字 (1=满意, 0=不满意)");
        } catch (Exception e) {
            log.error("提交反馈失败: id={}", id, e);
            return AjaxResult.error("反馈提交失败");
        }
    }

    /**
     * 检查AI服务状态
     *
     * @return 服务状态
     */
    @GetMapping("/health")
    public AjaxResult checkHealth() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "ok");
        health.put("timestamp", System.currentTimeMillis());
        // 可以添加更多健康检查，如LLM API连接状态
        return AjaxResult.success(health);
    }

    /**
     * 获取AI功能配置
     * 返回AI助手相关的配置项，用于前端控制功能显示
     *
     * @return AI配置信息
     */
    @GetMapping("/config")
    public AjaxResult getAiConfig() {
        Map<String, Object> config = new HashMap<>();
        // 获取AI助手开关配置
        String aiEnabled = configService.selectConfigByKey("mall.ai.assistant.enabled");
        config.put("enabled", "true".equalsIgnoreCase(aiEnabled));
        config.put("timestamp", System.currentTimeMillis());
        return AjaxResult.success(config);
    }

    /**
     * 获取小程序功能配置
     * 返回所有功能开关，用于前端控制功能显示/隐藏
     * 配置项在系统配置表中维护，key格式: mall.feature.xxx
     *
     * @return 功能配置信息
     */
    @GetMapping("/feature-config")
    public AjaxResult getFeatureConfig() {
        Map<String, Object> config = new HashMap<>();

        // AI助手开关
        String aiEnabled = configService.selectConfigByKey("mall.ai.assistant.enabled");
        config.put("showAI", "true".equalsIgnoreCase(aiEnabled));

        // 首页分类网格开关
        String categoriesEnabled = configService.selectConfigByKey("mall.home.categories.enabled");
        config.put("showCategories", !"false".equalsIgnoreCase(categoriesEnabled)); // 默认显示

        // 首页商品列表开关 (热销、推荐)
        String productsEnabled = configService.selectConfigByKey("mall.home.products.enabled");
        config.put("showProducts", !"false".equalsIgnoreCase(productsEnabled)); // 默认显示

        // 底部分类Tab开关
        String categoryTabEnabled = configService.selectConfigByKey("mall.tabbar.category.enabled");
        config.put("showCategoryTab", !"false".equalsIgnoreCase(categoryTabEnabled)); // 默认显示

        config.put("timestamp", System.currentTimeMillis());
        return AjaxResult.success(config);
    }

    /**
     * 获取行业分析报告
     * 提供市场趋势、热门品类、需求分布等数据
     *
     * @param forceRefresh 是否强制刷新缓存
     * @return 行业分析数据
     */
    @GetMapping("/industry-analysis")
    public AjaxResult getIndustryAnalysis(
            @RequestParam(value = "forceRefresh", defaultValue = "false") Boolean forceRefresh) {
        try {
            Map<String, Object> analysis = aiRecommendService.getIndustryAnalysis(forceRefresh);
            return AjaxResult.success(analysis);
        } catch (Exception e) {
            log.error("获取行业分析失败", e);
            return AjaxResult.error("获取行业分析失败");
        }
    }

    /**
     * 获取产品分析报告
     * 提供单个产品的咨询统计、用户意图分布、相关关键词等
     *
     * @param productId 产品ID
     * @return 产品分析数据
     */
    @GetMapping("/product-analysis/{productId}")
    public AjaxResult getProductAnalysis(@PathVariable("productId") String productId) {
        if (productId == null || productId.trim().isEmpty()) {
            return AjaxResult.error("产品ID不能为空");
        }

        try {
            Map<String, Object> analysis = aiRecommendService.getProductAnalysis(productId);
            if (analysis.containsKey("error")) {
                return AjaxResult.error((String) analysis.get("error"));
            }
            return AjaxResult.success(analysis);
        } catch (Exception e) {
            log.error("获取产品分析失败: productId={}", productId, e);
            return AjaxResult.error("获取产品分析失败");
        }
    }

    /**
     * 获取工厂/供应商分析报告
     * 提供供应商维度的产品统计、需求分布、热门关键词等
     *
     * @param factoryId 工厂/供应商ID
     * @return 工厂分析数据
     */
    @GetMapping("/factory-analysis/{factoryId}")
    public AjaxResult getFactoryAnalysis(@PathVariable("factoryId") Long factoryId) {
        if (factoryId == null) {
            return AjaxResult.error("工厂ID不能为空");
        }

        try {
            Map<String, Object> analysis = aiRecommendService.getFactoryAnalysis(factoryId);
            if (analysis.containsKey("error")) {
                return AjaxResult.error((String) analysis.get("error"));
            }
            return AjaxResult.success(analysis);
        } catch (Exception e) {
            log.error("获取工厂分析失败: factoryId={}", factoryId, e);
            return AjaxResult.error("获取工厂分析失败");
        }
    }
}
