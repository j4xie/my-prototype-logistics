package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.RecommendationLog;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 推荐日志Mapper
 */
public interface RecommendationLogMapper extends BaseMapper<RecommendationLog> {

    /**
     * P0性能优化: 批量插入推荐日志
     * 将 N 次 INSERT 合并为 1 次批量 INSERT
     * @param list 推荐日志列表
     * @return 插入数量
     */
    int insertBatch(@Param("list") List<RecommendationLog> list);

    /**
     * 更新点击状态
     */
    @Update("UPDATE recommendation_logs SET is_clicked = 1, feedback_time = NOW() " +
            "WHERE wx_user_id = #{wxUserId} AND product_id = #{productId} " +
            "AND is_clicked = 0 ORDER BY create_time DESC LIMIT 1")
    int updateClicked(@Param("wxUserId") String wxUserId, @Param("productId") String productId);

    /**
     * 更新购买状态
     */
    @Update("UPDATE recommendation_logs SET is_purchased = 1, feedback_time = NOW() " +
            "WHERE wx_user_id = #{wxUserId} AND product_id = #{productId}")
    int updatePurchased(@Param("wxUserId") String wxUserId, @Param("productId") String productId);

    /**
     * 统计推荐效果 (点击率、转化率)
     */
    @Select("SELECT recommendation_type, " +
            "COUNT(*) as total, " +
            "SUM(is_clicked) as clicks, " +
            "SUM(is_purchased) as purchases, " +
            "SUM(is_clicked)/COUNT(*) as click_rate, " +
            "SUM(is_purchased)/COUNT(*) as convert_rate " +
            "FROM recommendation_logs " +
            "WHERE create_time > DATE_SUB(NOW(), INTERVAL #{days} DAY) " +
            "GROUP BY recommendation_type")
    List<Map<String, Object>> selectEffectStats(@Param("days") int days);
}
