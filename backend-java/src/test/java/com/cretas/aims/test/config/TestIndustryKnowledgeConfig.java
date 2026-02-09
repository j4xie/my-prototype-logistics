package com.cretas.aims.test.config;

import com.cretas.aims.config.IndustryKnowledgeConfig;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.HashMap;
import java.util.Map;

/**
 * 测试用行业知识配置
 * 提供可预测的测试数据
 */
@TestConfiguration
public class TestIndustryKnowledgeConfig {

    @Bean
    @Primary
    public IndustryKnowledgeConfig testKnowledgeConfig() {
        IndustryKnowledgeConfig config = new IndustryKnowledgeConfig();

        // 初始化测试用知识库
        Map<String, String> testKnowledge = new HashMap<>();

        testKnowledge.put("PRODUCT_STATUS", """
                测试用产品状态知识：
                - 良品率标准：行业标准 ≥95%，优秀 ≥98%
                - 在产批次：正常范围 10-50 个
                - 质检通过率：应达到 100%
                - 产能利用率：正常范围 70-90%
                """);

        testKnowledge.put("QUALITY_ANALYSIS", """
                测试用质检知识：
                - 微生物指标：大肠杆菌 ≤ 10 CFU/g，沙门氏菌不得检出
                - 理化指标：水分 ≤ 14%，灰分 ≤ 5%
                - 感官指标：色泽均匀，无异味，口感正常
                - 检测频率：每批次必检
                """);

        testKnowledge.put("INVENTORY_STATUS", """
                测试用库存知识：
                - 库存周转：建议 7-14 天
                - 安全库存：维持 3-5 天用量
                - 临期预警：保质期剩余 30% 时预警
                - 先进先出：严格执行 FIFO 原则
                """);

        testKnowledge.put("SHIPMENT_STATUS", """
                测试用出货知识：
                - 准时交付率：目标 ≥ 98%
                - 订单完成周期：标准 24-48 小时
                - 包装完好率：要求 100%
                - 温控要求：冷链产品 2-8°C
                """);

        testKnowledge.put("PERSONNEL_ANALYSIS", """
                测试用人员知识：
                - 出勤率：目标 ≥ 95%
                - 培训覆盖：新员工 100%
                - 技能认证：关键岗位必须持证
                - 健康检查：每年至少一次
                """);

        testKnowledge.put("OVERALL_BUSINESS", """
                测试用整体业务知识：
                - 综合效率：OEE 目标 ≥ 85%
                - 成本控制：损耗率 ≤ 2%
                - 客户满意度：目标 ≥ 90%
                - 环保合规：废弃物处理 100% 合规
                """);

        testKnowledge.put("GENERAL", """
                测试用通用知识：
                - 食品安全：符合 GB 国标要求
                - 追溯系统：全程可追溯
                - 记录保存：至少保存 2 年
                """);

        config.setTopicKnowledge(testKnowledge);
        return config;
    }

    /**
     * 创建空知识库配置（用于边界测试）
     */
    public static IndustryKnowledgeConfig createEmptyKnowledgeConfig() {
        IndustryKnowledgeConfig config = new IndustryKnowledgeConfig();
        config.setTopicKnowledge(new HashMap<>());
        return config;
    }

    /**
     * 创建最小知识库配置
     */
    public static IndustryKnowledgeConfig createMinimalKnowledgeConfig() {
        IndustryKnowledgeConfig config = new IndustryKnowledgeConfig();
        Map<String, String> minimal = new HashMap<>();
        minimal.put("GENERAL", "基础食品行业知识");
        config.setTopicKnowledge(minimal);
        return config;
    }
}
