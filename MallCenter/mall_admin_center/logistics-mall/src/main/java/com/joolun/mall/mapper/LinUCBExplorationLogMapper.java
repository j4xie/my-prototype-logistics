package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.LinUCBExplorationLog;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * LinUCB 探索日志 Mapper
 */
public interface LinUCBExplorationLogMapper extends BaseMapper<LinUCBExplorationLog> {

    /**
     * 查询用户最近的探索记录
     */
    @Select("SELECT * FROM linucb_exploration_logs " +
            "WHERE wx_user_id = #{wxUserId} " +
            "ORDER BY create_time DESC LIMIT #{limit}")
    List<LinUCBExplorationLog> selectRecentByUser(@Param("wxUserId") String wxUserId,
                                                   @Param("limit") int limit);

    /**
     * 查询用户对特定臂的最新探索记录（未反馈的）
     */
    @Select("SELECT * FROM linucb_exploration_logs " +
            "WHERE wx_user_id = #{wxUserId} AND arm_id = #{armId} " +
            "AND actual_reward IS NULL " +
            "ORDER BY create_time DESC LIMIT 1")
    LinUCBExplorationLog selectPendingFeedback(@Param("wxUserId") String wxUserId,
                                                @Param("armId") String armId);

    /**
     * 更新探索记录的反馈
     */
    @Update("UPDATE linucb_exploration_logs SET " +
            "actual_reward = #{reward}, " +
            "is_clicked = #{isClicked}, " +
            "is_purchased = #{isPurchased}, " +
            "feedback_time = NOW() " +
            "WHERE id = #{id}")
    int updateFeedback(@Param("id") Long id,
                       @Param("reward") double reward,
                       @Param("isClicked") boolean isClicked,
                       @Param("isPurchased") boolean isPurchased);

    /**
     * 统计算法效果 - 按日期分组的点击率
     */
    @Select("SELECT DATE(create_time) as date, " +
            "COUNT(*) as total, " +
            "SUM(CASE WHEN is_clicked = 1 THEN 1 ELSE 0 END) as clicks, " +
            "SUM(CASE WHEN is_clicked = 1 THEN 1 ELSE 0 END) / COUNT(*) as ctr " +
            "FROM linucb_exploration_logs " +
            "WHERE create_time >= DATE_SUB(NOW(), INTERVAL #{days} DAY) " +
            "GROUP BY DATE(create_time) " +
            "ORDER BY date DESC")
    List<java.util.Map<String, Object>> selectDailyCtr(@Param("days") int days);

    /**
     * 统计各臂的表现
     */
    @Select("SELECT arm_id, arm_type, " +
            "COUNT(*) as selections, " +
            "SUM(CASE WHEN is_clicked = 1 THEN 1 ELSE 0 END) as clicks, " +
            "AVG(expected_reward) as avg_expected, " +
            "AVG(actual_reward) as avg_actual " +
            "FROM linucb_exploration_logs " +
            "WHERE arm_type = #{armType} AND actual_reward IS NOT NULL " +
            "GROUP BY arm_id, arm_type " +
            "ORDER BY clicks DESC")
    List<java.util.Map<String, Object>> selectArmPerformance(@Param("armType") String armType);

    /**
     * 批量插入探索日志
     */
    int insertBatch(@Param("logs") List<LinUCBExplorationLog> logs);
}
