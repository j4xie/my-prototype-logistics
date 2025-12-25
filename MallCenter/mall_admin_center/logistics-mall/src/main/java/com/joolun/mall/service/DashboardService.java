/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.mall.service;

import java.util.List;
import java.util.Map;

/**
 * 仪表盘服务
 *
 * @author MallCenter
 * @date 2024-12-25
 */
public interface DashboardService {

    /**
     * 获取仪表盘概览数据
     * @return 概览数据
     */
    Map<String, Object> getOverview();

    /**
     * 获取订单统计数据
     * @param period 统计周期 (today, week, month)
     * @return 订单统计
     */
    Map<String, Object> getOrderStats(String period);

    /**
     * 获取销售趋势数据
     * @param period 统计周期 (week, month, year)
     * @return 销售趋势
     */
    Map<String, Object> getSalesTrend(String period);

    /**
     * 获取热门商品
     * @param limit 数量限制
     * @return 热门商品列表
     */
    List<Map<String, Object>> getHotProducts(Integer limit);

    /**
     * 获取待办事项列表
     * @return 待办事项
     */
    List<Map<String, Object>> getTodoList();

    /**
     * 获取最近订单
     * @param limit 数量限制
     * @return 最近订单列表
     */
    List<Map<String, Object>> getRecentOrders(Integer limit);

    /**
     * 获取商户统计
     * @return 商户统计数据
     */
    Map<String, Object> getMerchantStats();

    /**
     * 获取溯源统计
     * @return 溯源统计数据
     */
    Map<String, Object> getTraceabilityStats();
}
