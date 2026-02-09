package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DateRange;
import com.cretas.aims.dto.smartbi.IntentResult;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;

import java.util.List;
import java.util.Map;

/**
 * SmartBI 意图识别服务接口
 *
 * 提供自然语言查询的意图识别功能：
 * - 基于规则的意图识别（关键词匹配、正则匹配）
 * - 参数提取（时间、维度、实体）
 * - LLM Fallback 判断
 *
 * 设计原则：
 * 1. 规则引擎优先，快速响应常见查询
 * 2. 低置信度时触发 LLM Fallback
 * 3. 支持多维度参数提取
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SmartBIIntentService {

    // ==================== 意图识别 ====================

    /**
     * 识别用户意图
     *
     * 识别流程：
     * 1. 预处理查询文本（去除标点、统一大小写）
     * 2. 关键词匹配
     * 3. 正则模式匹配
     * 4. 计算置信度
     * 5. 提取参数
     *
     * @param userQuery 用户输入的自然语言查询
     * @return 意图识别结果
     */
    IntentResult recognizeIntent(String userQuery);

    /**
     * 识别用户意图（带上下文）
     *
     * @param userQuery 用户查询
     * @param context 上下文信息（如上一次查询结果、用户偏好等）
     * @return 意图识别结果
     */
    IntentResult recognizeIntent(String userQuery, Map<String, Object> context);

    /**
     * 识别用户意图（带会话ID）
     *
     * @param userQuery 用户查询
     * @param sessionId 会话ID（用于多轮对话）
     * @return 意图识别结果
     */
    IntentResult recognizeIntentWithSession(String userQuery, String sessionId);

    // ==================== 参数提取 ====================

    /**
     * 提取查询参数
     *
     * 根据意图类型提取相应的参数：
     * - 销售查询：指标类型、聚合方式
     * - 对比查询：对比维度、对比对象
     * - 下钻查询：下钻路径、筛选条件
     *
     * @param userQuery 用户查询
     * @param intent 已识别的意图
     * @return 参数映射表
     */
    Map<String, Object> extractParameters(String userQuery, SmartBIIntent intent);

    // ==================== 时间解析 ====================

    /**
     * 解析时间范围
     *
     * 支持的时间表达式：
     * - 相对时间：今天、昨天、本周、上周、本月、上月、今年、去年
     * - 季度：Q1、Q2、Q3、Q4、第一季度、本季度
     * - 绝对时间：2024年、2024年1月、2024-01-01
     * - 时间段：最近7天、最近30天、过去一年
     *
     * @param userQuery 用户查询
     * @return 时间范围对象，解析失败返回 null
     */
    DateRange parseTimeRange(String userQuery);

    /**
     * 解析时间范围（带默认值）
     *
     * @param userQuery 用户查询
     * @param defaultRange 默认时间范围
     * @return 时间范围对象
     */
    DateRange parseTimeRange(String userQuery, DateRange defaultRange);

    // ==================== 维度解析 ====================

    /**
     * 解析分析维度
     *
     * 支持的维度：
     * - 部门：按部门、分部门、各部门
     * - 区域：按区域、分地区、各城市
     * - 产品：按产品、分品类、各商品
     * - 人员：按人员、分销售、各员工
     * - 时间：按月、按周、按日
     *
     * @param userQuery 用户查询
     * @return 维度标识（department, region, product, person, time），未识别返回 null
     */
    String parseDimension(String userQuery);

    /**
     * 解析所有可能的维度
     *
     * @param userQuery 用户查询
     * @return 维度列表（按相关性排序）
     */
    List<String> parseAllDimensions(String userQuery);

    // ==================== 实体抽取 ====================

    /**
     * 解析实体
     *
     * 支持的实体类型：
     * - department: 部门名称（如：销售部、市场部）
     * - region: 区域名称（如：华东、北京、上海）
     * - person: 人名（如：张三、李四）
     * - product: 产品名称（如：产品A、SKU001）
     * - metric: 指标名称（如：销售额、利润率）
     *
     * @param userQuery 用户查询
     * @param entityType 实体类型
     * @return 抽取出的实体列表
     */
    List<String> parseEntities(String userQuery, String entityType);

    /**
     * 解析所有类型的实体
     *
     * @param userQuery 用户查询
     * @return 实体映射（key: 实体类型, value: 实体列表）
     */
    Map<String, List<String>> parseAllEntities(String userQuery);

    // ==================== LLM Fallback ====================

    /**
     * 判断是否需要 LLM Fallback
     *
     * 触发条件：
     * 1. 置信度低于阈值（默认 0.7）
     * 2. 意图为 UNKNOWN
     * 3. 存在多个高置信度候选意图（歧义）
     *
     * @param userQuery 用户查询
     * @param confidence 当前识别置信度
     * @return 是否需要 LLM Fallback
     */
    boolean needsLLMFallback(String userQuery, double confidence);

    /**
     * 判断是否需要 LLM Fallback（使用默认阈值）
     *
     * @param intentResult 意图识别结果
     * @return 是否需要 LLM Fallback
     */
    boolean needsLLMFallback(IntentResult intentResult);

    // ==================== 配置管理 ====================

    /**
     * 获取 LLM Fallback 置信度阈值
     *
     * @return 阈值（0.0 - 1.0）
     */
    double getLLMFallbackThreshold();

    /**
     * 设置 LLM Fallback 置信度阈值
     *
     * @param threshold 阈值（0.0 - 1.0）
     */
    void setLLMFallbackThreshold(double threshold);

    /**
     * 获取支持的所有意图列表
     *
     * @return 意图列表
     */
    List<SmartBIIntent> getSupportedIntents();

    /**
     * 获取指定分类的意图列表
     *
     * @param category 意图分类（QUERY, COMPARE, DRILL, FORECAST）
     * @return 意图列表
     */
    List<SmartBIIntent> getIntentsByCategory(String category);

    // ==================== 调试与统计 ====================

    /**
     * 获取意图识别统计信息
     *
     * @return 统计信息（意图分布、平均置信度、LLM fallback 比例等）
     */
    Map<String, Object> getStatistics();

    /**
     * 重置统计信息
     */
    void resetStatistics();

    /**
     * 刷新意图模式配置
     * 重新加载 intent_patterns.json
     */
    void refreshPatterns();
}
