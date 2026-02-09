package com.cretas.aims.service;

import java.util.Optional;

/**
 * 拼写纠正服务接口
 *
 * 用于纠正用户输入中的中文同音错别字，
 * 基于拼音匹配将错误字词替换为正确的业务词汇。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
public interface SpellCorrectionService {

    /**
     * 纠正输入中的拼写错误
     * @param input 用户输入
     * @return 纠正后的输入，如果无需纠正返回原文
     */
    String correct(String input);

    /**
     * 检查是否需要纠正
     * @param input 用户输入
     * @return true 如果输入包含可识别的拼写错误
     */
    boolean needsCorrection(String input);

    /**
     * 获取纠正建议
     * @param input 用户输入
     * @return 纠正建议，如果无需纠正返回 empty
     */
    Optional<String> suggest(String input);
}
