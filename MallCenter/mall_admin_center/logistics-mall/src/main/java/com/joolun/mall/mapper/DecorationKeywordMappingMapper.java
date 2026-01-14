package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationKeywordMapping;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 关键词映射Mapper接口
 */
@Mapper
public interface DecorationKeywordMappingMapper extends BaseMapper<DecorationKeywordMapping> {

    /**
     * 根据关键词精确查询
     */
    DecorationKeywordMapping selectByKeyword(@Param("keyword") String keyword);

    /**
     * 根据关键词模糊查询
     */
    List<DecorationKeywordMapping> selectByKeywordLike(@Param("keyword") String keyword);

    /**
     * 根据映射类型查询所有
     */
    List<DecorationKeywordMapping> selectByMappingType(@Param("mappingType") String mappingType);

    /**
     * 查询所有启用的映射
     */
    List<DecorationKeywordMapping> selectActiveList();

    /**
     * 增加匹配次数
     */
    int incrementMatchCount(@Param("id") Long id);
}
