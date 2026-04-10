package com.cretas.aims.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Strips a trailing '.' from request URIs under /api/ before routing.
 *
 * Clients occasionally send URLs like `/api/mobile/F001/sales-orders.` where a
 * leaked sentence period, a bad concat, or an IME glitch attaches a '.' to the
 * path. Spring 6 then routes these into the static resource handler and returns
 * NoResourceFoundException. This filter rewrites the URI so the controller
 * mapping matches. Scope is limited to /api/ so legitimate static resource 404s
 * are left alone.
 *
 * Runs right after CorrelationIdFilter so correlationId is already in MDC if
 * something later logs the rewrite.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TrailingDotPathFilter implements Filter {

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        String uri = request.getRequestURI();
        if (uri != null && uri.length() > 1 && uri.charAt(uri.length() - 1) == '.'
                && uri.startsWith("/api/")) {
            String normalized = uri.substring(0, uri.length() - 1);
            log.debug("TrailingDotPathFilter rewrote {} -> {}", uri, normalized);
            chain.doFilter(new NormalizedRequest(request, normalized), servletResponse);
            return;
        }
        chain.doFilter(request, servletResponse);
    }

    private static class NormalizedRequest extends HttpServletRequestWrapper {
        private final String normalizedUri;
        private final String normalizedServletPath;

        NormalizedRequest(HttpServletRequest delegate, String normalizedUri) {
            super(delegate);
            this.normalizedUri = normalizedUri;
            String sp = delegate.getServletPath();
            this.normalizedServletPath = (sp != null && !sp.isEmpty() && sp.charAt(sp.length() - 1) == '.')
                    ? sp.substring(0, sp.length() - 1)
                    : sp;
        }

        @Override
        public String getRequestURI() {
            return normalizedUri;
        }

        @Override
        public String getServletPath() {
            return normalizedServletPath;
        }

        @Override
        public StringBuffer getRequestURL() {
            StringBuffer url = super.getRequestURL();
            if (url != null && url.length() > 0 && url.charAt(url.length() - 1) == '.') {
                url.setLength(url.length() - 1);
            }
            return url;
        }
    }
}
