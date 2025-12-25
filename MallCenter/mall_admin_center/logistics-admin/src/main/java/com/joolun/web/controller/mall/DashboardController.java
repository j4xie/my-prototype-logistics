/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.web.controller.mall;

import com.joolun.common.core.controller.BaseController;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.service.DashboardService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 仪表盘
 *
 * @author MallCenter
 * @date 2024-12-25
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/dashboard")
public class DashboardController extends BaseController {

    private final DashboardService dashboardService;

    /**
     * 获取仪表盘概览数据
     * @return 概览数据
     */
    @GetMapping("/overview")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getOverview() {
        return AjaxResult.success(dashboardService.getOverview());
    }

    /**
     * 获取订单统计数据
     * @param period 统计周期 (today, week, month)
     * @return 订单统计
     */
    @GetMapping("/order-stats")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getOrderStats(@RequestParam(defaultValue = "today") String period) {
        return AjaxResult.success(dashboardService.getOrderStats(period));
    }

    /**
     * 获取销售趋势数据
     * @param period 统计周期 (week, month, year)
     * @return 销售趋势
     */
    @GetMapping("/sales-trend")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getSalesTrend(@RequestParam(defaultValue = "week") String period) {
        return AjaxResult.success(dashboardService.getSalesTrend(period));
    }

    /**
     * 获取热门商品
     * @param limit 数量限制
     * @return 热门商品列表
     */
    @GetMapping("/hot-products")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getHotProducts(@RequestParam(defaultValue = "5") Integer limit) {
        return AjaxResult.success(dashboardService.getHotProducts(limit));
    }

    /**
     * 获取待办事项列表
     * @return 待办事项
     */
    @GetMapping("/todo")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getTodoList() {
        return AjaxResult.success(dashboardService.getTodoList());
    }

    /**
     * 获取最近订单
     * @param limit 数量限制
     * @return 最近订单列表
     */
    @GetMapping("/recent-orders")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getRecentOrders(@RequestParam(defaultValue = "10") Integer limit) {
        return AjaxResult.success(dashboardService.getRecentOrders(limit));
    }

    /**
     * 获取商户统计
     * @return 商户统计数据
     */
    @GetMapping("/merchant-stats")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getMerchantStats() {
        return AjaxResult.success(dashboardService.getMerchantStats());
    }

    /**
     * 获取溯源统计
     * @return 溯源统计数据
     */
    @GetMapping("/traceability-stats")
    @PreAuthorize("@ss.hasPermi('mall:dashboard:index')")
    public AjaxResult getTraceabilityStats() {
        return AjaxResult.success(dashboardService.getTraceabilityStats());
    }
}
