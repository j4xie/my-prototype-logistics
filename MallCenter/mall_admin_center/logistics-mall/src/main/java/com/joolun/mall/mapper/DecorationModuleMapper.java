package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.DecorationModule;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 页面模块Mapper
 */
public interface DecorationModuleMapper extends BaseMapper<DecorationModule> {

    /**
     * 查询启用的模块列表
     */
    List<DecorationModule> selectActiveList();

    /**
     * 根据编码查询模块
     */
    DecorationModule selectByCode(@Param("code") String code);

    /**
     * 按模块类型查询
     */
    List<DecorationModule> selectByModuleType(@Param("moduleType") String moduleType);
}
