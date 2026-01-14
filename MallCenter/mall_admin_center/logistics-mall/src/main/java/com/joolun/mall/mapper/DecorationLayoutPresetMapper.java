package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationLayoutPreset;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 布局预设Mapper
 */
public interface DecorationLayoutPresetMapper extends BaseMapper<DecorationLayoutPreset> {

    /**
     * 按行业类型查询布局
     */
    List<DecorationLayoutPreset> selectByIndustry(@Param("industryType") String industryType);

    /**
     * 按风格类型查询布局
     */
    List<DecorationLayoutPreset> selectByStyle(@Param("styleType") String styleType);

    /**
     * 查询启用的布局列表
     */
    List<DecorationLayoutPreset> selectActiveList();
}
