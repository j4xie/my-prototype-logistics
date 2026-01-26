package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.AiDemandRecord;
import com.joolun.mall.entity.GoodsSpu;

import java.util.List;
import java.util.Map;

/**
 * AI推荐服务接口
 */
public interface AiRecommendService extends IService<AiDemandRecord> {

    /**
     * AI对话并推荐商品
     * @param sessionId 会话ID
     * @param userId 用户ID
     * @param merchantId 商户ID
     * @param message 用户消息
     * @return AI回复和推荐商品
     */
    Map<String, Object> chat(String sessionId, Long userId, Long merchantId, String message);

    /**
     * 语义搜索商品
     * @param query 搜索语句
     * @param limit 返回数量
     * @return 匹配的商品列表
     */
    List<GoodsSpu> semanticSearch(String query, int limit);

    /**
     * 记录AI需求
     */
    void recordDemand(String sessionId, Long userId, Long merchantId, String userMessage,
                      String aiResponse, List<String> keywords, String intent, double confidence,
                      List<String> matchedProductIds, String demandType);

    /**
     * 获取会话历史
     */
    List<AiDemandRecord> getSessionHistory(String sessionId);

    /**
     * 分页查询需求记录
     */
    IPage<AiDemandRecord> pageDemands(IPage<AiDemandRecord> page, AiDemandRecord query);

    /**
     * 更新用户反馈
     */
    boolean updateFeedback(Long id, Integer feedback);

    /**
     * 获取需求类型分布
     */
    Map<String, Integer> getDemandTypeDistribution(int days);

    /**
     * 获取行业分析报告
     * @param forceRefresh 是否强制刷新缓存
     * @return 行业分析数据
     */
    Map<String, Object> getIndustryAnalysis(boolean forceRefresh);

    /**
     * 获取产品分析报告
     * @param productId 产品ID
     * @return 产品分析数据
     */
    Map<String, Object> getProductAnalysis(String productId);

    /**
     * 获取工厂分析报告
     * @param factoryId 工厂/供应商ID
     * @return 工厂分析数据
     */
    Map<String, Object> getFactoryAnalysis(Long factoryId);

    /**
     * 清空会话历史 (新对话时调用)
     * @param sessionId 会话ID
     */
    void clearConversationHistory(String sessionId);
}
