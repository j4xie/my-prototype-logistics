package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ProductionWorker;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 生产工人Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ProductionWorkerMapper extends BaseMapper<ProductionWorker> {

    /**
     * 获取指定班次可用的工人
     *
     * @param shift 班次: shift1/shift2/shift3
     * @return 可用工人列表
     */
    @Select("SELECT * FROM aps_production_worker " +
            "WHERE status = 'available' " +
            "AND current_shift = #{shift} " +
            "AND deleted_at IS NULL " +
            "ORDER BY skill_level DESC")
    List<ProductionWorker> selectAvailableWorkersByShift(@Param("shift") String shift);

    /**
     * 获取指定技能等级及以上的工人
     *
     * @param minSkillLevel 最小技能等级
     * @return 工人列表
     */
    @Select("SELECT * FROM aps_production_worker " +
            "WHERE status = 'available' " +
            "AND skill_level >= #{minSkillLevel} " +
            "AND deleted_at IS NULL " +
            "ORDER BY skill_level DESC")
    List<ProductionWorker> selectWorkersByMinSkillLevel(@Param("minSkillLevel") Integer minSkillLevel);

    /**
     * 获取当前在岗工人数量
     *
     * @return 在岗工人数
     */
    @Select("SELECT COUNT(*) FROM aps_production_worker " +
            "WHERE status IN ('available', 'working') " +
            "AND deleted_at IS NULL")
    int countOnDutyWorkers();
}
