package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.SearchKeywordRecord;
import com.joolun.mall.entity.SearchKeywordStats;

import java.util.List;
import java.util.Map;

/**
 * 搜索关键词服务接口
 */
public interface SearchKeywordService extends IService<SearchKeywordRecord> {

    /**
     * 记录搜索关键词 (完整版本)
     * @param keyword 关键词
     * @param userId 用户ID
     * @param merchantId 商户ID
     * @param phone 联系电话
     * @param resultCount 搜索结果数量
     * @param source 搜索来源
     */
    void recordSearch(String keyword, Long userId, Long merchantId, String phone, int resultCount, String source);

    /**
     * 记录搜索关键词 (简化版本 - 用于小程序API)
     * @return 创建的记录
     */
    SearchKeywordRecord recordSearch(String keyword, Long userId, Long merchantId, String phone, int resultCount);

    /**
     * 分页查询搜索记录
     */
    IPage<SearchKeywordRecord> pageRecords(IPage<SearchKeywordRecord> page, SearchKeywordRecord query);

    /**
     * 分页查询关键词统计
     */
    IPage<SearchKeywordStats> pageStats(IPage<SearchKeywordStats> page, SearchKeywordStats query);

    /**
     * 获取热门搜索词
     */
    List<SearchKeywordStats> getHotKeywords(int limit);

    /**
     * 获取待处理的关键词统计
     */
    IPage<SearchKeywordStats> pagePendingStats(IPage<SearchKeywordStats> page, SearchKeywordStats query);

    /**
     * 根据ID获取统计记录
     */
    SearchKeywordStats getStatsById(Long id);

    /**
     * 匹配商品到关键词 (原版本)
     */
    boolean matchProducts(Long statsId, List<Long> productIds, Long operatorId);

    /**
     * 匹配商品到关键词 (String版本 - 用于后台API)
     */
    boolean matchProducts(Long statsId, List<String> productIds);

    /**
     * 批量通知商户 (原版本)
     */
    int notifyMerchants(Long statsId, String title, String content, boolean sendSms, Long operatorId, String operatorName);

    /**
     * 批量通知商户 (简化版本 - 用于后台API)
     * @return 包含通知结果的Map
     */
    Map<String, Object> notifyMerchants(Long statsId, Boolean sendSms, String templateCode);

    /**
     * 获取统计概览
     */
    Map<String, Object> getOverview();

    /**
     * 更新关键词状态
     */
    boolean updateStatus(Long id, Integer status, String note);

    /**
     * 更新统计记录
     */
    boolean updateStats(SearchKeywordStats stats);

    /**
     * 忽略关键词
     */
    boolean ignoreKeyword(Long statsId, String reason, Long operatorId);
}
