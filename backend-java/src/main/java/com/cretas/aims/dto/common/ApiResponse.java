package com.cretas.aims.dto.common;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 统一API响应对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "统一API响应对象")
public class ApiResponse<T> implements Serializable {

    @Schema(description = "响应状态码", example = "200")
    private Integer code;

    @Schema(description = "响应消息", example = "操作成功")
    private String message;

    @Schema(description = "响应数据")
    private T data;

    @Schema(description = "响应时间戳")
    private LocalDateTime timestamp;

    @Schema(description = "请求是否成功", example = "true")
    private Boolean success;

    // 成功响应
    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    public static <T> ApiResponse<T> success(T data) {
        return success("操作成功", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(200);
        response.setMessage(message);
        response.setData(data);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(true);
        return response;
    }

    /**
     * 成功响应 - 仅消息，无数据 (用于 Void 返回类型)
     */
    public static ApiResponse<Void> successMessage(String message) {
        ApiResponse<Void> response = new ApiResponse<>();
        response.setCode(200);
        response.setMessage(message);
        response.setData(null);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(true);
        return response;
    }

    // 失败响应
    public static <T> ApiResponse<T> error(String message) {
        return error(400, message);
    }

    public static <T> ApiResponse<T> error(Integer code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setMessage(message);
        response.setData(null);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(false);
        return response;
    }

    // 自定义响应
    public static <T> ApiResponse<T> of(Integer code, String message, T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setMessage(message);
        response.setData(data);
        response.setTimestamp(LocalDateTime.now());
        response.setSuccess(code >= 200 && code < 300);
        return response;
    }

    // Manual getters and setters (Lombok @Data not working)
    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }
}