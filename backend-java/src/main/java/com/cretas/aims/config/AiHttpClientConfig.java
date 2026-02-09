package com.cretas.aims.config;

import lombok.extern.slf4j.Slf4j;
import okhttp3.ConnectionPool;
import okhttp3.OkHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * AI 服务 HTTP 客户端配置
 *
 * 使用 OkHttp 连接池优化 LLM 调用性能：
 * - 连接复用减少 TCP 握手开销
 * - 连接池管理提升并发性能
 * - 超时配置防止长时间阻塞
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Configuration
public class AiHttpClientConfig {

    @Value("${cretas.ai.http.connect-timeout:5}")
    private int connectTimeout;

    @Value("${cretas.ai.http.read-timeout:30}")
    private int readTimeout;

    @Value("${cretas.ai.http.write-timeout:10}")
    private int writeTimeout;

    @Value("${cretas.ai.http.pool.max-idle-connections:10}")
    private int maxIdleConnections;

    @Value("${cretas.ai.http.pool.keep-alive-duration:5}")
    private int keepAliveDuration;

    /**
     * 创建专用于 AI 服务调用的 OkHttpClient
     *
     * 配置说明：
     * - connectTimeout: 连接超时 5 秒（默认）
     * - readTimeout: 读取超时 30 秒（LLM 响应可能较慢）
     * - writeTimeout: 写入超时 10 秒
     * - connectionPool: 最多 10 个空闲连接，保持 5 分钟
     * - retryOnConnectionFailure: 启用连接失败重试
     */
    @Bean(name = "aiServiceHttpClient")
    public OkHttpClient aiServiceHttpClient() {
        log.info("Initializing AI Service OkHttpClient: connectTimeout={}s, readTimeout={}s, pool={}/{}min",
                connectTimeout, readTimeout, maxIdleConnections, keepAliveDuration);

        ConnectionPool connectionPool = new ConnectionPool(
                maxIdleConnections,
                keepAliveDuration,
                TimeUnit.MINUTES
        );

        return new OkHttpClient.Builder()
                .connectTimeout(connectTimeout, TimeUnit.SECONDS)
                .readTimeout(readTimeout, TimeUnit.SECONDS)
                .writeTimeout(writeTimeout, TimeUnit.SECONDS)
                .connectionPool(connectionPool)
                .retryOnConnectionFailure(true)
                // 可选：添加日志拦截器用于调试
                // .addInterceptor(new HttpLoggingInterceptor().setLevel(Level.BASIC))
                .build();
    }
}
