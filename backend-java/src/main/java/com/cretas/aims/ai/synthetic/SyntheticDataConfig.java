package com.cretas.aims.ai.synthetic;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * 合成数据生成配置
 * 配置前缀: cretas.ai.synthetic
 *
 * 示例配置:
 * cretas.ai.synthetic.accuracy-threshold=0.85
 * cretas.ai.synthetic.distribution-drift-threshold=0.10
 * cretas.ai.synthetic.enabled=true
 */
@Component
@ConfigurationProperties(prefix = "cretas.ai.synthetic")
@Data
public class SyntheticDataConfig {

    /**
     * 是否启用合成数据生成（全局开关）
     */
    private boolean enabled = true;

    /**
     * 准确率阈值
     * 当准确率低于此值时触发熔断
     * 默认: 0.85 (85%)
     */
    private BigDecimal accuracyThreshold = BigDecimal.valueOf(0.85);

    /**
     * 分布漂移阈值
     * 当分布漂移超过此值时触发熔断
     * 默认: 0.10 (JS散度)
     */
    private BigDecimal distributionDriftThreshold = BigDecimal.valueOf(0.10);

    /**
     * 最小样本数要求
     * 低于此值时不进行熔断检查
     */
    private Long minSampleCount = 100L;

    /**
     * 熔断冷却时间（小时）
     * 熔断触发后多久允许手动重置
     */
    private Integer cooldownHours = 24;

    /**
     * 连续失败次数阈值
     * 连续多少次检测失败后触发熔断
     */
    private Integer consecutiveFailureThreshold = 3;

    /**
     * 告警开关
     */
    private boolean alertEnabled = true;

    /**
     * 钉钉 Webhook（可选）
     */
    private String dingtalkWebhook;

    /**
     * 告警邮箱（可选）
     */
    private String alertEmail;
}
