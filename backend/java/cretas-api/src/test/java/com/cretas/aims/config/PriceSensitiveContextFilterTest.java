package com.cretas.aims.config;

import com.cretas.aims.security.PriceSensitiveContext;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for {@link PriceSensitiveContextFilter} — proves the
 * ThreadLocal cleanup contract holds across sync, exception, and
 * async-dispatch paths.
 *
 * <p>PR #443 follow-up F1 (audit doc Q1): the default
 * {@code OncePerRequestFilter.shouldNotFilterAsyncDispatch()} returns
 * {@code true}, meaning the filter would NOT run on async-dispatch
 * redispatches. If the controller advice sets the {@link
 * PriceSensitiveContext} ThreadLocal on the async-redispatch thread but
 * the filter's {@code finally} cleanup never fires there, the ThreadLocal
 * leaks onto the Tomcat worker pool — a next sync request on that pooled
 * thread would unintentionally strip prices for an admin user. These
 * tests pin the cleanup behavior.
 *
 * @author Cretas Team
 * @since 2026-05-12 (PR #443 follow-up F1)
 */
@DisplayName("PriceSensitiveContextFilter — ThreadLocal cleanup contract (F1)")
class PriceSensitiveContextFilterTest {

    private PriceSensitiveContextFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setup() {
        filter = new PriceSensitiveContextFilter();
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        // Defensive: clear any leak from earlier tests.
        PriceSensitiveContext.clear();
    }

    @AfterEach
    void teardown() {
        PriceSensitiveContext.clear();
    }

    @Test
    @DisplayName("sync happy path: filter clears ThreadLocal after chain completes")
    void sync_happyPath_clearsThreadLocal() throws Exception {
        // Simulate controller advice setting hide flag during chain
        FilterChain chain = (req, res) -> PriceSensitiveContext.hide();

        // Precondition
        assertFalse(PriceSensitiveContext.shouldHide("any"), "clean before");

        filter.doFilter(request, response, chain);

        // Filter's finally must clear regardless of what happened in the chain.
        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "ThreadLocal cleared after filter chain ran");
    }

    @Test
    @DisplayName("sync exception path: filter clears ThreadLocal even when chain throws")
    void sync_chainThrows_stillClears() throws Exception {
        FilterChain chain = (req, res) -> {
            // First imitate the advice setting hide, then blow up
            PriceSensitiveContext.hide();
            throw new ServletException("simulated downstream failure");
        };

        ServletException ex = assertThrows(ServletException.class,
                () -> filter.doFilter(request, response, chain));
        assertEquals("simulated downstream failure", ex.getMessage());

        // The exception propagates out — but finally must have cleared.
        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "ThreadLocal cleared even when chain throws (finally contract)");
    }

    @Test
    @DisplayName("sync runtime-exception path: filter clears ThreadLocal even on RuntimeException")
    void sync_chainThrowsRuntime_stillClears() throws Exception {
        FilterChain chain = (req, res) -> {
            PriceSensitiveContext.hide();
            throw new RuntimeException("boom");
        };

        assertThrows(RuntimeException.class,
                () -> filter.doFilter(request, response, chain));
        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "ThreadLocal cleared even on RuntimeException");
    }

    @Test
    @DisplayName("F1: shouldNotFilterAsyncDispatch() returns false — filter MUST run on async dispatch")
    void f1_overrideAllowsAsyncDispatch() {
        // OncePerRequestFilter defaults this to true. Our override must flip
        // it to false so the finally{} cleanup runs after async redispatch.
        assertFalse(filter.shouldNotFilterAsyncDispatch(),
                "F1 fix: filter must run on async dispatch to clean up ThreadLocal "
                        + "after the async response is written on a pooled worker thread");
    }

    @Test
    @DisplayName("F1 regression: filter clears ThreadLocal on simulated async-dispatch redispatch")
    void f1_asyncDispatch_clearsThreadLocal() throws Exception {
        // Simulate Tomcat redispatching the response on a new dispatcher type.
        // The sync pass already ran and removed the OncePerRequestFilter's
        // ".FILTERED" sentinel in its own finally{}, so on the async pass the
        // sentinel is NOT set. With our shouldNotFilterAsyncDispatch=false
        // override, skipDispatch() returns false → OncePerRequestFilter goes
        // through doFilterInternal, which wraps the chain in try/finally and
        // clears the ThreadLocal afterwards. With the default override (=true),
        // skipDispatch would return true and the chain runs without our
        // wrapping → ThreadLocal leak onto the pooled thread.
        request.setDispatcherType(DispatcherType.ASYNC);

        FilterChain chain = (req, res) -> {
            // Imitate PriceFieldResponseAdvice setting hide on the redispatch thread
            PriceSensitiveContext.hide();
        };

        filter.doFilter(request, response, chain);

        // Critical: filter's finally{} cleared the leak.
        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "ThreadLocal cleared even on ASYNC dispatch redispatch (F1 fix)");
    }

    @Test
    @DisplayName("Filter clears ThreadLocal even when chain never sets it (idempotent)")
    void noHideSet_clearIsHarmless() throws Exception {
        FilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "clear is idempotent — safe even if nothing ever set the flag");
    }

    @Test
    @DisplayName("Filter cleanup runs after the chain returns (timing — flag visible during chain)")
    void hideFlagVisibleDuringChain_clearedAfter() throws Exception {
        final boolean[] flagWasSetDuringChain = {false};
        FilterChain chain = (req, res) -> {
            PriceSensitiveContext.hide();
            // Within the chain, the flag should be observable (advice→Jackson rely on this).
            flagWasSetDuringChain[0] = PriceSensitiveContext.shouldHide("any");
        };

        filter.doFilter(request, response, chain);

        assertTrue(flagWasSetDuringChain[0],
                "Flag is visible WITHIN the chain (Jackson modifier reads it during serialization)");
        assertFalse(PriceSensitiveContext.shouldHide("any"),
                "Flag cleared AFTER the chain returns (pool-pollution prevention)");
    }
}
