package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ProductionMold;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 生产模具Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ProductionMoldMapper extends BaseMapper<ProductionMold> {

    /**
     * 获取可用于指定产品类别的模具
     *
     * @param productCategory 产品类别
     * @return 可用模具列表
     */
    @Select("SELECT * FROM aps_production_mold " +
            "WHERE product_category = #{productCategory} " +
            "AND status = 'available' " +
            "AND deleted_at IS NULL " +
            "ORDER BY usage_count ASC")
    List<ProductionMold> selectAvailableByProductCategory(@Param("productCategory") String productCategory);

    /**
     * 获取指定产线的当前模具
     *
     * @param lineId 产线ID
     * @return 当前安装的模具
     */
    @Select("SELECT * FROM aps_production_mold " +
            "WHERE current_line_id = #{lineId} " +
            "AND status = 'in_use' " +
            "AND deleted_at IS NULL " +
            "LIMIT 1")
    ProductionMold selectCurrentMoldByLineId(@Param("lineId") String lineId);

    /**
     * 获取需要维护的模具
     *
     * @return 需要维护的模具列表
     */
    @Select("SELECT * FROM aps_production_mold " +
            "WHERE usage_count >= max_usage_count " +
            "OR next_maintenance_time <= NOW() " +
            "AND deleted_at IS NULL")
    List<ProductionMold> selectMoldsNeedingMaintenance();
}
