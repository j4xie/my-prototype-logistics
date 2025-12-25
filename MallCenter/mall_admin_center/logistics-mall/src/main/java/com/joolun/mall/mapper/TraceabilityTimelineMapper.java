package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.TraceabilityTimeline;

import java.util.List;

/**
 * 溯源时间线Mapper
 */
public interface TraceabilityTimelineMapper extends BaseMapper<TraceabilityTimeline> {

    /**
     * 根据批次ID查询时间线
     */
    List<TraceabilityTimeline> selectByBatchId(Long batchId);
}
