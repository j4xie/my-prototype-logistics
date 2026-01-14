package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationThemePreset;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 主题预设Mapper
 */
public interface DecorationThemePresetMapper extends BaseMapper<DecorationThemePreset> {

    /**
     * 查询启用的主题列表
     */
    List<DecorationThemePreset> selectActiveList();

    /**
     * 根据编码查询主题
     */
    DecorationThemePreset selectByCode(@Param("code") String code);

    /**
     * 按风格类型查询主题
     */
    List<DecorationThemePreset> selectByStyleType(@Param("styleType") String styleType);

    /**
     * 查询系统预设主题
     */
    List<DecorationThemePreset> selectSystemPresets();

    /**
     * 批量查询主题
     */
    List<DecorationThemePreset> selectBatchIds(@Param("list") List<Long> ids);

    /**
     * 按行业类型查询主题
     */
    List<DecorationThemePreset> selectByIndustryType(@Param("industryType") String industryType);
}
