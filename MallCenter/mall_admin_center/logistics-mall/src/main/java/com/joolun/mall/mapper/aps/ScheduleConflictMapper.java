package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ScheduleConflict;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 排程冲突Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ScheduleConflictMapper extends BaseMapper<ScheduleConflict> {

    /**
     * 获取指定排程批次的冲突
     *
     * @param batchNo 排程批次号
     * @return 冲突列表
     */
    @Select("SELECT * FROM aps_schedule_conflict " +
            "WHERE schedule_batch_no = #{batchNo} " +
            "AND deleted_at IS NULL " +
            "ORDER BY severity DESC, detected_at ASC")
    List<ScheduleConflict> selectByBatchNo(@Param("batchNo") String batchNo);

    /**
     * 获取未解决的冲突
     *
     * @return 未解决的冲突列表
     */
    @Select("SELECT * FROM aps_schedule_conflict " +
            "WHERE resolved = false " +
            "AND deleted_at IS NULL " +
            "ORDER BY severity DESC, detected_at ASC")
    List<ScheduleConflict> selectUnresolvedConflicts();

    /**
     * 获取指定日期的冲突
     *
     * @param date 日期
     * @return 冲突列表
     */
    @Select("SELECT * FROM aps_schedule_conflict " +
            "WHERE DATE(detected_at) = #{date} " +
            "AND deleted_at IS NULL " +
            "ORDER BY severity DESC")
    List<ScheduleConflict> selectByDate(@Param("date") LocalDate date);

    /**
     * 统计各类型冲突数量
     *
     * @return 类型统计
     */
    @Select("SELECT conflict_type, COUNT(*) as count FROM aps_schedule_conflict " +
            "WHERE resolved = false " +
            "AND deleted_at IS NULL " +
            "GROUP BY conflict_type")
    List<java.util.Map<String, Object>> countByConflictType();

    /**
     * 获取指定任务的冲突
     *
     * @param taskId 任务ID
     * @return 冲突列表
     */
    @Select("SELECT * FROM aps_schedule_conflict " +
            "WHERE task_id = #{taskId} " +
            "AND deleted_at IS NULL " +
            "ORDER BY detected_at DESC")
    List<ScheduleConflict> selectByTaskId(@Param("taskId") String taskId);
}
