package com.cretas.aims.config;

import com.cretas.aims.service.RequestScopedEmbeddingCache;
import org.springframework.stereotype.Component;

import javax.servlet.*;
import java.io.IOException;

/**
 * Embedding 缓存清理过滤器
 * 确保每个请求结束时清理 ThreadLocal 缓存，防止内存泄漏
 */
@Component
public class EmbeddingCacheFilter implements Filter {

    private final RequestScopedEmbeddingCache embeddingCache;

    public EmbeddingCacheFilter(RequestScopedEmbeddingCache embeddingCache) {
        this.embeddingCache = embeddingCache;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            chain.doFilter(request, response);
        } finally {
            // 确保请求结束时清理缓存
            embeddingCache.clear();
        }
    }
}
