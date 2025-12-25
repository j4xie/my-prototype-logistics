/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.joolun.mall.config.CommonConstants;
import com.joolun.mall.entity.*;
import com.joolun.mall.enums.OrderInfoEnum;
import com.joolun.mall.mapper.*;
import com.joolun.mall.service.DashboardService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 仪表盘服务实现
 *
 * @author MallCenter
 * @date 2024-12-25
 */
@Slf4j
@Service
@AllArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final OrderInfoMapper orderInfoMapper;
    private final GoodsSpuMapper goodsSpuMapper;
    private final MerchantMapper merchantMapper;
    private final TraceabilityBatchMapper traceabilityBatchMapper;

    @Override
    public Map<String, Object> getOverview() {
        Map<String, Object> result = new HashMap<>();

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().atTime(LocalTime.MAX);
        LocalDateTime yesterdayStart = LocalDate.now().minusDays(1).atStartOfDay();
        LocalDateTime yesterdayEnd = LocalDate.now().minusDays(1).atTime(LocalTime.MAX);

        // 今日订单数
        Long todayOrders = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, todayStart)
                .le(OrderInfo::getCreateTime, todayEnd));

        // 昨日订单数
        Long yesterdayOrders = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, yesterdayStart)
                .le(OrderInfo::getCreateTime, yesterdayEnd));

        // 计算订单增长率
        double orderGrowth = 0;
        if (yesterdayOrders > 0) {
            orderGrowth = ((double)(todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
        }

        // 今日销售额
        List<OrderInfo> todayOrderList = orderInfoMapper.selectList(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, todayStart)
                .le(OrderInfo::getCreateTime, todayEnd)
                .eq(OrderInfo::getIsPay, CommonConstants.YES));
        BigDecimal todaySales = todayOrderList.stream()
                .map(OrderInfo::getPaymentPrice)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 昨日销售额
        List<OrderInfo> yesterdayOrderList = orderInfoMapper.selectList(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, yesterdayStart)
                .le(OrderInfo::getCreateTime, yesterdayEnd)
                .eq(OrderInfo::getIsPay, CommonConstants.YES));
        BigDecimal yesterdaySales = yesterdayOrderList.stream()
                .map(OrderInfo::getPaymentPrice)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 计算销售额增长率
        double salesGrowth = 0;
        if (yesterdaySales.compareTo(BigDecimal.ZERO) > 0) {
            salesGrowth = todaySales.subtract(yesterdaySales)
                    .divide(yesterdaySales, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal(100))
                    .doubleValue();
        }

        // 商品总数
        Long totalProducts = goodsSpuMapper.selectCount(Wrappers.<GoodsSpu>lambdaQuery()
                .eq(GoodsSpu::getShelf, CommonConstants.YES));

        // 商户总数
        Long totalMerchants = merchantMapper.selectCount(Wrappers.<Merchant>lambdaQuery()
                .eq(Merchant::getStatus, 1));

        result.put("todayOrders", todayOrders);
        result.put("orderGrowth", Math.round(orderGrowth * 100.0) / 100.0);
        result.put("todaySales", todaySales);
        result.put("salesGrowth", Math.round(salesGrowth * 100.0) / 100.0);
        result.put("totalProducts", totalProducts);
        result.put("totalMerchants", totalMerchants);

        return result;
    }

    @Override
    public Map<String, Object> getOrderStats(String period) {
        Map<String, Object> result = new HashMap<>();

        LocalDateTime startTime;
        LocalDateTime endTime = LocalDateTime.now();

        switch (period) {
            case "week":
                startTime = LocalDate.now().minusWeeks(1).atStartOfDay();
                break;
            case "month":
                startTime = LocalDate.now().minusMonths(1).atStartOfDay();
                break;
            default: // today
                startTime = LocalDate.now().atStartOfDay();
        }

        // 各状态订单数
        Long pendingPayment = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, startTime)
                .le(OrderInfo::getCreateTime, endTime)
                .eq(OrderInfo::getIsPay, CommonConstants.NO));

        Long pendingShip = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, startTime)
                .le(OrderInfo::getCreateTime, endTime)
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_1.getValue()));

        Long shipped = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, startTime)
                .le(OrderInfo::getCreateTime, endTime)
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_2.getValue()));

        Long completed = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, startTime)
                .le(OrderInfo::getCreateTime, endTime)
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_3.getValue()));

        Long cancelled = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .ge(OrderInfo::getCreateTime, startTime)
                .le(OrderInfo::getCreateTime, endTime)
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_5.getValue()));

        result.put("pendingPayment", pendingPayment);
        result.put("pendingShip", pendingShip);
        result.put("shipped", shipped);
        result.put("completed", completed);
        result.put("cancelled", cancelled);
        result.put("total", pendingPayment + pendingShip + shipped + completed + cancelled);

        return result;
    }

    @Override
    public Map<String, Object> getSalesTrend(String period) {
        Map<String, Object> result = new HashMap<>();

        List<String> dates = new ArrayList<>();
        List<BigDecimal> salesData = new ArrayList<>();
        List<Long> orderData = new ArrayList<>();

        int days;
        DateTimeFormatter formatter;

        switch (period) {
            case "month":
                days = 30;
                formatter = DateTimeFormatter.ofPattern("MM-dd");
                break;
            case "year":
                days = 365;
                formatter = DateTimeFormatter.ofPattern("yyyy-MM");
                break;
            default: // week
                days = 7;
                formatter = DateTimeFormatter.ofPattern("MM-dd");
        }

        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.atTime(LocalTime.MAX);

            dates.add(date.format(formatter));

            // 当日销售额
            List<OrderInfo> dayOrders = orderInfoMapper.selectList(Wrappers.<OrderInfo>lambdaQuery()
                    .ge(OrderInfo::getCreateTime, dayStart)
                    .le(OrderInfo::getCreateTime, dayEnd)
                    .eq(OrderInfo::getIsPay, CommonConstants.YES));

            BigDecimal daySales = dayOrders.stream()
                    .map(OrderInfo::getPaymentPrice)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            salesData.add(daySales);
            orderData.add((long) dayOrders.size());
        }

        result.put("dates", dates);
        result.put("salesData", salesData);
        result.put("orderData", orderData);

        return result;
    }

    @Override
    public List<Map<String, Object>> getHotProducts(Integer limit) {
        if (limit == null || limit <= 0) {
            limit = 5;
        }

        List<GoodsSpu> hotProducts = goodsSpuMapper.selectList(Wrappers.<GoodsSpu>lambdaQuery()
                .eq(GoodsSpu::getShelf, CommonConstants.YES)
                .orderByDesc(GoodsSpu::getSaleNum)
                .last("LIMIT " + limit));

        return hotProducts.stream().map(product -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", product.getId());
            item.put("name", product.getName());
            item.put("picUrl", product.getPicUrls() != null && product.getPicUrls().length > 0
                    ? product.getPicUrls()[0] : null);
            item.put("salesPrice", product.getSalesPrice());
            item.put("saleNum", product.getSaleNum());
            item.put("stock", product.getStock());
            return item;
        }).collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> getTodoList() {
        List<Map<String, Object>> todoList = new ArrayList<>();

        // 待发货订单
        Long pendingShip = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_1.getValue()));
        if (pendingShip > 0) {
            Map<String, Object> todo = new HashMap<>();
            todo.put("type", "order");
            todo.put("title", "待发货订单");
            todo.put("count", pendingShip);
            todo.put("link", "/mall/orderinfo");
            todoList.add(todo);
        }

        // 待审核商户
        Long pendingMerchants = merchantMapper.selectCount(Wrappers.<Merchant>lambdaQuery()
                .eq(Merchant::getStatus, 0));
        if (pendingMerchants > 0) {
            Map<String, Object> todo = new HashMap<>();
            todo.put("type", "merchant");
            todo.put("title", "待审核商户");
            todo.put("count", pendingMerchants);
            todo.put("link", "/mall/merchant");
            todoList.add(todo);
        }

        // 库存预警商品 (库存 < 10)
        Long lowStockProducts = goodsSpuMapper.selectCount(Wrappers.<GoodsSpu>lambdaQuery()
                .eq(GoodsSpu::getShelf, CommonConstants.YES)
                .lt(GoodsSpu::getStock, 10));
        if (lowStockProducts > 0) {
            Map<String, Object> todo = new HashMap<>();
            todo.put("type", "stock");
            todo.put("title", "库存预警商品");
            todo.put("count", lowStockProducts);
            todo.put("link", "/mall/goodsspu");
            todoList.add(todo);
        }

        // 退款申请
        Long refundOrders = orderInfoMapper.selectCount(Wrappers.<OrderInfo>lambdaQuery()
                .eq(OrderInfo::getStatus, OrderInfoEnum.STATUS_4.getValue()));
        if (refundOrders > 0) {
            Map<String, Object> todo = new HashMap<>();
            todo.put("type", "refund");
            todo.put("title", "退款申请");
            todo.put("count", refundOrders);
            todo.put("link", "/mall/orderinfo");
            todoList.add(todo);
        }

        return todoList;
    }

    @Override
    public List<Map<String, Object>> getRecentOrders(Integer limit) {
        if (limit == null || limit <= 0) {
            limit = 10;
        }

        List<OrderInfo> recentOrders = orderInfoMapper.selectList(Wrappers.<OrderInfo>lambdaQuery()
                .orderByDesc(OrderInfo::getCreateTime)
                .last("LIMIT " + limit));

        return recentOrders.stream().map(order -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", order.getId());
            item.put("orderNo", order.getOrderNo());
            item.put("name", order.getName());
            item.put("paymentPrice", order.getPaymentPrice());
            item.put("status", order.getStatus());
            item.put("isPay", order.getIsPay());
            item.put("createTime", order.getCreateTime());
            return item;
        }).collect(Collectors.toList());
    }

    @Override
    public Map<String, Object> getMerchantStats() {
        Map<String, Object> result = new HashMap<>();

        // 商户总数
        Long total = merchantMapper.selectCount(Wrappers.lambdaQuery());

        // 已认证商户
        Long verified = merchantMapper.selectCount(Wrappers.<Merchant>lambdaQuery()
                .eq(Merchant::getStatus, 1));

        // 待审核商户
        Long pending = merchantMapper.selectCount(Wrappers.<Merchant>lambdaQuery()
                .eq(Merchant::getStatus, 0));

        // 已拒绝商户
        Long rejected = merchantMapper.selectCount(Wrappers.<Merchant>lambdaQuery()
                .eq(Merchant::getStatus, 2));

        result.put("total", total);
        result.put("verified", verified);
        result.put("pending", pending);
        result.put("rejected", rejected);

        return result;
    }

    @Override
    public Map<String, Object> getTraceabilityStats() {
        Map<String, Object> result = new HashMap<>();

        // 溯源批次总数
        Long totalBatches = traceabilityBatchMapper.selectCount(Wrappers.lambdaQuery());

        // 本月新增批次
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        Long monthlyBatches = traceabilityBatchMapper.selectCount(Wrappers.<TraceabilityBatch>lambdaQuery()
                .ge(TraceabilityBatch::getCreateTime, monthStart));

        // 各状态批次统计
        Long activeBatches = traceabilityBatchMapper.selectCount(Wrappers.<TraceabilityBatch>lambdaQuery()
                .eq(TraceabilityBatch::getStatus, 1));
        Long completedBatches = traceabilityBatchMapper.selectCount(Wrappers.<TraceabilityBatch>lambdaQuery()
                .eq(TraceabilityBatch::getStatus, 2));

        result.put("totalBatches", totalBatches);
        result.put("monthlyBatches", monthlyBatches);
        result.put("activeBatches", activeBatches);
        result.put("completedBatches", completedBatches);

        return result;
    }
}
