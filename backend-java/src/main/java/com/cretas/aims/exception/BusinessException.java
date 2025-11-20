package com.cretas.aims.exception;

/**
 * 业务异常基类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public class BusinessException extends RuntimeException {
    private Integer code;
    public BusinessException(String message) {
        super(message);
        this.code = 400;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.code = 400;
    }

    public BusinessException(Integer code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public Integer getCode() {
        return code;
    }
}
