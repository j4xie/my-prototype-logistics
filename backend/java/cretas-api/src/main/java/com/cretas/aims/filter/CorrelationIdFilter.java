package com.cretas.aims.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * Correlation ID Filter
 *
 * Jakarta Servlet Filter that runs before all Spring interceptors.
 * Establishes a correlation ID for request tracing across Java and Python services.
 *
 * 1. Reads X-Correlation-ID from request header (propagated from upstream)
 * 2. If absent, generates a new UUID
 * 3. Puts correlationId, userId, and factoryId into SLF4J MDC
 * 4. Adds X-Correlation-ID to response header
 * 5. Clears MDC in finally block to prevent thread pool leaks
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter implements Filter {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    public static final String MDC_CORRELATION_ID = "correlationId";
    public static final String MDC_USER_ID = "userId";
    public static final String MDC_FACTORY_ID = "factoryId";

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        try {
            // 1. Read or generate correlation ID
            String correlationId = request.getHeader(CORRELATION_ID_HEADER);
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = UUID.randomUUID().toString();
            }

            // 2. Put correlation ID in MDC
            MDC.put(MDC_CORRELATION_ID, correlationId);

            // 3. Try to extract userId and factoryId from JWT (best-effort, no validation)
            extractJwtContextToMdc(request);

            // 4. Add correlation ID to response header
            response.setHeader(CORRELATION_ID_HEADER, correlationId);

            // 5. Continue the filter chain
            chain.doFilter(request, response);

        } finally {
            // 6. Always clear MDC to prevent thread pool contamination
            MDC.remove(MDC_CORRELATION_ID);
            MDC.remove(MDC_USER_ID);
            MDC.remove(MDC_FACTORY_ID);
        }
    }

    /**
     * Best-effort extraction of userId and factoryId from JWT payload.
     * Uses simple Base64 decode of the payload segment -- no signature verification
     * (the JwtAuthInterceptor handles that later). This avoids injecting JwtUtil
     * and keeps the filter dependency-free.
     *
     * If anything fails, we simply skip -- MDC fields remain empty which is fine.
     */
    private void extractJwtContextToMdc(HttpServletRequest request) {
        try {
            String authorization = request.getHeader("Authorization");
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                return;
            }

            String token = authorization.substring(7);
            // JWT structure: header.payload.signature
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return;
            }

            // Decode the payload (second segment)
            String payload = new String(
                    java.util.Base64.getUrlDecoder().decode(parts[1]),
                    java.nio.charset.StandardCharsets.UTF_8
            );

            // Simple extraction without a JSON library dependency -- look for key patterns
            String userId = extractJsonValue(payload, "userId");
            String factoryId = extractJsonValue(payload, "factoryId");

            if (userId != null) {
                MDC.put(MDC_USER_ID, userId);
            }
            if (factoryId != null) {
                MDC.put(MDC_FACTORY_ID, factoryId);
            }
        } catch (Exception e) {
            // Best-effort: if JWT parsing fails, just skip MDC enrichment
            log.trace("Could not extract JWT context for MDC: {}", e.getMessage());
        }
    }

    /**
     * Extract a value from a JSON string by key name.
     * Handles both string values ("key":"value") and numeric values ("key":123).
     * This avoids pulling in Jackson/Gson just for two fields.
     */
    private String extractJsonValue(String json, String key) {
        String pattern = "\"" + key + "\"";
        int keyIndex = json.indexOf(pattern);
        if (keyIndex < 0) {
            return null;
        }

        // Find the colon after the key
        int colonIndex = json.indexOf(':', keyIndex + pattern.length());
        if (colonIndex < 0) {
            return null;
        }

        // Skip whitespace after colon
        int valueStart = colonIndex + 1;
        while (valueStart < json.length() && json.charAt(valueStart) == ' ') {
            valueStart++;
        }

        if (valueStart >= json.length()) {
            return null;
        }

        if (json.charAt(valueStart) == '"') {
            // String value
            int valueEnd = json.indexOf('"', valueStart + 1);
            if (valueEnd < 0) {
                return null;
            }
            return json.substring(valueStart + 1, valueEnd);
        } else {
            // Numeric or other value -- read until comma, brace, or end
            int valueEnd = valueStart;
            while (valueEnd < json.length()
                    && json.charAt(valueEnd) != ','
                    && json.charAt(valueEnd) != '}'
                    && json.charAt(valueEnd) != ' ') {
                valueEnd++;
            }
            return json.substring(valueStart, valueEnd);
        }
    }
}
