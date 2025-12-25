package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.TraceabilityEvidence;

import java.util.List;

/**
 * 溯源证据Mapper
 */
public interface TraceabilityEvidenceMapper extends BaseMapper<TraceabilityEvidence> {

    /**
     * 根据批次ID查询证据列表
     */
    List<TraceabilityEvidence> selectByBatchId(Long batchId);
}
