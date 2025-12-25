package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.SearchKeywordRecord;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 搜索关键词记录Mapper
 */
public interface SearchKeywordRecordMapper extends BaseMapper<SearchKeywordRecord> {

    /**
     * 分页查询搜索记录
     */
    IPage<SearchKeywordRecord> selectPage1(IPage<SearchKeywordRecord> page,
                                           @Param("query") SearchKeywordRecord query);

    /**
     * 根据关键词查询记录
     */
    List<SearchKeywordRecord> selectByKeyword(@Param("keyword") String keyword);

    /**
     * 查询无结果的搜索记录
     */
    List<SearchKeywordRecord> selectNoResultRecords(@Param("startTime") LocalDateTime startTime,
                                                     @Param("endTime") LocalDateTime endTime);

    /**
     * 统计某关键词的搜索次数
     */
    int countByKeyword(@Param("keyword") String keyword);

    /**
     * 批量更新状态
     */
    int batchUpdateStatus(@Param("ids") List<Long> ids, @Param("status") Integer status);
}
