package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ChangeoverMatrix;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 换型矩阵Mapper
 * 用于查询产品切换所需的时间
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ChangeoverMatrixMapper extends BaseMapper<ChangeoverMatrix> {

    /**
     * 获取换型时间
     * 查询优先级:
     * 1. 特定产线 + 特定规格
     * 2. 特定产线 + 类别级别
     * 3. 通用 + 特定规格
     * 4. 通用 + 类别级别
     *
     * @param fromCategory 来源产品类别
     * @param toCategory 目标产品类别
     * @param lineId 产线ID (可为null表示查通用)
     * @return 换型时间(分钟), 未找到返回null
     */
    @Select("SELECT changeover_minutes FROM aps_changeover_matrix " +
            "WHERE from_category = #{fromCategory} " +
            "AND to_category = #{toCategory} " +
            "AND (line_id = #{lineId} OR line_id IS NULL) " +
            "AND deleted_at IS NULL " +
            "ORDER BY " +
            "  CASE WHEN line_id IS NOT NULL THEN 0 ELSE 1 END, " +
            "  CASE WHEN from_spec IS NOT NULL THEN 0 ELSE 1 END " +
            "LIMIT 1")
    Integer selectChangeoverTime(@Param("fromCategory") String fromCategory,
                                  @Param("toCategory") String toCategory,
                                  @Param("lineId") String lineId);

    /**
     * 获取完整的换型配置信息
     *
     * @param fromCategory 来源产品类别
     * @param toCategory 目标产品类别
     * @param lineId 产线ID
     * @return 换型配置
     */
    @Select("SELECT * FROM aps_changeover_matrix " +
            "WHERE from_category = #{fromCategory} " +
            "AND to_category = #{toCategory} " +
            "AND (line_id = #{lineId} OR line_id IS NULL) " +
            "AND deleted_at IS NULL " +
            "ORDER BY " +
            "  CASE WHEN line_id IS NOT NULL THEN 0 ELSE 1 END " +
            "LIMIT 1")
    ChangeoverMatrix selectChangeoverConfig(@Param("fromCategory") String fromCategory,
                                             @Param("toCategory") String toCategory,
                                             @Param("lineId") String lineId);

    /**
     * 获取默认换型时间(同类产品)
     *
     * @return 默认换型时间(分钟)
     */
    @Select("SELECT COALESCE(MIN(changeover_minutes), 15) FROM aps_changeover_matrix " +
            "WHERE from_category = to_category " +
            "AND deleted_at IS NULL")
    Integer selectDefaultChangeoverTime();
}
