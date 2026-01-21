package com.joolun.mall.mapper.aps;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.joolun.mall.entity.aps.WorkerAssignment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 工人分配Mapper
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
@Mapper
public interface WorkerAssignmentMapper extends BaseMapper<WorkerAssignment> {

    /**
     * 获取指定任务的工人分配
     *
     * @param taskId 任务ID
     * @return 工人分配列表
     */
    @Select("SELECT * FROM aps_worker_assignment " +
            "WHERE task_id = #{taskId} " +
            "AND deleted_at IS NULL " +
            "ORDER BY role_type ASC")
    List<WorkerAssignment> selectByTaskId(@Param("taskId") String taskId);

    /**
     * 获取指定工人指定日期的分配
     *
     * @param workerId 工人ID
     * @param date 日期
     * @return 分配列表
     */
    @Select("SELECT * FROM aps_worker_assignment " +
            "WHERE worker_id = #{workerId} " +
            "AND DATE(start_time) = #{date} " +
            "AND deleted_at IS NULL " +
            "ORDER BY start_time ASC")
    List<WorkerAssignment> selectByWorkerAndDate(@Param("workerId") String workerId, @Param("date") LocalDate date);

    /**
     * 获取指定产线指定日期的工人分配
     *
     * @param lineId 产线ID
     * @param date 日期
     * @return 分配列表
     */
    @Select("SELECT * FROM aps_worker_assignment " +
            "WHERE line_id = #{lineId} " +
            "AND DATE(start_time) = #{date} " +
            "AND deleted_at IS NULL " +
            "ORDER BY start_time ASC")
    List<WorkerAssignment> selectByLineAndDate(@Param("lineId") String lineId, @Param("date") LocalDate date);

    /**
     * 检查工人在指定时间段是否已有分配
     *
     * @param workerId 工人ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 冲突的分配数量
     */
    @Select("SELECT COUNT(*) FROM aps_worker_assignment " +
            "WHERE worker_id = #{workerId} " +
            "AND start_time < #{endTime} " +
            "AND end_time > #{startTime} " +
            "AND deleted_at IS NULL")
    int countConflictingAssignments(@Param("workerId") String workerId,
                                     @Param("startTime") java.time.LocalDateTime startTime,
                                     @Param("endTime") java.time.LocalDateTime endTime);
}
