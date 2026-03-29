package com.cretas.aims.service.mobile;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 移动端业务服务接口
 * <p>
 * 负责仪表盘数据、人员报表/统计、设备告警、工厂设置、
 * 文件上传、崩溃上报、版本检查、数据同步、离线包等。
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface MobileBusinessService {

    // ==================== 仪表盘 & 同步 ====================

    MobileDTO.DashboardData getDashboardData(String factoryId, Long userId);

    MobileDTO.SyncResponse syncData(String factoryId, MobileDTO.SyncRequest request);

    MobileDTO.OfflineDataPackage getOfflineDataPackage(String factoryId, Long userId);

    // ==================== 版本 & 配置 ====================

    MobileDTO.VersionCheckResponse checkVersion(String currentVersion, String platform);

    Object getMobileConfig(String factoryId, String platform);

    // ==================== 文件上传 ====================

    MobileDTO.UploadResponse uploadFiles(List<MultipartFile> files, String category, String metadata);

    // ==================== 崩溃 & 性能上报 ====================

    void reportCrash(MobileDTO.DeviceInfo deviceInfo, String crashLog);

    void reportPerformance(MobileDTO.DeviceInfo deviceInfo, Object performanceData);

    // ==================== 人员报表 ====================

    MobileDTO.PersonnelStatistics getPersonnelStatistics(String factoryId, String startDate, String endDate);

    List<MobileDTO.WorkHoursRankingItem> getWorkHoursRanking(String factoryId, String startDate, String endDate, Integer limit);

    MobileDTO.OvertimeStatistics getOvertimeStatistics(String factoryId, String startDate, String endDate, String departmentId);

    List<MobileDTO.PerformanceItem> getPersonnelPerformance(String factoryId, String startDate, String endDate, Long userId);

    // ==================== 成本对比 ====================

    List<MobileDTO.BatchCostData> getBatchCostComparison(String factoryId, List<String> batchIds);

    // ==================== 设备告警 ====================

    PageResponse<MobileDTO.AlertResponse> getEquipmentAlerts(String factoryId, String status, PageRequest pageRequest);

    MobileDTO.AlertResponse acknowledgeAlert(String factoryId, String alertId, Long userId, String username, MobileDTO.AcknowledgeAlertRequest request);

    MobileDTO.AlertResponse resolveAlert(String factoryId, String alertId, Long userId, String username, MobileDTO.ResolveAlertRequest request);

    // ==================== 工厂设置 ====================

    MobileDTO.FactorySettingsResponse getFactorySettings(String factoryId);

    MobileDTO.FactorySettingsResponse updateFactorySettings(String factoryId, MobileDTO.UpdateFactorySettingsRequest request, Long userId);

    // ==================== 用户反馈 ====================

    MobileDTO.FeedbackResponse submitFeedback(String factoryId, MobileDTO.SubmitFeedbackRequest request, Long userId);
}
