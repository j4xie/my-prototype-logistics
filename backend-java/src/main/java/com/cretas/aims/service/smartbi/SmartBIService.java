package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.*;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * SmartBI 核心调度服务接口
 *
 * 作为 SmartBI 系统的中央调度服务，协调各个分析服务，统一处理：
 * - 经营驾驶舱数据聚合
 * - 自然语言查询处理
 * - 数据下钻分析
 * - 缓存管理
 * - 使用记录与计费
 * - AI 洞察生成
 *
 * 设计原则：
 * 1. 门面模式：对外提供统一的访问入口
 * 2. 缓存优先：减少重复计算和 AI 调用
 * 3. 配额管控：防止滥用，控制成本
 * 4. 可观测性：记录所有使用行为
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see SalesAnalysisService
 * @see DepartmentAnalysisService
 * @see RegionAnalysisService
 * @see FinanceAnalysisService
 * @see SmartBIIntentService
 */
public interface SmartBIService {

    // ==================== 经营驾驶舱 ====================

    /**
     * 获取经营驾驶舱数据
     *
     * 聚合各维度的分析数据，构建完整的驾驶舱视图：
     * - KPI 卡片：销售额、订单数、客单价、完成率、环比增长
     * - 排行榜：销售员排名、部门排名、区域排名
     * - 图表：销售趋势、产品占比、部门对比
     * - AI 洞察：智能分析与建议
     *
     * 缓存策略：
     * - period=today：缓存 15 分钟
     * - period=week/month：缓存 1 小时
     * - period=quarter/year：缓存 4 小时
     *
     * @param factoryId 工厂ID
     * @param period    时间周期：today, week, month, quarter, year
     * @return 驾驶舱响应数据
     */
    DashboardResponse getExecutiveDashboard(String factoryId, String period);

    // ==================== 综合分析 ====================

    /**
     * 获取综合分析数据
     *
     * 根据分析类型返回相应的综合分析结果：
     * - sales：销售综合分析（销售员、产品、客户维度）
     * - department：部门综合分析（业绩、效率、人员）
     * - region：区域综合分析（排名、趋势、机会评分）
     * - finance：财务综合分析（利润、成本、应收）
     *
     * @param factoryId    工厂ID
     * @param startDate    开始日期
     * @param endDate      结束日期
     * @param analysisType 分析类型：sales, department, region, finance
     * @return 分析结果映射
     */
    Map<String, Object> getComprehensiveAnalysis(String factoryId, LocalDate startDate,
                                                   LocalDate endDate, String analysisType);

    // ==================== 自然语言问答 ====================

    /**
     * 处理自然语言查询
     *
     * 完整的自然语言处理流程：
     * 1. 配额检查：确保未超出每日限额
     * 2. 意图识别：解析用户查询意图
     * 3. 参数提取：提取时间、维度、实体等参数
     * 4. 数据查询：调用相应分析服务获取数据
     * 5. 响应生成：生成自然语言响应文本
     * 6. 图表生成：根据意图生成可视化配置
     * 7. 历史记录：保存查询历史用于上下文分析
     * 8. 使用记录：记录使用情况用于计费
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @param request   自然语言查询请求
     * @return 查询响应
     * @throws com.cretas.aims.exception.BusinessException 配额超限或查询失败时抛出
     */
    NLQueryResponse processQuery(String factoryId, Long userId, NLQueryRequest request);

    // ==================== 数据下钻 ====================

    /**
     * 处理数据下钻请求
     *
     * 支持的下钻维度：
     * - region：区域 -> 省份 -> 城市
     * - department：部门 -> 小组 -> 人员
     * - product：品类 -> 系列 -> SKU
     * - time：年 -> 季度 -> 月 -> 周 -> 日
     *
     * @param factoryId 工厂ID
     * @param request   下钻请求
     * @return 下钻结果
     */
    Map<String, Object> processDrillDown(String factoryId, DrillDownRequest request);

    // ==================== 缓存管理 ====================

    /**
     * 使指定类型的缓存失效
     *
     * 当数据更新时调用，清除相关缓存：
     * - 数据上传后清除对应分析类型的缓存
     * - 配置变更后清除全部缓存
     *
     * @param factoryId    工厂ID
     * @param analysisType 分析类型：DASHBOARD, SALES, DEPARTMENT, REGION, FINANCE, ALL
     */
    void invalidateCache(String factoryId, String analysisType);

    /**
     * 从缓存获取数据
     *
     * @param factoryId 工厂ID
     * @param cacheKey  缓存键
     * @return 缓存数据，不存在或已过期返回 empty
     */
    Optional<Object> getFromCache(String factoryId, String cacheKey);

    /**
     * 保存数据到缓存
     *
     * @param factoryId 工厂ID
     * @param cacheKey  缓存键
     * @param data      缓存数据
     * @param ttl       缓存有效期
     */
    void saveToCache(String factoryId, String cacheKey, Object data, Duration ttl);

    // ==================== 使用记录 ====================

    /**
     * 记录使用情况
     *
     * 记录每次操作的使用情况，用于：
     * - 计费：按使用量计费
     * - 统计：分析使用模式
     * - 监控：检测异常使用
     *
     * @param factoryId  工厂ID
     * @param userId     用户ID
     * @param actionType 操作类型：UPLOAD, DASHBOARD, QUERY, DRILLDOWN, EXPORT
     * @param tokenCount Token 消耗数量
     * @param cacheHit   是否命中缓存
     */
    void recordUsage(String factoryId, Long userId, String actionType, int tokenCount, boolean cacheHit);

    // ==================== 配额检查 ====================

    /**
     * 检查配额是否充足
     *
     * 根据计费模式检查配额：
     * - QUOTA 模式：检查今日使用次数是否超限
     * - PAY_AS_YOU_GO 模式：检查月度费用是否超限
     * - UNLIMITED 模式：始终返回 true
     *
     * @param factoryId 工厂ID
     * @return 配额是否充足
     */
    boolean checkQuota(String factoryId);

    /**
     * 获取剩余配额
     *
     * @param factoryId 工厂ID
     * @return 剩余配额数量，UNLIMITED 模式返回 Integer.MAX_VALUE
     */
    int getRemainingQuota(String factoryId);

    // ==================== AI 洞察生成 ====================

    /**
     * 生成 AI 洞察
     *
     * 基于驾驶舱数据生成智能洞察，包括：
     * - 关键指标异常检测
     * - 趋势变化分析
     * - 排名变动提醒
     * - 智能建议生成
     *
     * @param factoryId 工厂ID
     * @param dashboard 驾驶舱数据
     * @return AI 洞察列表
     */
    List<AIInsight> generateAIInsights(String factoryId, DashboardResponse dashboard);
}
