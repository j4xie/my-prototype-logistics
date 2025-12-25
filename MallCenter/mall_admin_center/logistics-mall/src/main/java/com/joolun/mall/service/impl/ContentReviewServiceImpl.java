package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.ContentReview;
import com.joolun.mall.mapper.ContentReviewMapper;
import com.joolun.mall.service.ContentReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 内容审核服务实现
 */
@Service
@RequiredArgsConstructor
public class ContentReviewServiceImpl extends ServiceImpl<ContentReviewMapper, ContentReview> implements ContentReviewService {
    
    private final ContentReviewMapper contentReviewMapper;
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ContentReview submitReview(ContentReview review) {
        review.setStatus(0); // 待审核
        review.setCreateTime(LocalDateTime.now());
        review.setUpdateTime(LocalDateTime.now());
        if (review.getPriority() == null) {
            review.setPriority(1); // 默认普通优先级
        }
        contentReviewMapper.insert(review);
        return review;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean approve(Long reviewId, Long reviewerId, String reviewerName, String remark) {
        ContentReview review = contentReviewMapper.selectById(reviewId);
        if (review == null || review.getStatus() != 0) {
            return false;
        }
        review.setStatus(1); // 已通过
        review.setReviewerId(reviewerId);
        review.setReviewerName(reviewerName);
        review.setReviewRemark(remark);
        review.setReviewTime(LocalDateTime.now());
        review.setUpdateTime(LocalDateTime.now());
        return contentReviewMapper.updateById(review) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean reject(Long reviewId, Long reviewerId, String reviewerName, String rejectReason) {
        ContentReview review = contentReviewMapper.selectById(reviewId);
        if (review == null || review.getStatus() != 0) {
            return false;
        }
        review.setStatus(2); // 已拒绝
        review.setReviewerId(reviewerId);
        review.setReviewerName(reviewerName);
        review.setRejectReason(rejectReason);
        review.setReviewTime(LocalDateTime.now());
        review.setUpdateTime(LocalDateTime.now());
        return contentReviewMapper.updateById(review) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean returnForModification(Long reviewId, Long reviewerId, String reviewerName, String remark) {
        ContentReview review = contentReviewMapper.selectById(reviewId);
        if (review == null || review.getStatus() != 0) {
            return false;
        }
        review.setStatus(3); // 需修改
        review.setReviewerId(reviewerId);
        review.setReviewerName(reviewerName);
        review.setReviewRemark(remark);
        review.setReviewTime(LocalDateTime.now());
        review.setUpdateTime(LocalDateTime.now());
        return contentReviewMapper.updateById(review) > 0;
    }
    
    @Override
    public IPage<ContentReview> pageReviews(Page<ContentReview> page, Integer contentType, Integer status, Long merchantId) {
        LambdaQueryWrapper<ContentReview> wrapper = new LambdaQueryWrapper<>();
        if (contentType != null) {
            wrapper.eq(ContentReview::getContentType, contentType);
        }
        if (status != null) {
            wrapper.eq(ContentReview::getStatus, status);
        }
        if (merchantId != null) {
            wrapper.eq(ContentReview::getMerchantId, merchantId);
        }
        wrapper.orderByDesc(ContentReview::getPriority).orderByAsc(ContentReview::getCreateTime);
        return contentReviewMapper.selectPage(page, wrapper);
    }
    
    @Override
    public List<ContentReview> listPendingReviews(Integer contentType, Long merchantId) {
        return contentReviewMapper.selectPendingReviews(contentType, merchantId);
    }
    
    @Override
    public ContentReview getByContent(Integer contentType, Long contentId) {
        return contentReviewMapper.selectByContentTypeAndId(contentType, contentId);
    }
    
    @Override
    public List<ContentReview> listByMerchant(Long merchantId) {
        return contentReviewMapper.selectByMerchantId(merchantId);
    }
    
    @Override
    public List<Map<String, Object>> countByStatus(Integer contentType) {
        return contentReviewMapper.countByStatus(contentType);
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateAiResult(Long reviewId, String aiResult, Integer aiScore) {
        ContentReview review = contentReviewMapper.selectById(reviewId);
        if (review == null) {
            return false;
        }
        review.setAiResult(aiResult);
        review.setAiScore(aiScore);
        review.setUpdateTime(LocalDateTime.now());
        return contentReviewMapper.updateById(review) > 0;
    }
}
