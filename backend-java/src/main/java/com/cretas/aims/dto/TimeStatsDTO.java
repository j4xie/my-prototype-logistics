package com.cretas.aims.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 时间统计DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "时间统计信息")
public class TimeStatsDTO {

    @Schema(description = "统计周期", example = "daily")
    private String period;

    @Schema(description = "开始日期")
    private LocalDate startDate;

    @Schema(description = "结束日期")
    private LocalDate endDate;

    @Schema(description = "总工时", example = "240.5")
    private BigDecimal totalHours;

    @Schema(description = "正常工时", example = "200")
    private BigDecimal regularHours;

    @Schema(description = "加班工时", example = "40.5")
    private BigDecimal overtimeHours;

    @Schema(description = "活跃员工数", example = "25")
    private Integer activeWorkers;

    @Schema(description = "总打卡次数", example = "100")
    private Long totalClockIns;

    @Schema(description = "迟到次数", example = "5")
    private Long lateCount;

    @Schema(description = "早退次数", example = "3")
    private Long earlyLeaveCount;

    @Schema(description = "缺勤次数", example = "2")
    private Long absentCount;

    @Schema(description = "平均工时", example = "8.5")
    private BigDecimal averageHours;

    @Schema(description = "出勤率", example = "95.5")
    private BigDecimal attendanceRate;

    @Schema(description = "生产效率", example = "89.3")
    private BigDecimal productivity;

    @Schema(description = "按部门统计")
    private Map<String, DepartmentStats> departmentStats;

    @Schema(description = "按工作类型统计")
    private Map<String, WorkTypeStats> workTypeStats;

    @Schema(description = "日统计列表")
    private List<DailyStats> dailyStatsList;

    /**
     * 部门统计
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DepartmentStats {
        @Schema(description = "部门名称", example = "生产部")
        private String departmentName;

        @Schema(description = "总工时", example = "120.5")
        private BigDecimal totalHours;

        @Schema(description = "员工数", example = "10")
        private Integer workerCount;

        @Schema(description = "平均工时", example = "12.05")
        private BigDecimal averageHours;

        @Schema(description = "加班工时", example = "20.5")
        private BigDecimal overtimeHours;

        @Schema(description = "出勤率", example = "96.5")
        private BigDecimal attendanceRate;
    }

    /**
     * 工作类型统计
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WorkTypeStats {
        @Schema(description = "工作类型ID", example = "1")
        private Integer workTypeId;

        @Schema(description = "工作类型名称", example = "播种")
        private String workTypeName;

        @Schema(description = "总工时", example = "80.5")
        private BigDecimal totalHours;

        @Schema(description = "参与人数", example = "8")
        private Integer workerCount;

        @Schema(description = "平均工时", example = "10.06")
        private BigDecimal averageHours;

        @Schema(description = "产出量", example = "500")
        private BigDecimal output;

        @Schema(description = "生产效率", example = "6.21")
        private BigDecimal efficiency;
    }

    /**
     * 日统计
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DailyStats {
        @Schema(description = "日期")
        private LocalDate date;

        @Schema(description = "星期", example = "Monday")
        private String dayOfWeek;

        @Schema(description = "总工时", example = "40.5")
        private BigDecimal totalHours;

        @Schema(description = "活跃员工数", example = "10")
        private Integer activeWorkers;

        @Schema(description = "打卡次数", example = "20")
        private Long clockIns;

        @Schema(description = "出勤率", example = "95.0")
        private BigDecimal attendanceRate;

        @Schema(description = "是否工作日", example = "true")
        private Boolean isWorkday;
    }

    /**
     * 生产力分析
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProductivityAnalysis {
        @Schema(description = "时间段")
        private String period;

        @Schema(description = "总产出", example = "10000")
        private BigDecimal totalOutput;

        @Schema(description = "总投入工时", example = "500")
        private BigDecimal totalInputHours;

        @Schema(description = "人均产出", example = "400")
        private BigDecimal outputPerWorker;

        @Schema(description = "时均产出", example = "20")
        private BigDecimal outputPerHour;

        @Schema(description = "效率指数", example = "1.05")
        private BigDecimal efficiencyIndex;

        @Schema(description = "趋势", example = "上升")
        private String trend;

        @Schema(description = "环比增长", example = "5.5")
        private BigDecimal growthRate;

        @Schema(description = "最高效部门", example = "生产部")
        private String mostEfficientDepartment;

        @Schema(description = "最高效工作类型", example = "包装")
        private String mostEfficientWorkType;

        @Schema(description = "改进建议")
        private List<String> improvements;
    }

    /**
     * 员工时间统计
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WorkerTimeStats {
        @Schema(description = "员工ID", example = "1")
        private Integer workerId;

        @Schema(description = "员工姓名", example = "张三")
        private String workerName;

        @Schema(description = "部门", example = "生产部")
        private String department;

        @Schema(description = "总工时", example = "160")
        private BigDecimal totalHours;

        @Schema(description = "正常工时", example = "140")
        private BigDecimal regularHours;

        @Schema(description = "加班工时", example = "20")
        private BigDecimal overtimeHours;

        @Schema(description = "出勤天数", example = "20")
        private Integer attendanceDays;

        @Schema(description = "迟到次数", example = "1")
        private Integer lateCount;

        @Schema(description = "早退次数", example = "0")
        private Integer earlyLeaveCount;

        @Schema(description = "出勤率", example = "95.0")
        private BigDecimal attendanceRate;

        @Schema(description = "排名", example = "5")
        private Integer ranking;
    }
}