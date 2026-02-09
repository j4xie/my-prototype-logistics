package com.cretas.aims.service;

import com.cretas.aims.dto.pack.ExportRulePackRequest;
import com.cretas.aims.dto.pack.ImportRulePackRequest;
import com.cretas.aims.dto.pack.ImportRulePackResult;
import com.cretas.aims.dto.pack.RulePackDTO;

/**
 * 规则包服务接口
 *
 * 提供 Drools 规则的批量导出/导入功能
 * Sprint 3 任务:
 * - S3-4: 规则包导出
 * - S3-5: 规则包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface RulePackService {

    /**
     * 导出规则包
     *
     * @param request 导出请求
     * @return 规则包
     */
    RulePackDTO exportRulePack(ExportRulePackRequest request);

    /**
     * 导入规则包
     *
     * @param request 导入请求
     * @return 导入结果
     */
    ImportRulePackResult importRulePack(ImportRulePackRequest request);

    /**
     * 预览导入效果 (dry-run)
     *
     * @param request 导入请求
     * @return 预览结果
     */
    ImportRulePackResult previewImport(ImportRulePackRequest request);

    /**
     * 验证规则包格式
     *
     * @param pack 规则包
     * @return 验证结果，null表示有效
     */
    String validatePack(RulePackDTO pack);
}
