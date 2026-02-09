package com.cretas.aims.config;

import com.cretas.aims.entity.IndustryKnowledgeEntry;
import com.cretas.aims.repository.IndustryKnowledgeEntryRepository;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 行业知识配置
 *
 * 提供食品加工行业的内置知识，用于增强 AI 分析能力。
 * 支持双层知识来源：
 * 1. System Prompt (内置知识) - 硬编码的行业通用知识
 * 2. Database (数据库知识) - 从 industry_knowledge_entry 表加载
 *
 * 数据库知识优先级高于内置知识，支持动态刷新。
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-19
 */
@Configuration
@ConfigurationProperties(prefix = "ai.industry-knowledge")
@Data
@Slf4j
public class IndustryKnowledgeConfig {

    @Autowired(required = false)
    private IndustryKnowledgeEntryRepository knowledgeRepository;

    /**
     * 内置主题知识映射 (硬编码)
     */
    private Map<String, String> builtInKnowledge = new HashMap<>();

    /**
     * 数据库主题知识映射 (从DB加载)
     */
    private Map<String, String> databaseKnowledge = new ConcurrentHashMap<>();

    /**
     * 合并后的主题知识映射 (数据库优先)
     */
    private Map<String, String> topicKnowledge = new ConcurrentHashMap<>();

    /**
     * 是否启用行业知识增强
     */
    private boolean enabled = true;

    /**
     * 是否启用数据库知识加载
     */
    private boolean loadFromDatabase = true;

    /**
     * 初始化行业知识
     */
    @PostConstruct
    public void initDefaultKnowledge() {
        log.info("初始化食品行业知识库...");

        // 1. 加载内置知识
        initBuiltInKnowledge();

        // 2. 从数据库加载知识 (如果启用)
        if (loadFromDatabase) {
            loadKnowledgeFromDatabase();
        }

        // 3. 合并知识 (数据库优先)
        mergeKnowledge();

        log.info("✅ 食品行业知识库初始化完成，共 {} 个主题 (内置: {}, 数据库: {})",
                topicKnowledge.size(), builtInKnowledge.size(), databaseKnowledge.size());
    }

    /**
     * 初始化内置知识
     */
    private void initBuiltInKnowledge() {
        // 产品状态分析知识
        builtInKnowledge.put("PRODUCT_STATUS", """
            食品生产行业关键指标：
            - 良品率：行业标准 ≥95%，优秀 ≥98%
            - 产能利用率：正常 70-85%，过高可能影响质量
            - 生产周期：应符合产品特性，过长可能影响新鲜度
            - 批次追溯：每批次需有完整的原料、工艺、人员记录

            常见问题及建议：
            - 良品率下降：检查原料质量、设备状态、人员操作规范
            - 产能不足：优化排产、增加班次、检查设备效率
            """);

        // 库存状态分析知识
        builtInKnowledge.put("INVENTORY_STATUS", """
            食品库存管理要点：
            - 库存周转：建议 7-14 天，过长影响新鲜度
            - 先进先出 (FIFO)：严格执行，防止过期
            - 安全库存：建议保持 3-5 天的安全库存量
            - 保质期预警：建议提前 30% 时间预警

            库存健康评估：
            - 周转率 > 26次/年：优秀
            - 周转率 12-26次/年：正常
            - 周转率 < 12次/年：需关注
            """);

        // 质检分析知识
        builtInKnowledge.put("QUALITY_ANALYSIS", """
            食品质检要点：
            - 微生物指标：大肠杆菌、沙门氏菌、金黄色葡萄球菌等
            - 理化指标：水分、灰分、重金属、农残
            - 感官指标：色泽、气味、口感、外观

            质检合格率标准：
            - 法规要求：100% 合格
            - 内控标准：不良率 < 2%
            - 优秀水平：不良率 < 0.5%

            常见质量问题及原因：
            - 微生物超标：环境卫生、人员卫生、加工温度
            - 水分超标：干燥工艺、包装密封性
            - 异物混入：设备磨损、人员操作
            """);

        // 出货状态分析知识
        builtInKnowledge.put("SHIPMENT_STATUS", """
            食品物流配送要点：
            - 冷链要求：按产品特性保持温度链完整
            - 配送时效：生鲜类 24h 内，常温类 72h 内
            - 单据完整：出库单、运输单、交接单齐全

            配送效率指标：
            - 准时交付率：目标 ≥ 98%
            - 货损率：目标 < 0.1%
            - 客诉率：目标 < 0.5%
            """);

        // 人员分析知识
        builtInKnowledge.put("PERSONNEL_ANALYSIS", """
            食品生产人员管理要点：
            - 健康证：必须持有效健康证上岗
            - 培训：定期食品安全培训
            - 出勤率：行业正常 95% 以上

            人效指标：
            - 人均产量：根据产品类型和工艺确定基准
            - 工时利用率：目标 85-90%
            - 技能等级：关键岗位需持证上岗
            """);

        // 整体业务分析知识
        builtInKnowledge.put("OVERALL_BUSINESS", """
            食品企业运营综合指标：

            生产维度：
            - 产能利用率、良品率、设备OEE

            质量维度：
            - 质检合格率、客诉率、召回次数

            库存维度：
            - 周转率、呆滞库存比例、损耗率

            人员维度：
            - 出勤率、人效、培训覆盖率

            食品安全：
            - 追溯覆盖率应达 100%
            - 关键控制点 (CCP) 监控完整
            """);

        // 通用分析知识
        builtInKnowledge.put("GENERAL", """
            食品行业通用知识：
            - 遵循 HACCP、ISO22000 等食品安全管理体系
            - 重视追溯体系建设，做到来源可查、去向可追
            - 关注法规动态，及时响应监管要求
            - 持续改进，建立 PDCA 循环
            """);

        log.info("内置知识加载完成，共 {} 个主题", builtInKnowledge.size());
    }

    /**
     * 从数据库加载行业知识
     */
    private void loadKnowledgeFromDatabase() {
        if (knowledgeRepository == null) {
            log.warn("知识库 Repository 未注入，跳过数据库加载");
            return;
        }

        try {
            List<IndustryKnowledgeEntry> entries = knowledgeRepository.findByIsActiveTrue();
            databaseKnowledge.clear();

            for (IndustryKnowledgeEntry entry : entries) {
                String topicCode = entry.getTopicCode();
                String content = entry.getKnowledgeContent();

                // 如果同一主题有多条记录，合并内容
                if (databaseKnowledge.containsKey(topicCode)) {
                    content = databaseKnowledge.get(topicCode) + "\n\n" + content;
                }
                databaseKnowledge.put(topicCode, content);
            }

            log.info("📚 从数据库加载知识完成，共 {} 个主题", databaseKnowledge.size());

        } catch (Exception e) {
            log.error("❌ 从数据库加载知识失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 合并知识 (数据库优先)
     */
    private void mergeKnowledge() {
        topicKnowledge.clear();

        // 先添加内置知识
        topicKnowledge.putAll(builtInKnowledge);

        // 再用数据库知识覆盖 (优先级更高)
        topicKnowledge.putAll(databaseKnowledge);
    }

    /**
     * 定时刷新数据库知识 (每5分钟)
     */
    @Scheduled(fixedRate = 300000)
    public void refreshKnowledgeFromDatabase() {
        if (!loadFromDatabase || knowledgeRepository == null) {
            return;
        }

        log.debug("开始刷新数据库知识...");
        loadKnowledgeFromDatabase();
        mergeKnowledge();
        log.debug("数据库知识刷新完成，共 {} 个主题", topicKnowledge.size());
    }

    /**
     * 手动触发刷新
     */
    public void forceRefresh() {
        log.info("手动触发知识刷新...");
        loadKnowledgeFromDatabase();
        mergeKnowledge();
        log.info("✅ 知识刷新完成，共 {} 个主题 (内置: {}, 数据库: {})",
                topicKnowledge.size(), builtInKnowledge.size(), databaseKnowledge.size());
    }

    /**
     * 获取指定主题的行业知识
     *
     * @param topicName 主题名称
     * @return 行业知识文本，如果未找到返回通用知识
     */
    public String getKnowledgeForTopic(String topicName) {
        if (!enabled) {
            return "";
        }

        String knowledge = topicKnowledge.get(topicName);
        if (knowledge == null || knowledge.isEmpty()) {
            knowledge = topicKnowledge.get("GENERAL");
        }

        return knowledge != null ? knowledge : "";
    }

    /**
     * 添加或更新主题知识
     *
     * @param topicName 主题名称
     * @param knowledge 知识内容
     */
    public void addKnowledge(String topicName, String knowledge) {
        topicKnowledge.put(topicName, knowledge);
        log.info("行业知识已更新: topic={}", topicName);
    }

    /**
     * 获取所有主题列表
     */
    public List<String> getAllTopics() {
        return List.copyOf(topicKnowledge.keySet());
    }

    /**
     * 获取数据库知识统计
     */
    public Map<String, Integer> getKnowledgeStats() {
        Map<String, Integer> stats = new HashMap<>();
        stats.put("builtIn", builtInKnowledge.size());
        stats.put("database", databaseKnowledge.size());
        stats.put("total", topicKnowledge.size());
        return stats;
    }
}
