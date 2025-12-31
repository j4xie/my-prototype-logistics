package com.joolun.mall.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 阿里云OSS配置
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "aliyun.oss")
public class OssConfigProperties {

    /**
     * AccessKey ID
     */
    private String accessKeyId;

    /**
     * AccessKey Secret
     */
    private String accessKeySecret;

    /**
     * Region ID (如: cn-shanghai)
     */
    private String region = "cn-shanghai";

    /**
     * Bucket名称
     */
    private String bucket = "mall-products-shanghai";

    /**
     * OSS Endpoint
     */
    private String endpoint = "oss-cn-shanghai.aliyuncs.com";

    /**
     * STS临时凭证有效期(秒), 默认30分钟
     */
    private Long stsExpireSeconds = 1800L;

    /**
     * 获取完整的OSS URL前缀
     */
    public String getOssUrlPrefix() {
        return "https://" + bucket + "." + endpoint;
    }
}
