package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationFontStyle;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 字体样式Mapper
 */
public interface DecorationFontStyleMapper extends BaseMapper<DecorationFontStyle> {

    /**
     * 按使用场景查询字体
     */
    List<DecorationFontStyle> selectByUsageType(@Param("usageType") String usageType);

    /**
     * 查询启用的字体列表
     */
    List<DecorationFontStyle> selectActiveList();
}
