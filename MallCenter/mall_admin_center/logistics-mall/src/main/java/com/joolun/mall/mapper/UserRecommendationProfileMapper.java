package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.UserRecommendationProfile;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 用户推荐画像Mapper
 */
public interface UserRecommendationProfileMapper extends BaseMapper<UserRecommendationProfile> {

    /**
     * 根据微信用户ID查询画像
     */
    @Select("SELECT * FROM user_recommendation_profiles WHERE wx_user_id = #{wxUserId}")
    UserRecommendationProfile selectByWxUserId(@Param("wxUserId") String wxUserId);

    /**
     * 更新画像状态和统计
     */
    @Update("UPDATE user_recommendation_profiles SET " +
            "profile_status = #{status}, behavior_count = #{behaviorCount}, " +
            "last_active_time = NOW(), update_time = NOW() " +
            "WHERE wx_user_id = #{wxUserId}")
    int updateStatus(@Param("wxUserId") String wxUserId,
                     @Param("status") String status,
                     @Param("behaviorCount") int behaviorCount);

    /**
     * 更新品类偏好
     */
    @Update("UPDATE user_recommendation_profiles SET " +
            "category_preferences = #{categoryPreferences}, update_time = NOW() " +
            "WHERE wx_user_id = #{wxUserId}")
    int updateCategoryPreferences(@Param("wxUserId") String wxUserId,
                                   @Param("categoryPreferences") String categoryPreferences);

    /**
     * 查询冷启动用户
     */
    @Select("SELECT * FROM user_recommendation_profiles WHERE profile_status = 'cold_start' " +
            "ORDER BY create_time DESC LIMIT #{limit}")
    List<UserRecommendationProfile> selectColdStartUsers(@Param("limit") int limit);

    /**
     * 查询活跃用户
     */
    @Select("SELECT * FROM user_recommendation_profiles WHERE profile_status = 'mature' " +
            "AND last_active_time > DATE_SUB(NOW(), INTERVAL #{days} DAY)")
    List<UserRecommendationProfile> selectActiveUsers(@Param("days") int days);
}
