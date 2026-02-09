package com.cretas.aims.service;

import com.cretas.aims.dto.pack.ExportTemplatePackRequest;
import com.cretas.aims.dto.pack.FormTemplatePackDTO;
import com.cretas.aims.dto.pack.ImportTemplatePackRequest;
import com.cretas.aims.dto.pack.ImportTemplatePackResult;

/**
 * 表单模板包服务接口
 *
 * 提供表单模板的批量导出/导入功能
 * Sprint 3 任务:
 * - S3-2: 模板包导出
 * - S3-3: 模板包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface FormTemplatePackService {

    /**
     * 导出表单模板包
     *
     * @param request 导出请求
     * @return 表单模板包
     */
    FormTemplatePackDTO exportTemplatePack(ExportTemplatePackRequest request);

    /**
     * 导入表单模板包
     *
     * @param request 导入请求
     * @return 导入结果
     */
    ImportTemplatePackResult importTemplatePack(ImportTemplatePackRequest request);

    /**
     * 预览导入效果 (dry-run)
     *
     * @param request 导入请求
     * @return 预览结果
     */
    ImportTemplatePackResult previewImport(ImportTemplatePackRequest request);

    /**
     * 验证模板包格式
     *
     * @param pack 模板包
     * @return 验证结果，null表示有效
     */
    String validatePack(FormTemplatePackDTO pack);
}
