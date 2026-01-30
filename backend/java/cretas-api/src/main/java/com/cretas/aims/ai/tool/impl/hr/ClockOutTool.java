package com.cretas.aims.ai.tool.impl.hr;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 签退打卡工具
 *
 * 执行签退打卡操作，记录当前用户的下班签退时间。
 * 作为操作类Tool，用户上下文从JWT获取，无需额外必需参数。
 *
 * Intent Code: CLOCK_OUT
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ClockOutTool extends AbstractBusinessTool {

    // TODO: 注入实际的打卡服务
    // @Autowired
    // private TimeclockService timeclockService;

    @Override
    public String getToolName() {
        return "clock_out";
    }

    @Override
    public String getDescription() {
        return "执行签退打卡。记录当前用户的下班签退时间，自动计算当日工作时长。" +
                "适用场景：下班打卡、补签退。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // remark: 签退备注（可选）
        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "签退备注，如加班说明");
        properties.put("remark", remark);

        // location: 签退位置（可选）
        Map<String, Object> location = new HashMap<>();
        location.put("type", "string");
        location.put("description", "签退位置描述");
        properties.put("location", location);

        // latitude: 纬度（可选）
        Map<String, Object> latitude = new HashMap<>();
        latitude.put("type", "number");
        latitude.put("description", "签退位置纬度");
        properties.put("latitude", latitude);

        // longitude: 经度（可选）
        Map<String, Object> longitude = new HashMap<>();
        longitude.put("type", "number");
        longitude.put("description", "签退位置经度");
        properties.put("longitude", longitude);

        schema.put("properties", properties);
        // 签退操作无必需参数，用户信息从JWT获取
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        // 签退操作无必需参数，用户信息从context获取
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行签退打卡 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 从context获取当前用户信息
        Object contextUserId = context.get("userId");
        String userId = contextUserId != null ? String.valueOf(contextUserId) : null;
        Object contextUserName = context.get("userName");
        String userName = contextUserName != null ? String.valueOf(contextUserName) : null;

        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("无法获取用户信息，请重新登录");
        }

        // 获取可选参数
        String remark = getString(params, "remark");
        String location = getString(params, "location");
        Double latitude = params.get("latitude") != null ?
                ((Number) params.get("latitude")).doubleValue() : null;
        Double longitude = params.get("longitude") != null ?
                ((Number) params.get("longitude")).doubleValue() : null;

        LocalDateTime now = LocalDateTime.now();
        String clockOutTime = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // TODO: 调用实际服务执行签退
        // ClockOutResult result = timeclockService.clockOut(factoryId, userId, remark, location, latitude, longitude);

        // 判断是否早退（假设18:00为下班时间）
        LocalTime scheduledEndTime = LocalTime.of(18, 0);
        boolean isEarlyLeave = now.toLocalTime().isBefore(scheduledEndTime);
        int earlyLeaveMinutes = 0;
        if (isEarlyLeave) {
            earlyLeaveMinutes = (int) Duration.between(now.toLocalTime(), scheduledEndTime).toMinutes();
        }

        // 计算工作时长（假设签到时间为9:00，实际应从数据库获取）
        LocalTime assumedClockIn = LocalTime.of(9, 0);
        double workHours = Duration.between(assumedClockIn, now.toLocalTime()).toMinutes() / 60.0;

        // 计算加班时长
        double overtimeHours = 0;
        if (now.toLocalTime().isAfter(scheduledEndTime)) {
            overtimeHours = Duration.between(scheduledEndTime, now.toLocalTime()).toMinutes() / 60.0;
        }

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("userId", userId);
        result.put("userName", userName != null ? userName : "当前用户");
        result.put("clockOutTime", clockOutTime);
        result.put("date", now.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
        result.put("isEarlyLeave", isEarlyLeave);
        result.put("earlyLeaveMinutes", earlyLeaveMinutes);
        result.put("workHours", Math.round(workHours * 100.0) / 100.0);
        result.put("overtimeHours", Math.round(overtimeHours * 100.0) / 100.0);

        if (remark != null) result.put("remark", remark);
        if (location != null) result.put("location", location);
        if (latitude != null && longitude != null) {
            Map<String, Double> coordinates = new HashMap<>();
            coordinates.put("latitude", latitude);
            coordinates.put("longitude", longitude);
            result.put("coordinates", coordinates);
        }

        // 生成结果消息
        StringBuilder message = new StringBuilder("签退成功！");
        if (isEarlyLeave) {
            message.append("您今天提前").append(earlyLeaveMinutes).append("分钟下班。");
        } else if (overtimeHours > 0) {
            message.append("您今天加班").append(String.format("%.1f", overtimeHours)).append("小时，辛苦了！");
        }
        message.append("今日工作时长：").append(String.format("%.1f", workHours)).append("小时。");

        result.put("message", message.toString());
        result.put("notice", "请接入TimeclockService完成实际签退");

        log.info("签退打卡完成 - 用户: {}, 时间: {}, 工作时长: {}小时", userId, clockOutTime, workHours);

        return result;
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "remark", "请问需要添加签退备注吗？",
            "location", "请问需要记录签退位置吗？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "remark", "签退备注",
            "location", "签退位置",
            "latitude", "纬度",
            "longitude", "经度"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
