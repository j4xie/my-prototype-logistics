package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.ContentReview;

import java.util.List;
import java.util.Map;

/**
 * 内容审核服务接口
 */
public interface ContentReviewService extends IService<ContentReview> {
    
    /**
     * 提交审核
     */
    ContentReview submitReview(ContentReview review);
    
    /**
     * 审核通过
     */
    boolean approve(Long reviewId, Long reviewerId, String reviewerName, String remark);
    
    /**
     * 审核拒绝
     */
    boolean reject(Long reviewId, Long reviewerId, String reviewerName, String rejectReason);
    
    /**
     * 退回修改
     */
    boolean returnForModification(Long reviewId, Long reviewerId, String reviewerName, String remark);
    
    /**
     * 分页查询审核记录
     */
    IPage<ContentReview> pageReviews(Page<ContentReview> page, Integer contentType, Integer status, Long merchantId);
    
    /**
     * 查询待审核内容
     */
    List<ContentReview> listPendingReviews(Integer contentType, Long merchantId);
    
    /**
     * 根据内容查询审核记录
     */
    ContentReview getByContent(Integer contentType, Long contentId);
    
    /**
     * 查询商户的审核记录
     */
    List<ContentReview> listByMerchant(Long merchantId);
    
    /**
     * 统计各状态数量
     */
    List<Map<String, Object>> countByStatus(Integer contentType);
    
    /**
     * 更新AI审核结果
     */
    boolean updateAiResult(Long reviewId, String aiResult, Integer aiScore);
}
