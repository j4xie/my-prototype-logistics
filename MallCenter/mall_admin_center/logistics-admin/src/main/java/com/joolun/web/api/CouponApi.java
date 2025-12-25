/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.web.api;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.entity.Coupon;
import com.joolun.mall.entity.UserCoupon;
import com.joolun.mall.service.CouponService;
import com.joolun.mall.service.UserCouponService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 优惠券API
 *
 * @author JL
 * @date 2024-12-25
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/coupon")
public class CouponApi {

    private final CouponService couponService;
    private final UserCouponService userCouponService;

    /**
     * 获取我的优惠券列表 (分页)
     * @param pageNum 页码，默认1
     * @param pageSize 每页数量，默认10
     * @param status 状态筛选 (可选)
     * @return 用户优惠券分页列表
     */
    @GetMapping("/my")
    public AjaxResult getMyCoupons(
            @RequestParam(value = "pageNum", defaultValue = "1") Integer pageNum,
            @RequestParam(value = "pageSize", defaultValue = "10") Integer pageSize,
            @RequestParam(value = "status", required = false) String status) {
        String userId = ThirdSessionHolder.getWxUserId();

        // 分页查询
        Page<UserCoupon> page = new Page<>(pageNum, pageSize);
        Page<UserCoupon> result = userCouponService.page(page,
                Wrappers.<UserCoupon>lambdaQuery()
                        .eq(UserCoupon::getUserId, userId)
                        .eq(status != null, UserCoupon::getStatus, status)
                        .orderByDesc(UserCoupon::getReceiveTime));

        // 批量获取优惠券详情 (优化 N+1 查询)
        if (!result.getRecords().isEmpty()) {
            Set<String> couponIds = result.getRecords().stream()
                    .map(UserCoupon::getCouponId)
                    .collect(Collectors.toSet());
            Map<String, Coupon> couponMap = couponService.listByIds(couponIds)
                    .stream()
                    .collect(Collectors.toMap(Coupon::getId, Function.identity()));
            result.getRecords().forEach(uc -> uc.setCoupon(couponMap.get(uc.getCouponId())));
        }

        return AjaxResult.success(result);
    }

    /**
     * 获取订单可用优惠券
     * @param orderAmount 订单金额
     * @param spuIds 商品ID列表 (可选，用于商品限制判断)
     * @return 可用/不可用优惠券列表
     */
    @GetMapping("/available")
    public AjaxResult getAvailableCoupons(
            @RequestParam(value = "orderAmount", defaultValue = "0") BigDecimal orderAmount,
            @RequestParam(value = "spuIds", required = false) String spuIds) {
        String userId = ThirdSessionHolder.getWxUserId();

        // 获取用户未使用的优惠券
        List<UserCoupon> userCoupons = userCouponService.list(Wrappers.<UserCoupon>lambdaQuery()
                .eq(UserCoupon::getUserId, userId)
                .eq(UserCoupon::getStatus, "0") // 未使用
                .gt(UserCoupon::getExpireTime, LocalDateTime.now())); // 未过期

        if (userCoupons.isEmpty()) {
            return AjaxResult.success(List.of());
        }

        // 批量获取优惠券详情 (优化 N+1 查询)
        Set<String> couponIds = userCoupons.stream()
                .map(UserCoupon::getCouponId)
                .collect(Collectors.toSet());
        Map<String, Coupon> couponMap = couponService.listByIds(couponIds)
                .stream()
                .collect(Collectors.toMap(Coupon::getId, Function.identity()));

        // 填充优惠券详情并判断是否可用
        for (UserCoupon uc : userCoupons) {
            Coupon coupon = couponMap.get(uc.getCouponId());
            uc.setCoupon(coupon);

            // 检查是否可用
            if (coupon == null) {
                uc.setCanUse(false);
                uc.setDisabledReason("优惠券不存在");
            } else if (coupon.getMinAmount() != null && orderAmount.compareTo(coupon.getMinAmount()) < 0) {
                uc.setCanUse(false);
                uc.setDisabledReason("未满" + coupon.getMinAmount() + "元");
            } else if (!"1".equals(coupon.getStatus())) {
                uc.setCanUse(false);
                uc.setDisabledReason("优惠券已失效");
            } else {
                uc.setCanUse(true);
            }
        }

        // 转换为前端需要的格式，使用HashMap避免Map.of的null限制
        List<Map<String, Object>> result = userCoupons.stream().map(uc -> {
            Coupon c = uc.getCoupon();
            Map<String, Object> item = new HashMap<>();
            item.put("id", uc.getId());
            item.put("couponId", uc.getCouponId());
            item.put("name", c != null ? c.getName() : "");
            item.put("type", c != null ? c.getType() : "");
            item.put("minAmount", c != null && c.getMinAmount() != null ? c.getMinAmount() : BigDecimal.ZERO);
            item.put("discountAmount", c != null && c.getDiscountAmount() != null ? c.getDiscountAmount() : BigDecimal.ZERO);
            item.put("discountPercent", c != null && c.getDiscountPercent() != null ? c.getDiscountPercent() : BigDecimal.ZERO);
            item.put("maxDiscount", c != null && c.getMaxDiscount() != null ? c.getMaxDiscount() : BigDecimal.ZERO);
            item.put("expireTime", uc.getExpireTime() != null ? uc.getExpireTime().toString() : "");
            item.put("canUse", uc.getCanUse() != null && uc.getCanUse());
            item.put("disabledReason", uc.getDisabledReason() != null ? uc.getDisabledReason() : "");
            return item;
        }).collect(Collectors.toList());

        return AjaxResult.success(result);
    }

    /**
     * 使用优惠券
     * @param id 用户优惠券ID
     * @return 结果
     */
    @PutMapping("/{id}/use")
    public AjaxResult useCoupon(@PathVariable String id) {
        String userId = ThirdSessionHolder.getWxUserId();

        UserCoupon userCoupon = userCouponService.getById(id);
        if (userCoupon == null) {
            return AjaxResult.error("优惠券不存在");
        }
        if (!userId.equals(userCoupon.getUserId())) {
            return AjaxResult.error("无权操作此优惠券");
        }
        if (!"0".equals(userCoupon.getStatus())) {
            return AjaxResult.error("优惠券已使用或已过期");
        }

        userCoupon.setStatus("1"); // 已使用
        userCoupon.setUseTime(LocalDateTime.now());
        userCouponService.updateById(userCoupon);

        return AjaxResult.success();
    }

    /**
     * 领取优惠券
     * @param id 优惠券ID
     * @return 结果
     */
    @PostMapping("/{id}/receive")
    public AjaxResult receiveCoupon(@PathVariable String id) {
        String userId = ThirdSessionHolder.getWxUserId();

        Coupon coupon = couponService.getById(id);
        if (coupon == null) {
            return AjaxResult.error("优惠券不存在");
        }
        if (!"1".equals(coupon.getStatus())) {
            return AjaxResult.error("优惠券已失效");
        }
        if (coupon.getReceivedCount() >= coupon.getTotalCount()) {
            return AjaxResult.error("优惠券已领完");
        }

        // 检查是否已领取
        long count = userCouponService.count(Wrappers.<UserCoupon>lambdaQuery()
                .eq(UserCoupon::getUserId, userId)
                .eq(UserCoupon::getCouponId, id));
        if (count > 0) {
            return AjaxResult.error("您已领取过此优惠券");
        }

        // 创建用户优惠券
        UserCoupon userCoupon = new UserCoupon();
        userCoupon.setUserId(userId);
        userCoupon.setCouponId(id);
        userCoupon.setStatus("0"); // 未使用
        userCoupon.setReceiveTime(LocalDateTime.now());
        userCoupon.setExpireTime(coupon.getExpireTime());
        userCouponService.save(userCoupon);

        // 更新已领取数量
        coupon.setReceivedCount(coupon.getReceivedCount() + 1);
        couponService.updateById(coupon);

        return AjaxResult.success(userCoupon);
    }

    /**
     * 获取优惠券详情
     * @param id 优惠券ID
     * @return 优惠券详情
     */
    @GetMapping("/{id}")
    public AjaxResult getCouponDetail(@PathVariable String id) {
        Coupon coupon = couponService.getById(id);
        if (coupon == null) {
            return AjaxResult.error("优惠券不存在");
        }
        return AjaxResult.success(coupon);
    }
}
