package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.TraceabilityRawMaterial;

import java.util.List;

/**
 * 溯源原料Mapper
 */
public interface TraceabilityRawMaterialMapper extends BaseMapper<TraceabilityRawMaterial> {

    /**
     * 根据批次ID查询原料列表
     */
    List<TraceabilityRawMaterial> selectByBatchId(Long batchId);
}
