package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.ReferralRewardConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 推荐奖励配置Mapper
 */
@Mapper
public interface ReferralRewardConfigMapper extends BaseMapper<ReferralRewardConfig> {
    
    /**
     * 查询有效的奖励配置
     */
    List<ReferralRewardConfig> selectActiveConfigs();
    
    /**
     * 根据推荐类型查询配置
     */
    ReferralRewardConfig selectByReferralType(@Param("referralType") Integer referralType);
}
