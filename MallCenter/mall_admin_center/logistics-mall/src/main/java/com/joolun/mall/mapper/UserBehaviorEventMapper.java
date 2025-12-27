package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.UserBehaviorEvent;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 用户行为事件Mapper
 */
public interface UserBehaviorEventMapper extends BaseMapper<UserBehaviorEvent> {

    /**
     * P0性能优化: 批量插入用户行为事件
     * 将 N 次 INSERT 合并为 1 次批量 INSERT
     * @param list 行为事件列表
     * @return 插入数量
     */
    int insertBatch(@Param("list") List<UserBehaviorEvent> list);

    /**
     * 查询用户最近的行为事件
     */
    @Select("SELECT * FROM user_behavior_events WHERE wx_user_id = #{wxUserId} " +
            "ORDER BY event_time DESC LIMIT #{limit}")
    List<UserBehaviorEvent> selectRecentEvents(@Param("wxUserId") String wxUserId,
                                                @Param("limit") int limit);

    /**
     * 查询用户在指定时间范围内的行为事件
     */
    @Select("SELECT * FROM user_behavior_events WHERE wx_user_id = #{wxUserId} " +
            "AND event_time BETWEEN #{startTime} AND #{endTime} " +
            "ORDER BY event_time DESC")
    List<UserBehaviorEvent> selectByTimeRange(@Param("wxUserId") String wxUserId,
                                               @Param("startTime") LocalDateTime startTime,
                                               @Param("endTime") LocalDateTime endTime);

    /**
     * 统计用户行为类型分布
     */
    @Select("SELECT event_type, COUNT(*) as count FROM user_behavior_events " +
            "WHERE wx_user_id = #{wxUserId} GROUP BY event_type")
    List<Map<String, Object>> selectEventTypeStats(@Param("wxUserId") String wxUserId);

    /**
     * 查询用户浏览过的商品ID列表
     */
    @Select("SELECT DISTINCT target_id FROM user_behavior_events " +
            "WHERE wx_user_id = #{wxUserId} AND target_type = 'product' " +
            "AND event_type IN ('view', 'click') ORDER BY event_time DESC LIMIT #{limit}")
    List<String> selectViewedProductIds(@Param("wxUserId") String wxUserId,
                                         @Param("limit") int limit);

    /**
     * 查询用户搜索历史
     */
    @Select("SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.search_keyword')) as keyword " +
            "FROM user_behavior_events WHERE wx_user_id = #{wxUserId} AND event_type = 'search' " +
            "ORDER BY event_time DESC LIMIT #{limit}")
    List<String> selectSearchHistory(@Param("wxUserId") String wxUserId, @Param("limit") int limit);

    /**
     * 统计用户总行为数
     */
    @Select("SELECT COUNT(*) FROM user_behavior_events WHERE wx_user_id = #{wxUserId}")
    int countByWxUserId(@Param("wxUserId") String wxUserId);
}
