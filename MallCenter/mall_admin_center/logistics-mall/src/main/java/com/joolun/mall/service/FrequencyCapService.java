package com.joolun.mall.service;

import com.joolun.mall.entity.GoodsSpu;
import java.util.List;
import java.util.Set;

/**
 * 频控服务
 * 防止同一商品短期内重复推荐给用户
 *
 * 频控规则:
 * - 同一商品24小时内最多曝光1次
 * - 同一商品7天内最多曝光3次
 */
public interface FrequencyCapService {

    /**
     * 记录商品曝光
     *
     * @param wxUserId 用户微信ID
     * @param productId 商品ID
     */
    void recordExposure(String wxUserId, String productId);

    /**
     * 批量记录曝光
     *
     * @param wxUserId 用户微信ID
     * @param productIds 商品ID列表
     */
    void recordExposures(String wxUserId, List<String> productIds);

    /**
     * 检查商品是否在频控窗口内
     *
     * @param wxUserId 用户微信ID
     * @param productId 商品ID
     * @return true-商品被频控(不应再推荐), false-可以推荐
     */
    boolean isInFrequencyCap(String wxUserId, String productId);

    /**
     * 获取用户频控商品列表
     * 返回当前处于频控状态的所有商品ID
     *
     * @param wxUserId 用户微信ID
     * @return 被频控的商品ID集合
     */
    Set<String> getFrequencyCappedProducts(String wxUserId);

    /**
     * 过滤掉频控商品
     * 从候选商品列表中移除被频控的商品
     *
     * @param wxUserId 用户微信ID
     * @param products 候选商品列表
     * @return 过滤后的商品列表
     */
    List<GoodsSpu> filterByFrequencyCap(String wxUserId, List<GoodsSpu> products);

    /**
     * 获取用户近期曝光统计
     *
     * @param wxUserId 用户微信ID
     * @param days 统计天数
     * @return 曝光次数
     */
    int getRecentExposureCount(String wxUserId, int days);

    /**
     * 清理过期曝光数据
     * 手动触发清理7天前的数据
     *
     * @param wxUserId 用户微信ID
     * @return 清理的记录数
     */
    long cleanupExpiredExposures(String wxUserId);
}
