package com.cretas.aims.exception;

/**
 * 相机操作异常
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
public class CameraException extends BusinessException {

    public CameraException(String message) {
        super(message);
    }

    public CameraException(Integer code, String message) {
        super(code, message);
    }

    public CameraException(String message, Throwable cause) {
        super(message, cause);
    }

    public CameraException(Integer code, String message, Throwable cause) {
        super(code, message, cause);
    }
}

