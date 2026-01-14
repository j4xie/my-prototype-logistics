package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.DecorationTemplate;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 装修模板Mapper
 */
public interface DecorationTemplateMapper extends BaseMapper<DecorationTemplate> {

    /**
     * 分页查询模板
     */
    IPage<DecorationTemplate> selectPage1(IPage<DecorationTemplate> page, @Param("query") DecorationTemplate query);

    /**
     * 根据编码查询模板
     */
    DecorationTemplate selectByCode(@Param("code") String code);

    /**
     * 查询启用的模板列表
     */
    List<DecorationTemplate> selectActiveList();

    /**
     * 按风格类型查询模板
     */
    List<DecorationTemplate> selectByStyleType(@Param("styleType") String styleType);

    /**
     * 获取默认模板
     */
    DecorationTemplate selectDefault();
}
