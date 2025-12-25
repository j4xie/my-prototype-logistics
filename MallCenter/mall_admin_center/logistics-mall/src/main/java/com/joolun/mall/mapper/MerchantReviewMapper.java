package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.MerchantReview;

import java.util.List;

/**
 * 商户审核记录Mapper
 */
public interface MerchantReviewMapper extends BaseMapper<MerchantReview> {

    /**
     * 根据商户ID查询审核记录
     */
    List<MerchantReview> selectByMerchantId(Long merchantId);
}
