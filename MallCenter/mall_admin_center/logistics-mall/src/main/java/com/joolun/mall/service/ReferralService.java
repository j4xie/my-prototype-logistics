package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.Referral;
import com.joolun.mall.entity.ReferralRewardConfig;

import java.math.BigDecimal;
import java.util.List;

/**
 * 推荐系统服务接口
 */
public interface ReferralService extends IService<Referral> {
    
    /**
     * 创建推荐记录
     */
    Referral createReferral(Referral referral);
    
    /**
     * 确认推荐有效
     */
    boolean confirmReferral(Long referralId);
    
    /**
     * 发放奖励
     */
    boolean grantReward(Long referralId, BigDecimal rewardAmount, Integer rewardType);
    
    /**
     * 根据推荐人查询推荐记录
     */
    List<Referral> listByReferrer(Long referrerId);
    
    /**
     * 分页查询推荐记录
     */
    IPage<Referral> pageReferrals(Page<Referral> page, Long referrerId, Integer status, Integer referralType);
    
    /**
     * 统计推荐人数据
     */
    ReferralStatistics getReferrerStatistics(Long referrerId);
    
    /**
     * 根据推荐码查询
     */
    List<Referral> listByReferralCode(String referralCode);
    
    /**
     * 生成用户推荐码
     */
    String generateReferralCode(Long userId);
    
    /**
     * 获取有效的奖励配置
     */
    List<ReferralRewardConfig> getActiveRewardConfigs();
    
    /**
     * 根据推荐类型获取配置
     */
    ReferralRewardConfig getRewardConfigByType(Integer referralType);
    
    /**
     * 处理待发放奖励
     */
    int processPendingRewards();
    
    /**
     * 推荐人统计数据DTO
     */
    class ReferralStatistics {
        private Long referrerId;
        private int totalCount;
        private int confirmedCount;
        private int rewardedCount;
        private BigDecimal totalReward;
        
        public Long getReferrerId() { return referrerId; }
        public void setReferrerId(Long referrerId) { this.referrerId = referrerId; }
        public int getTotalCount() { return totalCount; }
        public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
        public int getConfirmedCount() { return confirmedCount; }
        public void setConfirmedCount(int confirmedCount) { this.confirmedCount = confirmedCount; }
        public int getRewardedCount() { return rewardedCount; }
        public void setRewardedCount(int rewardedCount) { this.rewardedCount = rewardedCount; }
        public BigDecimal getTotalReward() { return totalReward; }
        public void setTotalReward(BigDecimal totalReward) { this.totalReward = totalReward; }
    }
}
