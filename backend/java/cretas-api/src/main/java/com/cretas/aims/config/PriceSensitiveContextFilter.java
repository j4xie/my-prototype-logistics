package com.cretas.aims.config;

import com.cretas.aims.security.PriceSensitiveContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Guarantees that {@link PriceSensitiveContext}'s ThreadLocal is cleared at
 * the end of every request, even when serialization succeeds and the controller
 * advice never had a chance to clean up.
 *
 * <h2>Why this filter exists</h2>
 *
 * <p>{@link com.cretas.aims.security.PriceFieldResponseAdvice#beforeBodyWrite}
 * sets the ThreadLocal flag before Jackson serializes the response body.
 * Jackson serialization happens <i>after</i> {@code beforeBodyWrite} returns —
 * so the advice itself cannot put the {@code clear()} call in a {@code finally}
 * block tied to the serialization lifecycle (the advice has already returned).
 *
 * <p>This filter wraps the entire request lifecycle and clears the ThreadLocal
 * in {@code finally}, guaranteeing no leak onto pooled Tomcat worker threads.
 *
 * <h2>Order</h2>
 *
 * <p>{@link Ordered#HIGHEST_PRECEDENCE} so this filter is the outermost layer
 * — the {@code finally} runs after every other filter / interceptor /
 * controller advice has completed.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-05-12 (P0 hotfix)
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PriceSensitiveContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            // Always clear — covers happy path, errors, and short-circuited responses.
            PriceSensitiveContext.clear();
        }
    }
}
