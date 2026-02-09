package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 今日考勤查询工具
 *
 * 查询当前用户今天的考勤记录，包括签到签退时间、工作时长等。
 * 作为查询类Tool，无必需参数。
 *
 * Intent Code: ATTENDANCE_TODAY
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class AttendanceTodayTool extends AbstractBusinessTool {

    // TODO: 注入实际的考勤服务
    // @Autowired
    // private AttendanceService attendanceService;

    @Override
    public String getToolName() {
        return "attendance_today";
    }

    @Override
    public String getDescription() {
        return "查询今日考勤记录。获取当前用户今天的签到签退情况、工作时长统计。" +
                "适用场景：查看今天是否已签到、查看今日工作时长。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // userId: 用户ID（可选，默认当前用户）
        Map<String, Object> userId = new HashMap<>();
        userId.put("type", "string");
        userId.put("description", "用户ID，不传则查询当前登录用户");
        properties.put("userId", userId);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行今日考勤查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取用户ID（优先使用参数，否则从context获取当前用户）
        String userId = getString(params, "userId");
        if (userId == null || userId.trim().isEmpty()) {
            Object contextUserId = context.get("userId");
            if (contextUserId != null) {
                userId = String.valueOf(contextUserId);
            }
        }

        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        // TODO: 调用实际服务获取数据
        // AttendanceRecord record = attendanceService.getTodayAttendance(factoryId, userId);

        // 占位实现：返回模拟数据结构
        Map<String, Object> result = new HashMap<>();
        result.put("date", today);
        result.put("userId", userId);
        result.put("userName", "当前用户");
        result.put("clockInTime", null);
        result.put("clockOutTime", null);
        result.put("workDuration", 0);
        result.put("status", "NOT_CLOCKED_IN");
        result.put("isLate", false);
        result.put("isEarlyLeave", false);
        result.put("message", "请接入AttendanceService获取实际考勤数据");

        log.info("今日考勤查询完成 - 用户: {}, 日期: {}", userId, today);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问您要查询哪位员工的考勤？请提供员工ID或姓名。"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
