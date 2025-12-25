package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.ContentReview;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 内容审核Mapper
 */
@Mapper
public interface ContentReviewMapper extends BaseMapper<ContentReview> {
    
    /**
     * 查询待审核内容
     */
    List<ContentReview> selectPendingReviews(@Param("contentType") Integer contentType, @Param("merchantId") Long merchantId);
    
    /**
     * 根据内容类型和内容ID查询
     */
    ContentReview selectByContentTypeAndId(@Param("contentType") Integer contentType, @Param("contentId") Long contentId);
    
    /**
     * 统计各状态数量
     */
    List<Map<String, Object>> countByStatus(@Param("contentType") Integer contentType);
    
    /**
     * 查询商户的审核记录
     */
    List<ContentReview> selectByMerchantId(@Param("merchantId") Long merchantId);
}
