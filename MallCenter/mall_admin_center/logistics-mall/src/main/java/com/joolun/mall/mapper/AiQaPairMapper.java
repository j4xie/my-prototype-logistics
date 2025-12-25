package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.AiQaPair;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * AI知识库问答对Mapper
 */
@Mapper
public interface AiQaPairMapper extends BaseMapper<AiQaPair> {
    
    /**
     * 根据分类ID查询问答对
     */
    List<AiQaPair> selectByCategoryId(@Param("categoryId") Long categoryId);
    
    /**
     * 搜索问答
     */
    List<AiQaPair> searchQaPairs(@Param("keyword") String keyword, @Param("categoryId") Long categoryId);
    
    /**
     * 增加命中次数
     */
    int incrementHitCount(@Param("id") Long id);
    
    /**
     * 点赞
     */
    int incrementLikeCount(@Param("id") Long id);
    
    /**
     * 踩
     */
    int incrementDislikeCount(@Param("id") Long id);
    
    /**
     * 查询热门问答
     */
    List<AiQaPair> selectHotQaPairs(@Param("limit") int limit);
}
