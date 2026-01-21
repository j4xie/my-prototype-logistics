package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ProductionLine;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 生产线Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ProductionLineMapper extends BaseMapper<ProductionLine> {

    /**
     * 获取可用的生产线
     * 筛选条件:
     * 1. 状态为available或running
     * 2. 未被删除
     *
     * @return 可用产线列表
     */
    @Select("SELECT * FROM aps_production_line " +
            "WHERE status IN ('available', 'running') " +
            "AND deleted_at IS NULL " +
            "ORDER BY line_no ASC")
    List<ProductionLine> selectAvailableLines();

    /**
     * 根据产品类别获取可生产的产线
     *
     * @param productCategory 产品类别
     * @return 可生产该类别的产线列表
     */
    @Select("SELECT * FROM aps_production_line " +
            "WHERE status IN ('available', 'running') " +
            "AND (product_categories LIKE CONCAT('%', #{productCategory}, '%') OR product_categories IS NULL) " +
            "AND deleted_at IS NULL " +
            "ORDER BY efficiency_factor DESC")
    List<ProductionLine> selectLinesByProductCategory(@Param("productCategory") String productCategory);

    /**
     * 获取需要维护的产线
     *
     * @return 需要维护的产线列表
     */
    @Select("SELECT * FROM aps_production_line " +
            "WHERE next_maintenance_time <= NOW() " +
            "AND deleted_at IS NULL")
    List<ProductionLine> selectLinesNeedingMaintenance();
}
