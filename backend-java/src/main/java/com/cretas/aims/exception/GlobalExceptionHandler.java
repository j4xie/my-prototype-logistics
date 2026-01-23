package com.cretas.aims.exception;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.enums.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import javax.persistence.OptimisticLockException;
import javax.persistence.PersistenceException;
import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.sql.SQLException;
import java.util.UUID;
import java.util.stream.Collectors;
/**
 * 全局异常处理器
 *
 * 负责捕获所有异常并进行脱敏处理，确保：
 * 1. 敏感信息（堆栈、数据库错误、内部路径）不暴露给用户
 * 2. 日志记录完整的异常信息供排查
 * 3. 返回用户友好的错误消息和标准化错误码
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 生成错误追踪ID，用于关联日志和用户反馈
     */
    private String generateTraceId() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * 构建脱敏后的错误响应
     */
    private ApiResponse<?> buildSanitizedResponse(ErrorCode errorCode, String traceId) {
        String message = errorCode.getUserMessage();
        if (traceId != null) {
            message = message + " (追踪码: " + traceId + ")";
        }
        return ApiResponse.error(errorCode.getHttpStatus(), message);
    }

    /**
     * 判断消息是否可以安全展示给用户（不包含敏感信息）
     */
    private boolean isSafeMessage(String message) {
        if (message == null || message.isEmpty()) {
            return false;
        }
        // 敏感关键词检测
        String lowerMsg = message.toLowerCase();
        return !lowerMsg.contains("exception")
                && !lowerMsg.contains("error at")
                && !lowerMsg.contains("stacktrace")
                && !lowerMsg.contains("sql")
                && !lowerMsg.contains("jdbc")
                && !lowerMsg.contains("hibernate")
                && !lowerMsg.contains("jpa")
                && !lowerMsg.contains("mysql")
                && !lowerMsg.contains("postgresql")
                && !lowerMsg.contains("oracle")
                && !lowerMsg.contains("connection")
                && !lowerMsg.contains("localhost")
                && !lowerMsg.contains("127.0.0.1")
                && !lowerMsg.contains("/home/")
                && !lowerMsg.contains("/www/")
                && !lowerMsg.contains("c:\\")
                && !lowerMsg.contains("d:\\")
                && !lowerMsg.contains(".java:")
                && !lowerMsg.contains("at com.")
                && !lowerMsg.contains("at org.")
                && !lowerMsg.contains("null pointer")
                && !lowerMsg.contains("nullpointer")
                && !lowerMsg.contains("class cast")
                && !lowerMsg.contains("classcast");
    }

    /**
     * 处理业务异常 - 业务异常消息通常是安全的
     */
    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleBusinessException(BusinessException e) {
        log.warn("业务异常: code={}, message={}", e.getCode(), e.getMessage());
        // 业务异常的消息通常是开发者定义的，但仍需检查
        String message = isSafeMessage(e.getMessage()) ? e.getMessage() : ErrorCode.BUSINESS_RULE_VIOLATION.getUserMessage();
        return ApiResponse.error(e.getCode(), message);
    }

    /**
     * 处理未找到资源异常
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<?> handleResourceNotFoundException(ResourceNotFoundException e) {
        log.error("资源未找到: {}", e.getMessage());
        return ApiResponse.error(404, e.getMessage());
    }

    /**
     * 处理认证异常
     */
    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<?> handleAuthenticationException(AuthenticationException e) {
        log.error("认证失败: {}", e.getMessage());
        return ApiResponse.error(401, e.getMessage());
    }

    /**
     * 处理权限异常
     */
    @ExceptionHandler(AuthorizationException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<?> handleAuthorizationException(AuthorizationException e) {
        log.error("权限不足: {}", e.getMessage());
        return ApiResponse.error(403, e.getMessage());
    }

    /**
     * 处理参数验证异常
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.error("参数验证失败: {}", message);
        return ApiResponse.error(400, message);
    }

    /**
     * 处理参数绑定异常
     */
    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleBindException(BindException e) {
        String message = e.getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        log.error("参数绑定失败: {}", message);
        return ApiResponse.error(400, message);
    }

    /**
     * 处理约束验证异常
     */
    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleConstraintViolationException(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining(", "));
        log.error("约束验证失败: {}", message);
        return ApiResponse.error(400, message);
    }

    /**
     * 处理方法参数类型不匹配异常（如枚举值无效）
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleMethodArgumentTypeMismatchException(MethodArgumentTypeMismatchException e) {
        String paramName = e.getName();
        String invalidValue = e.getValue() != null ? e.getValue().toString() : "null";
        Class<?> requiredType = e.getRequiredType();

        String message;
        if (requiredType != null && requiredType.isEnum()) {
            Object[] enumConstants = requiredType.getEnumConstants();
            String validValues = java.util.Arrays.stream(enumConstants)
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            message = String.format("参数 '%s' 的值 '%s' 无效，有效值为: %s", paramName, invalidValue, validValues);
        } else {
            message = String.format("参数 '%s' 的值 '%s' 类型不匹配", paramName, invalidValue);
        }

        log.warn("参数类型不匹配: {}", message);
        return ApiResponse.error(400, message);
    }

    /**
     * 处理非法参数异常 - 需脱敏
     */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("非法参数: {}", e.getMessage());
        // 检查消息是否安全
        String message = isSafeMessage(e.getMessage()) ? e.getMessage() : ErrorCode.PARAM_INVALID.getUserMessage();
        return ApiResponse.error(400, message);
    }

    /**
     * 处理实体不存在异常
     */
    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<?> handleEntityNotFoundException(EntityNotFoundException e) {
        log.warn("Entity not found: {}", e.getMessage());
        return ApiResponse.error(404, e.getMessage());
    }

    /**
     * 处理验证异常
     */
    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleValidationException(ValidationException e) {
        log.warn("Validation error: {}", e.getMessage());
        return ApiResponse.error(400, e.getMessage());
    }

    /**
     * 处理乐观锁冲突异常 (BUG-047: P5-004)
     * 当多个用户同时修改同一条记录时，后提交的会触发此异常
     * 返回 409 Conflict，提示用户刷新后重试
     */
    @ExceptionHandler({OptimisticLockException.class, ObjectOptimisticLockingFailureException.class})
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<?> handleOptimisticLockException(Exception e) {
        log.warn("乐观锁冲突: {}", e.getMessage());
        return ApiResponse.error(409, "数据已被其他用户修改，请刷新后重试");
    }

    /**
     * 处理非法状态异常 (BUG-048: P5-005) - 需脱敏
     * 用于处理重复操作、状态流转错误等业务规则违反
     * 例如：重复确认告警、完成已完成的批次等
     */
    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleIllegalStateException(IllegalStateException e) {
        log.warn("非法状态: {}", e.getMessage());
        // 检查消息是否安全
        String message = isSafeMessage(e.getMessage()) ? e.getMessage() : ErrorCode.STATE_CONFLICT.getUserMessage();
        return ApiResponse.error(400, message);
    }

    // ==================== 数据库相关异常 - 需严格脱敏 ====================

    /**
     * 处理数据完整性异常（唯一约束、外键约束等）
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleDataIntegrityViolationException(DataIntegrityViolationException e) {
        String traceId = generateTraceId();
        log.error("[{}] 数据完整性异常: {}", traceId, e.getMessage(), e);
        // 尝试解析友好消息
        String message = ErrorCode.DATA_INTEGRITY_ERROR.getUserMessage();
        if (e.getMessage() != null) {
            if (e.getMessage().contains("Duplicate entry") || e.getMessage().contains("unique constraint")) {
                message = "数据已存在，请勿重复提交";
            } else if (e.getMessage().contains("foreign key") || e.getMessage().contains("FOREIGN KEY")) {
                message = "关联数据不存在或已被删除";
            }
        }
        return buildSanitizedResponse(ErrorCode.DATA_INTEGRITY_ERROR, traceId);
    }

    /**
     * 处理数据库查询超时
     */
    @ExceptionHandler(QueryTimeoutException.class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    public ApiResponse<?> handleQueryTimeoutException(QueryTimeoutException e) {
        String traceId = generateTraceId();
        log.error("[{}] 数据库查询超时: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.SERVICE_TIMEOUT, traceId);
    }

    /**
     * 处理通用数据访问异常
     */
    @ExceptionHandler(DataAccessException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleDataAccessException(DataAccessException e) {
        String traceId = generateTraceId();
        log.error("[{}] 数据访问异常: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.DATABASE_ERROR, traceId);
    }

    /**
     * 处理 JPA 持久化异常
     */
    @ExceptionHandler(PersistenceException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handlePersistenceException(PersistenceException e) {
        String traceId = generateTraceId();
        log.error("[{}] JPA持久化异常: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.DATABASE_ERROR, traceId);
    }

    /**
     * 处理 SQL 异常
     */
    @ExceptionHandler(SQLException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleSQLException(SQLException e) {
        String traceId = generateTraceId();
        log.error("[{}] SQL异常: SQLState={}, ErrorCode={}, Message={}",
                traceId, e.getSQLState(), e.getErrorCode(), e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.DATABASE_ERROR, traceId);
    }

    // ==================== 网络相关异常 - 需严格脱敏 ====================

    /**
     * 处理连接异常
     */
    @ExceptionHandler(ConnectException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<?> handleConnectException(ConnectException e) {
        String traceId = generateTraceId();
        log.error("[{}] 连接异常: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, traceId);
    }

    /**
     * 处理网络超时异常
     */
    @ExceptionHandler(SocketTimeoutException.class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    public ApiResponse<?> handleSocketTimeoutException(SocketTimeoutException e) {
        String traceId = generateTraceId();
        log.error("[{}] 网络超时: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.SERVICE_TIMEOUT, traceId);
    }

    // ==================== HTTP 请求相关异常 ====================

    /**
     * 处理请求参数缺失
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleMissingServletRequestParameterException(MissingServletRequestParameterException e) {
        log.warn("缺少请求参数: {}", e.getParameterName());
        return ApiResponse.error(400, "缺少必要参数: " + e.getParameterName());
    }

    /**
     * 处理请求体解析失败
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleHttpMessageNotReadableException(HttpMessageNotReadableException e) {
        log.warn("请求体解析失败: {}", e.getMessage());
        return ApiResponse.error(400, "请求格式不正确，请检查JSON格式");
    }

    /**
     * 处理请求方法不支持
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    @ResponseStatus(HttpStatus.METHOD_NOT_ALLOWED)
    public ApiResponse<?> handleHttpRequestMethodNotSupportedException(HttpRequestMethodNotSupportedException e) {
        log.warn("不支持的请求方法: {}", e.getMethod());
        return ApiResponse.error(405, "不支持的请求方法: " + e.getMethod());
    }

    /**
     * 处理路由未找到
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<?> handleNoHandlerFoundException(NoHandlerFoundException e) {
        log.warn("请求路径不存在: {}", e.getRequestURL());
        return ApiResponse.error(404, "请求的接口不存在");
    }

    // ==================== 空指针和运行时异常 - 需严格脱敏 ====================

    /**
     * 处理空指针异常 - 严格脱敏
     */
    @ExceptionHandler(NullPointerException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleNullPointerException(NullPointerException e) {
        String traceId = generateTraceId();
        log.error("[{}] 空指针异常", traceId, e);
        return buildSanitizedResponse(ErrorCode.SYSTEM_ERROR, traceId);
    }

    /**
     * 处理类型转换异常 - 严格脱敏
     */
    @ExceptionHandler(ClassCastException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleClassCastException(ClassCastException e) {
        String traceId = generateTraceId();
        log.error("[{}] 类型转换异常: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.SYSTEM_ERROR, traceId);
    }

    /**
     * 处理数组越界异常 - 严格脱敏
     */
    @ExceptionHandler(ArrayIndexOutOfBoundsException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleArrayIndexOutOfBoundsException(ArrayIndexOutOfBoundsException e) {
        String traceId = generateTraceId();
        log.error("[{}] 数组越界异常: {}", traceId, e.getMessage(), e);
        return buildSanitizedResponse(ErrorCode.SYSTEM_ERROR, traceId);
    }

    /**
     * 处理数字格式异常
     */
    @ExceptionHandler(NumberFormatException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<?> handleNumberFormatException(NumberFormatException e) {
        log.warn("数字格式异常: {}", e.getMessage());
        return ApiResponse.error(400, "数字格式不正确");
    }

    // ==================== 兜底异常处理 ====================

    /**
     * 处理其他 RuntimeException - 需脱敏
     */
    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleRuntimeException(RuntimeException e) {
        String traceId = generateTraceId();
        log.error("[{}] 运行时异常: {}", traceId, e.getClass().getName(), e);
        return buildSanitizedResponse(ErrorCode.SYSTEM_ERROR, traceId);
    }

    /**
     * 处理所有其他异常 - 严格脱敏
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<?> handleException(Exception e) {
        String traceId = generateTraceId();
        log.error("[{}] 未捕获异常: {}", traceId, e.getClass().getName(), e);
        return buildSanitizedResponse(ErrorCode.SYSTEM_ERROR, traceId);
    }
}
