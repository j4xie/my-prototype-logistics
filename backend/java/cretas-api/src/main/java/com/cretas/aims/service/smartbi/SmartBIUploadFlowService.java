package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.BatchUploadResult;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.dto.smartbi.SheetConfig;
import com.cretas.aims.dto.smartbi.UploadProgressEvent;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import lombok.Builder;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * SmartBI 上传流程服务接口
 *
 * 编排完整的上传到图表生成流程：
 * 1. 解析 Excel 文件
 * 2. 检测数据类型（销售/财务）
 * 3. 持久化数据到数据库
 * 4. 根据数据特征推荐图表类型
 * 5. 生成图表配置并提供 AI 分析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface SmartBIUploadFlowService {

    /**
     * 完整上传流程结果
     */
    @Data
    @Builder
    class UploadFlowResult {
        /**
         * 是否成功
         */
        private boolean success;

        /**
         * 消息（成功/失败原因）
         */
        private String message;

        /**
         * Excel 解析结果
         */
        private ExcelParseResponse parseResult;

        /**
         * 数据持久化结果
         */
        private ExcelDataPersistenceService.PersistenceResult persistResult;

        /**
         * 推荐的图表类型
         */
        private String recommendedChartType;

        /**
         * 推荐的图表模板列表
         */
        private List<SmartBiChartTemplate> recommendedTemplates;

        /**
         * 图表配置
         */
        private Map<String, Object> chartConfig;

        /**
         * AI 分析结果
         */
        private String aiAnalysis;

        /**
         * 是否需要用户确认字段映射
         */
        private boolean requiresConfirmation;

        /**
         * 检测到的数据类型
         */
        private String detectedDataType;

        /**
         * 上传记录 ID
         */
        private Long uploadId;

        /**
         * 创建失败结果的便捷方法
         */
        public static UploadFlowResult failure(String message) {
            return UploadFlowResult.builder()
                    .success(false)
                    .message(message)
                    .build();
        }

        /**
         * 创建需要确认的结果
         */
        public static UploadFlowResult needsConfirmation(ExcelParseResponse parseResult, String detectedDataType) {
            return UploadFlowResult.builder()
                    .success(true)
                    .message("字段映射需要用户确认")
                    .parseResult(parseResult)
                    .requiresConfirmation(true)
                    .detectedDataType(detectedDataType)
                    .build();
        }
    }

    /**
     * 执行完整的上传流程
     *
     * 处理流程：
     * 1. 解析 Excel 文件
     * 2. 检测数据类型
     * 3. 检查是否需要用户确认字段映射
     * 4. 如果无需确认，自动持久化数据
     * 5. 推荐图表类型并生成配置
     *
     * @param factoryId 工厂ID
     * @param file      上传的 Excel 文件
     * @param dataType  数据类型（可选，null 则自动检测）
     * @return 上传流程结果
     */
    UploadFlowResult executeUploadFlow(String factoryId, MultipartFile file, String dataType);

    /**
     * 执行完整的上传流程（支持指定 Sheet 和自动确认）
     *
     * @param factoryId   工厂ID
     * @param file        上传的 Excel 文件
     * @param dataType    数据类型（可选，null 则自动检测）
     * @param sheetIndex  Sheet 索引（从 0 开始）
     * @param headerRow   表头行索引（从 0 开始）
     * @param autoConfirm 是否自动确认字段映射（跳过用户确认步骤）
     * @return 上传流程结果
     */
    UploadFlowResult executeUploadFlow(String factoryId, MultipartFile file, String dataType,
                                        Integer sheetIndex, Integer headerRow, boolean autoConfirm);

    /**
     * 确认字段映射并持久化数据
     *
     * 当 executeUploadFlow 返回 requiresConfirmation=true 时，
     * 用户确认字段映射后调用此方法完成数据持久化。
     *
     * @param factoryId          工厂ID
     * @param parseResponse      之前的解析结果
     * @param confirmedMappings  用户确认的字段映射
     * @param dataType           数据类型
     * @return 上传流程结果
     */
    UploadFlowResult confirmAndPersist(String factoryId,
                                        ExcelParseResponse parseResponse,
                                        List<FieldMappingResult> confirmedMappings,
                                        String dataType);

    /**
     * 为已持久化的数据生成图表
     *
     * @param factoryId    工厂ID
     * @param uploadId     上传记录ID
     * @param templateCode 图表模板代码
     * @return 图表配置（包含数据和 AI 分析）
     */
    Map<String, Object> generateChart(String factoryId, Long uploadId, String templateCode);

    /**
     * 根据数据特征推荐图表模板
     *
     * @param factoryId     工厂ID
     * @param parseResponse 解析结果
     * @return 推荐的模板列表（按匹配度排序）
     */
    List<SmartBiChartTemplate> recommendTemplates(String factoryId, ExcelParseResponse parseResponse);

    /**
     * 获取数据类型对应的默认图表模板
     *
     * @param dataType  数据类型（SALES/FINANCE）
     * @param factoryId 工厂ID（可选）
     * @return 默认模板列表
     */
    List<SmartBiChartTemplate> getDefaultTemplates(String dataType, String factoryId);

    /**
     * 批量上传多个 Sheet
     *
     * 并行处理多个 Sheet，每个 Sheet 按照配置独立解析和持久化。
     * 部分 Sheet 失败不影响其他 Sheet 的处理。
     *
     * @param factoryId    工厂ID
     * @param inputStream  Excel 文件输入流
     * @param fileName     文件名
     * @param sheetConfigs 各 Sheet 的处理配置
     * @return 批量上传结果
     */
    BatchUploadResult executeBatchUpload(String factoryId, InputStream inputStream,
                                          String fileName, List<SheetConfig> sheetConfigs);

    /**
     * 批量上传多个 Sheet（带进度回调）
     *
     * 并行处理多个 Sheet，通过回调实时推送处理进度。
     *
     * @param factoryId        工厂ID
     * @param inputStream      Excel 文件输入流
     * @param fileName         文件名
     * @param sheetConfigs     各 Sheet 的处理配置
     * @param progressCallback 进度回调（可用于 SSE 推送）
     * @return 批量上传结果
     */
    BatchUploadResult executeBatchUploadWithProgress(String factoryId, InputStream inputStream,
                                                      String fileName, List<SheetConfig> sheetConfigs,
                                                      Consumer<UploadProgressEvent> progressCallback);

    /**
     * Retry a failed or stuck sheet upload
     *
     * Loads the stored Excel file from disk, re-parses the sheet via Python,
     * and re-persists the data. Only works for uploads in FAILED or PARSING status.
     *
     * @param factoryId  Factory ID
     * @param uploadId   Upload record ID to retry
     * @return Upload flow result
     */
    UploadFlowResult retrySheetUpload(String factoryId, Long uploadId);
}
