package com.joolun.mall.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * RestTemplate 配置
 * 用于调用外部 API（如 DeepSeek）
 */
@Configuration
public class RestTemplateConfig {

    /**
     * 创建 RestTemplate Bean
     * 配置连接超时和读取超时
     */
    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        // 连接超时 10 秒
        factory.setConnectTimeout(10000);
        // 读取超时 60 秒（AI 响应可能需要较长时间）
        factory.setReadTimeout(60000);
        return new RestTemplate(factory);
    }
}
