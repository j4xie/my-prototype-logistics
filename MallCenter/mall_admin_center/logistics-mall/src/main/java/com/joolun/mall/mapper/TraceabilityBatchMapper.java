package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.TraceabilityBatch;
import org.apache.ibatis.annotations.Param;

/**
 * 溯源批次Mapper
 */
public interface TraceabilityBatchMapper extends BaseMapper<TraceabilityBatch> {

    /**
     * 分页查询批次
     */
    IPage<TraceabilityBatch> selectPage1(IPage<TraceabilityBatch> page, @Param("query") TraceabilityBatch batch);

    /**
     * 根据批次号查询
     */
    TraceabilityBatch selectByBatchNo(String batchNo);

    /**
     * 查询完整详情（含时间线、原料、质检）
     */
    TraceabilityBatch selectDetailById(Long id);

    /**
     * 查询完整详情（按批次号）
     */
    TraceabilityBatch selectDetailByBatchNo(String batchNo);
}
