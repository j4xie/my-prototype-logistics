package com.cretas.aims.config;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 阿里云 OSS 配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "aliyun.oss")
public class OssConfig {

    private String endpoint = "oss-cn-shanghai.aliyuncs.com";
    private String accessKeyId;
    private String accessKeySecret;
    private String audioBucket = "cretas-audio";
    private String mediaBucket = "cretas-media";

    @Bean
    public OSS ossClient() {
        return new OSSClientBuilder().build(
                "https://" + endpoint,
                accessKeyId,
                accessKeySecret
        );
    }

    /**
     * 获取音频文件访问 URL 前缀
     */
    public String getAudioUrlPrefix() {
        return "https://" + audioBucket + "." + endpoint;
    }

    /**
     * 获取媒体文件访问 URL 前缀
     */
    public String getMediaUrlPrefix() {
        return "https://" + mediaBucket + "." + endpoint;
    }
}
