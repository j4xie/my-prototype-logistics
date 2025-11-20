package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.SystemLog;
import java.time.LocalDate;
import java.util.Map;
/**
 * 系统管理服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface SystemService {
    /**
     * 获取系统健康状态
     */
    Map<String, Object> getSystemHealth();
     /**
     * 创建系统日志
      */
    void createSystemLog(SystemLog log);
     /**
     * 获取系统日志列表
      */
    PageResponse<SystemLog> getSystemLogs(String factoryId, String logType, PageRequest pageRequest);
     /**
     * 获取API访问日志
      */
    PageResponse<SystemLog> getApiAccessLogs(String factoryId, PageRequest pageRequest);
     /**
     * 获取系统性能监控数据
      */
    Map<String, Object> getSystemPerformance();
     /**
     * 获取系统统计概览
      */
    Map<String, Object> getSystemStatistics(String factoryId);
     /**
     * 清理过期日志
      */
    int cleanupLogs(LocalDate beforeDate);
     /**
     * 记录审计日志
      */
    void createAuditLog(String factoryId, String module, String action, String message, Integer userId);
     /**
     * 记录错误日志
      */
    void createErrorLog(String factoryId, String module, String errorMessage, String stackTrace);
     /**
     * 获取系统配置
      */
    Map<String, Object> getSystemConfiguration();
     /**
     * 获取数据库状态
      */
    Map<String, Object> getDatabaseStatus();
}
