package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.Referral;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;

/**
 * 推荐记录Mapper
 */
@Mapper
public interface ReferralMapper extends BaseMapper<Referral> {
    
    /**
     * 根据推荐人ID查询推荐记录
     */
    List<Referral> selectByReferrerId(@Param("referrerId") Long referrerId);
    
    /**
     * 根据被推荐人ID查询
     */
    Referral selectByRefereeId(@Param("refereeId") Long refereeId);
    
    /**
     * 根据推荐码查询
     */
    List<Referral> selectByReferralCode(@Param("referralCode") String referralCode);
    
    /**
     * 统计推荐人的推荐数量
     */
    int countByReferrerId(@Param("referrerId") Long referrerId, @Param("status") Integer status);
    
    /**
     * 统计推荐人的总奖励金额
     */
    BigDecimal sumRewardByReferrerId(@Param("referrerId") Long referrerId);
    
    /**
     * 查询待发放奖励的推荐记录
     */
    List<Referral> selectPendingRewards();
}
