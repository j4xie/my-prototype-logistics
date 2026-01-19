/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.Coupon;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 优惠券Mapper
 *
 * @author JL
 * @date 2024-12-25
 */
@Mapper
public interface CouponMapper extends BaseMapper<Coupon> {

    /**
     * 查询适用于指定商品的活跃优惠券
     * 条件: 状态启用 + 在有效期内 + (适用于所有商品 OR 适用于该商品 OR 适用于该分类)
     */
    @Select("SELECT c.* FROM mall_coupon c " +
            "WHERE c.status = '1' " +
            "AND c.start_time <= NOW() " +
            "AND c.expire_time > NOW() " +
            "AND (c.applicable_spu_ids IS NULL OR c.applicable_spu_ids = '' " +
            "     OR FIND_IN_SET(#{productId}, c.applicable_spu_ids) > 0) " +
            "LIMIT 10")
    List<Coupon> selectActiveByProductId(@Param("productId") String productId);
}
