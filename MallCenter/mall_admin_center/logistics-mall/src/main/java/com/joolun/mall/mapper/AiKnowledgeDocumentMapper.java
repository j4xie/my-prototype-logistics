package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.AiKnowledgeDocument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * AI知识库文档Mapper
 */
@Mapper
public interface AiKnowledgeDocumentMapper extends BaseMapper<AiKnowledgeDocument> {
    
    /**
     * 根据分类ID查询文档
     */
    List<AiKnowledgeDocument> selectByCategoryId(@Param("categoryId") Long categoryId);
    
    /**
     * 搜索文档
     */
    List<AiKnowledgeDocument> searchDocuments(@Param("keyword") String keyword, @Param("categoryId") Long categoryId);
    
    /**
     * 增加浏览次数
     */
    int incrementViewCount(@Param("id") Long id);
    
    /**
     * 增加点赞次数
     */
    int incrementLikeCount(@Param("id") Long id);
}
