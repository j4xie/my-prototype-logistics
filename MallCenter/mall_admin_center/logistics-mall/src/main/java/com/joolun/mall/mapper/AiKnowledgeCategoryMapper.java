package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.AiKnowledgeCategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * AI知识库分类Mapper
 */
@Mapper
public interface AiKnowledgeCategoryMapper extends BaseMapper<AiKnowledgeCategory> {
    
    /**
     * 查询所有分类
     */
    List<AiKnowledgeCategory> selectAllCategories();
    
    /**
     * 根据父ID查询子分类
     */
    List<AiKnowledgeCategory> selectByParentId(@Param("parentId") Long parentId);
    
    /**
     * 查询顶级分类
     */
    List<AiKnowledgeCategory> selectTopCategories();
}
