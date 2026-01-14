package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationImageLibrary;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 图片库Mapper
 */
public interface DecorationImageLibraryMapper extends BaseMapper<DecorationImageLibrary> {

    /**
     * 按行业类型查询图片
     */
    List<DecorationImageLibrary> selectByIndustry(@Param("industryType") String industryType);

    /**
     * 按风格类型查询图片
     */
    List<DecorationImageLibrary> selectByStyle(@Param("styleType") String styleType);

    /**
     * 按图片类型查询
     */
    List<DecorationImageLibrary> selectByType(@Param("imageType") String imageType);

    /**
     * 查询启用的图片列表
     */
    List<DecorationImageLibrary> selectActiveList();
}
