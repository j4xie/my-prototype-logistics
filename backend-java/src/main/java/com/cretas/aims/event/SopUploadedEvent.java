package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.HashMap;
import java.util.Map;

/**
 * SOP 文档上传事件
 *
 * <p>当 SOP 文档上传完成后触发此事件，用于:
 * <ul>
 *   <li>自动解析 SOP 文档内容</li>
 *   <li>分析 SKU 生产复杂度</li>
 *   <li>更新排产特征权重</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Getter
public class SopUploadedEvent extends ApplicationEvent {

    /**
     * 工厂ID
     */
    private final String factoryId;

    /**
     * SOP 配置ID
     */
    private final String sopId;

    /**
     * 文件URL
     */
    private final String fileUrl;

    /**
     * 文件类型 (PDF, EXCEL, IMAGE)
     */
    private final String fileType;

    /**
     * 关联的 SKU 编码（可选）
     */
    private final String skuCode;

    /**
     * 产品类型ID（可选）
     */
    private final String productTypeId;

    /**
     * 上传者用户ID
     */
    private final Long uploadedBy;

    /**
     * 原始文件名
     */
    private final String originalFileName;

    /**
     * 构造函数
     *
     * @param source 事件源
     * @param factoryId 工厂ID
     * @param sopId SOP配置ID
     * @param fileUrl 文件URL
     * @param fileType 文件类型
     * @param skuCode SKU编码
     * @param productTypeId 产品类型ID
     * @param uploadedBy 上传者用户ID
     * @param originalFileName 原始文件名
     */
    public SopUploadedEvent(Object source,
                            String factoryId,
                            String sopId,
                            String fileUrl,
                            String fileType,
                            String skuCode,
                            String productTypeId,
                            Long uploadedBy,
                            String originalFileName) {
        super(source);
        this.factoryId = factoryId;
        this.sopId = sopId;
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.skuCode = skuCode;
        this.productTypeId = productTypeId;
        this.uploadedBy = uploadedBy;
        this.originalFileName = originalFileName;
    }

    /**
     * 简化构造函数
     */
    public SopUploadedEvent(Object source,
                            String factoryId,
                            String sopId,
                            String fileUrl,
                            String fileType) {
        this(source, factoryId, sopId, fileUrl, fileType, null, null, null, null);
    }

    /**
     * 转换为上下文 Map，供工具执行使用
     *
     * @return 上下文 Map
     */
    public Map<String, Object> toContext() {
        Map<String, Object> context = new HashMap<>();
        context.put("factoryId", factoryId);
        context.put("sopId", sopId);
        context.put("fileUrl", fileUrl);
        context.put("fileType", fileType);
        context.put("skuCode", skuCode);
        context.put("productTypeId", productTypeId);
        context.put("uploadedBy", uploadedBy);
        context.put("originalFileName", originalFileName);
        context.put("triggerType", "SOP_UPLOAD");
        return context;
    }

    /**
     * 判断是否为 PDF 文件
     */
    public boolean isPdf() {
        return "PDF".equalsIgnoreCase(fileType);
    }

    /**
     * 判断是否为 Excel 文件
     */
    public boolean isExcel() {
        return "EXCEL".equalsIgnoreCase(fileType) ||
               "XLS".equalsIgnoreCase(fileType) ||
               "XLSX".equalsIgnoreCase(fileType);
    }

    /**
     * 判断是否为图片文件
     */
    public boolean isImage() {
        return "IMAGE".equalsIgnoreCase(fileType) ||
               "PNG".equalsIgnoreCase(fileType) ||
               "JPG".equalsIgnoreCase(fileType) ||
               "JPEG".equalsIgnoreCase(fileType);
    }

    @Override
    public String toString() {
        return String.format("SopUploadedEvent[factoryId=%s, sopId=%s, fileType=%s, skuCode=%s]",
                factoryId, sopId, fileType, skuCode);
    }
}
