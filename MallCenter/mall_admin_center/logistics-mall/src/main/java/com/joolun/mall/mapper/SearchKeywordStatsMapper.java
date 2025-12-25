package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.SearchKeywordStats;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 关键词统计Mapper
 */
public interface SearchKeywordStatsMapper extends BaseMapper<SearchKeywordStats> {

    /**
     * 分页查询统计数据
     */
    IPage<SearchKeywordStats> selectPage1(IPage<SearchKeywordStats> page,
                                          @Param("query") SearchKeywordStats query);

    /**
     * 查询热门关键词
     */
    List<SearchKeywordStats> selectHotKeywords(@Param("limit") int limit);

    /**
     * 查询待处理的高优先级关键词
     */
    List<SearchKeywordStats> selectPendingHighPriority(@Param("limit") int limit);

    /**
     * 根据关键词查询统计
     */
    SearchKeywordStats selectByKeyword(@Param("keyword") String keyword);

    /**
     * 更新统计数据
     */
    int incrementSearchCount(@Param("keyword") String keyword,
                             @Param("noResult") boolean noResult);

    /**
     * 获取统计概览
     */
    List<Object> selectOverview();
}
