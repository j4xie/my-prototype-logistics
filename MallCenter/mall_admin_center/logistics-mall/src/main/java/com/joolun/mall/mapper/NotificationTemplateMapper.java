package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.NotificationTemplate;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 通知模板Mapper
 */
public interface NotificationTemplateMapper extends BaseMapper<NotificationTemplate> {

    /**
     * 根据模板代码查询
     */
    NotificationTemplate selectByCode(@Param("code") String code);

    /**
     * 查询某类型的所有模板
     */
    List<NotificationTemplate> selectByCategory(@Param("category") String category);

    /**
     * 查询启用的模板
     */
    List<NotificationTemplate> selectActiveTemplates();
}
