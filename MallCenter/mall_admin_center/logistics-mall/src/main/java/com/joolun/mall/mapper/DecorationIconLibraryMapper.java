package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationIconLibrary;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 图标库Mapper
 */
public interface DecorationIconLibraryMapper extends BaseMapper<DecorationIconLibrary> {

    /**
     * 按分类查询图标
     */
    List<DecorationIconLibrary> selectByCategory(@Param("category") String category);

    /**
     * 按图标类型查询
     */
    List<DecorationIconLibrary> selectByIconType(@Param("iconType") String iconType);

    /**
     * 查询启用的图标列表
     */
    List<DecorationIconLibrary> selectActiveList();
}
