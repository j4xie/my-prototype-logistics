package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.TraceabilityQualityReport;

import java.util.List;

/**
 * 质检报告Mapper
 */
public interface TraceabilityQualityReportMapper extends BaseMapper<TraceabilityQualityReport> {

    /**
     * 根据批次ID查询质检报告
     */
    List<TraceabilityQualityReport> selectByBatchId(Long batchId);
}
