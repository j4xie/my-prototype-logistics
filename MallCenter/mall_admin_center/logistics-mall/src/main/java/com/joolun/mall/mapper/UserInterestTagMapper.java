package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.UserInterestTag;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 用户兴趣标签Mapper
 */
public interface UserInterestTagMapper extends BaseMapper<UserInterestTag> {

    /**
     * P1性能优化: 原子性UPSERT操作
     * 使用 INSERT ON DUPLICATE KEY UPDATE 避免并发竞态条件
     *
     * @param wxUserId 用户ID
     * @param tagType 标签类型
     * @param tagValue 标签值
     * @param tagLevel 标签层级
     * @param weight 初始权重（仅新插入时使用）
     * @param confidence 置信度
     * @param source 来源
     * @param weightIncrement 权重增量（已存在时使用）
     * @return 影响行数
     */
    int upsertTag(@Param("wxUserId") String wxUserId,
                  @Param("tagType") String tagType,
                  @Param("tagValue") String tagValue,
                  @Param("tagLevel") int tagLevel,
                  @Param("weight") double weight,
                  @Param("confidence") double confidence,
                  @Param("source") String source,
                  @Param("weightIncrement") double weightIncrement);

    /**
     * 查询用户有效权重最高的标签
     */
    @Select("SELECT *, (weight * decay_factor) as effective_weight FROM user_interest_tags " +
            "WHERE wx_user_id = #{wxUserId} ORDER BY (weight * decay_factor) DESC LIMIT #{limit}")
    List<UserInterestTag> selectTopTags(@Param("wxUserId") String wxUserId, @Param("limit") int limit);

    /**
     * 查询用户指定类型的标签
     */
    @Select("SELECT * FROM user_interest_tags WHERE wx_user_id = #{wxUserId} AND tag_type = #{tagType} " +
            "ORDER BY weight DESC")
    List<UserInterestTag> selectByType(@Param("wxUserId") String wxUserId, @Param("tagType") String tagType);

    /**
     * 更新标签权重 (增加交互)
     */
    @Update("UPDATE user_interest_tags SET weight = LEAST(1.0, weight + #{increment}), " +
            "interaction_count = interaction_count + 1, last_interaction_time = NOW(), " +
            "decay_factor = 1.0, update_time = NOW() " +
            "WHERE wx_user_id = #{wxUserId} AND tag_type = #{tagType} AND tag_value = #{tagValue}")
    int updateWeightIncrement(@Param("wxUserId") String wxUserId,
                               @Param("tagType") String tagType,
                               @Param("tagValue") String tagValue,
                               @Param("increment") double increment);

    /**
     * 批量更新衰减因子 (定时任务使用)
     * 使用原始公式，由调用方控制衰减率
     */
    @Update("UPDATE user_interest_tags SET decay_factor = GREATEST(0.1, decay_factor * #{decayRate}), " +
            "update_time = NOW() WHERE last_interaction_time < DATE_SUB(NOW(), INTERVAL #{daysSinceInteraction} DAY)")
    int batchUpdateDecay(@Param("decayRate") double decayRate, @Param("daysSinceInteraction") int days);

    /**
     * 使用指数衰减公式批量更新衰减因子
     * 公式: decay = 0.5^(hours_since_interaction / (24 * halfLifeDays))
     *
     * @param halfLifeDays 半衰期（天）- 建议值为7天
     */
    @Update("UPDATE user_interest_tags SET " +
            "decay_factor = GREATEST(0.1, POW(0.5, TIMESTAMPDIFF(HOUR, last_interaction_time, NOW()) / (24.0 * #{halfLifeDays}))), " +
            "update_time = NOW() " +
            "WHERE last_interaction_time IS NOT NULL")
    int batchUpdateExponentialDecay(@Param("halfLifeDays") double halfLifeDays);

    /**
     * 删除低权重标签 (清理)
     */
    @Update("DELETE FROM user_interest_tags WHERE (weight * decay_factor) < #{threshold} " +
            "AND update_time < DATE_SUB(NOW(), INTERVAL #{days} DAY)")
    int deleteInactiveTags(@Param("threshold") double threshold, @Param("days") int days);
}
