package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantReview;
import com.joolun.mall.entity.Referral;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.MerchantReviewMapper;
import com.joolun.mall.mapper.ReferralMapper;
import com.joolun.mall.service.MerchantService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商户服务实现
 */
@Service
@RequiredArgsConstructor
public class MerchantServiceImpl extends ServiceImpl<MerchantMapper, Merchant> implements MerchantService {

    private final MerchantReviewMapper merchantReviewMapper;
    private final ReferralMapper referralMapper;

    @Override
    public IPage<Merchant> page1(IPage<Merchant> page, Merchant merchant) {
        return baseMapper.selectPage1(page, merchant);
    }

    @Override
    public Merchant getById1(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Merchant getByUserId(Long userId) {
        LambdaQueryWrapper<Merchant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Merchant::getUserId, userId);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean apply(Merchant merchant) {
        merchant.setStatus(0); // 待审核
        merchant.setCreateTime(LocalDateTime.now());

        // 处理推荐码逻辑：根据推荐码查找推荐人
        if (StringUtils.hasText(merchant.getReferralCode())) {
            Long referrerId = findReferrerByCode(merchant.getReferralCode());
            if (referrerId != null) {
                merchant.setReferrerId(referrerId);
            }
        }

        boolean result = baseMapper.insert(merchant) > 0;

        // 如果有推荐人，创建推荐记录
        if (result && merchant.getReferrerId() != null) {
            createReferralRecord(merchant);
        }

        return result;
    }

    /**
     * 根据推荐码查找推荐人ID
     */
    private Long findReferrerByCode(String referralCode) {
        // 从Referral表或用户表查找推荐码对应的用户
        LambdaQueryWrapper<Referral> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Referral::getReferralCode, referralCode)
               .last("LIMIT 1");
        Referral referral = referralMapper.selectOne(wrapper);
        if (referral != null) {
            return referral.getReferrerId();
        }
        return null;
    }

    /**
     * 创建推荐记录
     */
    private void createReferralRecord(Merchant merchant) {
        Referral referral = new Referral();
        referral.setReferrerId(merchant.getReferrerId());
        referral.setRefereeId(merchant.getUserId());
        referral.setReferralCode(merchant.getReferralCode());
        referral.setReferralType(1); // 1=商户注册
        referral.setStatus(0); // 0=待确认
        referral.setCreateTime(LocalDateTime.now());
        referralMapper.insert(referral);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean review(Long id, Integer action, String remark, Long reviewerId, String reviewerName) {
        Merchant merchant = baseMapper.selectById(id);
        if (merchant == null) {
            return false;
        }

        // 更新商户状态
        Integer newStatus = action == 1 ? 1 : 2; // 1通过 2拒绝
        merchant.setStatus(newStatus);
        merchant.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(merchant);

        // 记录审核历史
        MerchantReview review = new MerchantReview();
        review.setMerchantId(id);
        review.setAction(action);
        review.setRemark(remark);
        review.setReviewerId(reviewerId);
        review.setReviewerName(reviewerName);
        review.setCreateTime(LocalDateTime.now());
        merchantReviewMapper.insert(review);

        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateStatus(Long id, Integer status) {
        Merchant merchant = new Merchant();
        merchant.setId(id);
        merchant.setStatus(status);
        merchant.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(merchant) > 0;
    }

    @Override
    public Map<String, Object> getStats(Long id) {
        Merchant merchant = baseMapper.selectById(id);
        Map<String, Object> stats = new HashMap<>();
        if (merchant != null) {
            stats.put("goodsCount", merchant.getProductCount());
            stats.put("orderCount", merchant.getOrderCount());
            stats.put("totalSales", merchant.getTotalSales());
            stats.put("rating", merchant.getRating());
        }
        return stats;
    }

    @Override
    public List<MerchantReview> getReviewHistory(Long merchantId) {
        LambdaQueryWrapper<MerchantReview> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantReview::getMerchantId, merchantId)
               .orderByDesc(MerchantReview::getCreateTime);
        return merchantReviewMapper.selectList(wrapper);
    }

    @Override
    public long getPendingCount() {
        LambdaQueryWrapper<Merchant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Merchant::getStatus, 0);
        return baseMapper.selectCount(wrapper);
    }

    @Override
    public List<Map<String, Object>> listSimple() {
        LambdaQueryWrapper<Merchant> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Merchant::getDelFlag, 0)
               .eq(Merchant::getStatus, 1) // 只返回已认证的商户
               .select(Merchant::getId, Merchant::getMerchantNo, Merchant::getMerchantName)
               .orderByAsc(Merchant::getMerchantName);
        List<Merchant> merchants = baseMapper.selectList(wrapper);

        return merchants.stream().map(m -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", m.getId());
            map.put("merchantNo", m.getMerchantNo());
            map.put("merchantName", m.getMerchantName());
            return map;
        }).collect(java.util.stream.Collectors.toList());
    }
}
