package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationPromptTemplate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * Prompt模板Mapper接口
 */
@Mapper
public interface DecorationPromptTemplateMapper extends BaseMapper<DecorationPromptTemplate> {

    /**
     * 根据编码查询模板
     */
    DecorationPromptTemplate selectByCode(@Param("code") String code);

    /**
     * 根据行业和图片类型查询模板
     */
    List<DecorationPromptTemplate> selectByIndustryAndType(
            @Param("industryType") String industryType,
            @Param("imageType") String imageType);

    /**
     * 根据行业查询所有模板
     */
    List<DecorationPromptTemplate> selectByIndustry(@Param("industryType") String industryType);

    /**
     * 根据图片类型查询模板
     */
    List<DecorationPromptTemplate> selectByImageType(@Param("imageType") String imageType);

    /**
     * 查询所有启用的模板
     */
    List<DecorationPromptTemplate> selectActiveList();

    /**
     * 增加使用次数
     */
    int incrementUseCount(@Param("id") Long id);
}
