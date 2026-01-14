package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.AiDecorationSession;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * AI装修会话Mapper
 */
public interface AiDecorationSessionMapper extends BaseMapper<AiDecorationSession> {

    /**
     * 分页查询会话
     */
    IPage<AiDecorationSession> selectPage1(IPage<AiDecorationSession> page, @Param("query") AiDecorationSession query);

    /**
     * 根据会话UUID查询
     */
    AiDecorationSession selectBySessionId(@Param("sessionId") String sessionId);

    /**
     * 查询商户的会话列表
     */
    List<AiDecorationSession> selectByMerchantId(@Param("merchantId") Long merchantId);

    /**
     * 查询用户的活跃会话
     */
    List<AiDecorationSession> selectActiveByUserId(@Param("userId") Long userId);

    /**
     * 查询过期的会话
     */
    List<AiDecorationSession> selectExpiredSessions();

    // ============ 统计方法 ============

    /**
     * 获取平均反馈分数
     */
    Double selectAvgFeedbackScore();

    /**
     * 获取今日会话数
     */
    Long selectTodayCount();

    /**
     * 获取本周会话数
     */
    Long selectWeekCount();

    /**
     * 获取热门行业TOP N
     */
    List<Map<String, Object>> selectTopIndustries(@Param("limit") int limit);

    /**
     * 获取热门风格TOP N
     */
    List<Map<String, Object>> selectTopStyles(@Param("limit") int limit);

    /**
     * 获取商户AI使用统计
     */
    List<Map<String, Object>> selectMerchantUsageStats();
}
