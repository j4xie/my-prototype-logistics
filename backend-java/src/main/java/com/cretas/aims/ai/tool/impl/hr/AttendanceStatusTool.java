package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 考勤状态查询工具
 *
 * 查询指定用户的当前考勤状态（是否在岗、是否迟到早退等）。
 * 作为查询类Tool，无必需参数。
 *
 * Intent Code: ATTENDANCE_STATUS
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class AttendanceStatusTool extends AbstractBusinessTool {

    // TODO: 注入实际的考勤服务
    // @Autowired
    // private AttendanceService attendanceService;

    @Override
    public String getToolName() {
        return "attendance_status";
    }

    @Override
    public String getDescription() {
        return "查询考勤状态。获取指定用户的实时考勤状态，包括是否已签到、是否在岗、迟到早退情况。" +
                "适用场景：查看某人是否在岗、查看自己的考勤状态。";
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

        // date: 日期（可选，默认今天）
        Map<String, Object> date = new HashMap<>();
        date.put("type", "string");
        date.put("description", "查询日期，格式：YYYY-MM-DD，默认今天");
        date.put("format", "date");
        properties.put("date", date);

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
        log.info("执行考勤状态查询 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取用户ID
        String userId = getString(params, "userId");
        if (userId == null || userId.trim().isEmpty()) {
            Object contextUserId = context.get("userId");
            if (contextUserId != null) {
                userId = String.valueOf(contextUserId);
            }
        }

        // 获取查询日期
        String date = getString(params, "date");
        if (date == null || date.trim().isEmpty()) {
            date = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        }

        // TODO: 调用实际服务获取数据
        // AttendanceStatus status = attendanceService.getAttendanceStatus(factoryId, userId, date);

        // 占位实现：返回模拟数据结构
        Map<String, Object> result = new HashMap<>();
        result.put("userId", userId);
        result.put("userName", "当前用户");
        result.put("date", date);
        result.put("status", "UNKNOWN");
        result.put("statusDescription", "未知状态");
        result.put("isOnDuty", false);
        result.put("isLate", false);
        result.put("isEarlyLeave", false);
        result.put("isAbsent", false);
        result.put("clockInTime", null);
        result.put("clockOutTime", null);
        result.put("scheduledStartTime", "09:00");
        result.put("scheduledEndTime", "18:00");
        result.put("message", "请接入AttendanceService获取实际考勤状态");

        log.info("考勤状态查询完成 - 用户: {}, 日期: {}", userId, date);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "userId", "请问您要查询哪位员工的考勤状态？",
            "date", "请问您要查询哪一天的考勤状态？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "userId", "用户ID",
            "date", "查询日期"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
