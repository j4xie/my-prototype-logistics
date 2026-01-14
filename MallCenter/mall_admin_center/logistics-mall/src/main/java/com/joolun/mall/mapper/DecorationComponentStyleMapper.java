package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationComponentStyle;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 组件样式Mapper
 */
public interface DecorationComponentStyleMapper extends BaseMapper<DecorationComponentStyle> {

    /**
     * 按组件类型查询样式
     */
    List<DecorationComponentStyle> selectByComponentType(@Param("componentType") String componentType);

    /**
     * 查询启用的样式列表
     */
    List<DecorationComponentStyle> selectActiveList();
}
