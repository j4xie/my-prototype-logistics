package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.ScheduleTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 排程任务Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface ScheduleTaskMapper extends BaseMapper<ScheduleTask> {

    /**
     * 获取指定产线指定日期的排程任务
     *
     * @param lineId 产线ID
     * @param date 日期
     * @return 任务列表
     */
    @Select("SELECT * FROM aps_schedule_task " +
            "WHERE line_id = #{lineId} " +
            "AND DATE(planned_start) = #{date} " +
            "AND deleted_at IS NULL " +
            "ORDER BY sequence_no ASC")
    List<ScheduleTask> selectTasksByLineAndDate(@Param("lineId") String lineId, @Param("date") LocalDate date);

    /**
     * 获取指定时间段内的排程任务
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 任务列表
     */
    @Select("SELECT * FROM aps_schedule_task " +
            "WHERE planned_start >= #{startTime} " +
            "AND planned_end <= #{endTime} " +
            "AND deleted_at IS NULL " +
            "ORDER BY line_id, sequence_no ASC")
    List<ScheduleTask> selectTasksByTimeRange(@Param("startTime") LocalDateTime startTime,
                                               @Param("endTime") LocalDateTime endTime);

    /**
     * 获取指定批次号的所有任务
     *
     * @param batchNo 排程批次号
     * @return 任务列表
     */
    @Select("SELECT * FROM aps_schedule_task " +
            "WHERE schedule_batch_no = #{batchNo} " +
            "AND deleted_at IS NULL " +
            "ORDER BY line_id, sequence_no ASC")
    List<ScheduleTask> selectTasksByBatchNo(@Param("batchNo") String batchNo);

    /**
     * 获取有冲突的任务
     *
     * @return 有冲突的任务列表
     */
    @Select("SELECT * FROM aps_schedule_task " +
            "WHERE has_conflict = true " +
            "AND deleted_at IS NULL " +
            "ORDER BY planned_start ASC")
    List<ScheduleTask> selectConflictTasks();
}
