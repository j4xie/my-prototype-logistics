package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.Referral;
import com.joolun.mall.entity.ReferralRewardConfig;
import com.joolun.mall.mapper.ReferralMapper;
import com.joolun.mall.mapper.ReferralRewardConfigMapper;
import com.joolun.mall.service.ReferralService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 推荐系统服务实现
 */
@Service
@RequiredArgsConstructor
public class ReferralServiceImpl extends ServiceImpl<ReferralMapper, Referral> implements ReferralService {
    
    private final ReferralMapper referralMapper;
    private final ReferralRewardConfigMapper rewardConfigMapper;
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Referral createReferral(Referral referral) {
        referral.setStatus(0); // 待确认
        referral.setCreateTime(LocalDateTime.now());
        referral.setUpdateTime(LocalDateTime.now());
        referralMapper.insert(referral);
        return referral;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean confirmReferral(Long referralId) {
        Referral referral = referralMapper.selectById(referralId);
        if (referral == null || referral.getStatus() != 0) {
            return false;
        }
        referral.setStatus(1); // 已确认
        referral.setUpdateTime(LocalDateTime.now());
        return referralMapper.updateById(referral) > 0;
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean grantReward(Long referralId, BigDecimal rewardAmount, Integer rewardType) {
        Referral referral = referralMapper.selectById(referralId);
        if (referral == null || referral.getStatus() != 1) {
            return false;
        }
        referral.setStatus(2); // 已奖励
        referral.setRewardAmount(rewardAmount);
        referral.setRewardType(rewardType);
        referral.setRewardTime(LocalDateTime.now());
        referral.setUpdateTime(LocalDateTime.now());
        return referralMapper.updateById(referral) > 0;
    }
    
    @Override
    public List<Referral> listByReferrer(Long referrerId) {
        return referralMapper.selectByReferrerId(referrerId);
    }
    
    @Override
    public IPage<Referral> pageReferrals(Page<Referral> page, Long referrerId, Integer status, Integer referralType) {
        LambdaQueryWrapper<Referral> wrapper = new LambdaQueryWrapper<>();
        if (referrerId != null) {
            wrapper.eq(Referral::getReferrerId, referrerId);
        }
        if (status != null) {
            wrapper.eq(Referral::getStatus, status);
        }
        if (referralType != null) {
            wrapper.eq(Referral::getReferralType, referralType);
        }
        wrapper.orderByDesc(Referral::getCreateTime);
        return referralMapper.selectPage(page, wrapper);
    }
    
    @Override
    public ReferralStatistics getReferrerStatistics(Long referrerId) {
        ReferralStatistics stats = new ReferralStatistics();
        stats.setReferrerId(referrerId);
        stats.setTotalCount(referralMapper.countByReferrerId(referrerId, null));
        stats.setConfirmedCount(referralMapper.countByReferrerId(referrerId, 1));
        stats.setRewardedCount(referralMapper.countByReferrerId(referrerId, 2));
        stats.setTotalReward(referralMapper.sumRewardByReferrerId(referrerId));
        return stats;
    }
    
    @Override
    public List<Referral> listByReferralCode(String referralCode) {
        return referralMapper.selectByReferralCode(referralCode);
    }
    
    @Override
    public String generateReferralCode(Long userId) {
        // 生成6位推荐码：用户ID的哈希 + 随机字符
        String base = String.valueOf(userId);
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
        return base.hashCode() % 100 + uuid;
    }
    
    @Override
    public List<ReferralRewardConfig> getActiveRewardConfigs() {
        return rewardConfigMapper.selectActiveConfigs();
    }
    
    @Override
    public ReferralRewardConfig getRewardConfigByType(Integer referralType) {
        return rewardConfigMapper.selectByReferralType(referralType);
    }
    
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int processPendingRewards() {
        List<Referral> pendingList = referralMapper.selectPendingRewards();
        int processed = 0;
        for (Referral referral : pendingList) {
            ReferralRewardConfig config = getRewardConfigByType(referral.getReferralType());
            if (config != null) {
                BigDecimal reward = config.getReferrerReward();
                if (reward != null && reward.compareTo(BigDecimal.ZERO) > 0) {
                    grantReward(referral.getId(), reward, config.getRewardType());
                    processed++;
                }
            }
        }
        return processed;
    }
}
