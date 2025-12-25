package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.AiDemandRecord;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI需求记录Mapper
 */
public interface AiDemandRecordMapper extends BaseMapper<AiDemandRecord> {

    /**
     * 分页查询需求记录
     */
    IPage<AiDemandRecord> selectPage1(IPage<AiDemandRecord> page,
                                       @Param("query") AiDemandRecord query);

    /**
     * 根据会话ID查询记录
     */
    List<AiDemandRecord> selectBySessionId(@Param("sessionId") String sessionId);

    /**
     * 查询待处理的需求
     */
    List<AiDemandRecord> selectPendingDemands(@Param("limit") int limit);

    /**
     * 查询某时间段的需求类型分布
     */
    List<Object> selectDemandTypeDistribution(@Param("startTime") LocalDateTime startTime,
                                               @Param("endTime") LocalDateTime endTime);

    /**
     * 更新用户反馈
     */
    int updateFeedback(@Param("id") Long id, @Param("feedback") Integer feedback);
}
