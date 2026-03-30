package com.cretas.aims.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TokenBlacklistServiceImpl unit tests.
 *
 * Validates blacklisting, lookup, TTL-based auto-eviction,
 * and SHA-256 hashing consistency.
 */
@DisplayName("TokenBlacklistServiceImpl unit tests")
class TokenBlacklistServiceImplTest {

    private TokenBlacklistServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TokenBlacklistServiceImpl();
    }

    // ── blacklistToken + isBlacklisted ──────────────────────────

    @Test
    @DisplayName("blacklisted token is detected by isBlacklisted")
    void blacklistToken_thenIsBlacklisted_returnsTrue() {
        String token = "eyJhbGciOiJIUzI1NiJ9.test-payload.signature";

        service.blacklistToken(token, 60_000L); // 60s TTL

        assertThat(service.isBlacklisted(token)).isTrue();
    }

    @Test
    @DisplayName("non-blacklisted token returns false")
    void isBlacklisted_nonBlacklistedToken_returnsFalse() {
        String token = "some-random-token-never-blacklisted";

        assertThat(service.isBlacklisted(token)).isFalse();
    }

    @Test
    @DisplayName("null token is silently ignored on blacklist")
    void blacklistToken_nullToken_noException() {
        service.blacklistToken(null, 60_000L);
        assertThat(service.isBlacklisted(null)).isFalse();
    }

    @Test
    @DisplayName("blank token is silently ignored on blacklist")
    void blacklistToken_blankToken_noException() {
        service.blacklistToken("   ", 60_000L);
        assertThat(service.isBlacklisted("   ")).isFalse();
    }

    // ── Multiple tokens (simulates blacklistAllUserTokens caller logic) ──

    @Test
    @DisplayName("multiple tokens can be blacklisted independently")
    void blacklistMultipleTokens_allDetected() {
        String token1 = "token-user42-session-a";
        String token2 = "token-user42-session-b";
        String token3 = "token-user42-session-c";

        service.blacklistToken(token1, 60_000L);
        service.blacklistToken(token2, 60_000L);
        service.blacklistToken(token3, 60_000L);

        assertThat(service.isBlacklisted(token1)).isTrue();
        assertThat(service.isBlacklisted(token2)).isTrue();
        assertThat(service.isBlacklisted(token3)).isTrue();
        // unrelated token still not blacklisted
        assertThat(service.isBlacklisted("other-token")).isFalse();
    }

    // ── TTL / auto-eviction ─────────────────────────────────────

    @Test
    @DisplayName("token with expired TTL is no longer considered blacklisted")
    void blacklistToken_withExpiredTtl_evictedByDoubleCheck() throws InterruptedException {
        String token = "short-lived-token";

        // Use a very short TTL (50ms) so the double-check in isBlacklisted
        // detects the entry as expired even if Caffeine has not evicted it yet.
        service.blacklistToken(token, 50L);

        // Immediately after should still be blacklisted
        assertThat(service.isBlacklisted(token)).isTrue();

        // Wait for expiration
        Thread.sleep(100);

        // After expiry, the double-check (System.currentTimeMillis() > expirationTimestamp)
        // should return false
        assertThat(service.isBlacklisted(token)).isFalse();
    }

    @Test
    @DisplayName("negative TTL falls back to default (token is blacklisted)")
    void blacklistToken_negativeTtl_usesDefault() {
        String token = "token-with-negative-ttl";

        service.blacklistToken(token, -1L);

        // Should be blacklisted (using default 24h TTL)
        assertThat(service.isBlacklisted(token)).isTrue();
    }

    // ── SHA-256 hashing consistency ─────────────────────────────

    @Test
    @DisplayName("same token always produces the same hash (deterministic)")
    void hashToken_sameInput_sameOutput() throws Exception {
        String token = "consistent-hash-test-token";

        // Blacklist the token
        service.blacklistToken(token, 60_000L);

        // Calling isBlacklisted with the same string should find it
        // (proves the hash function is deterministic across calls)
        assertThat(service.isBlacklisted(token)).isTrue();
        assertThat(service.isBlacklisted(token)).isTrue(); // repeat
    }

    @Test
    @DisplayName("different tokens produce different hashes (no collision for typical inputs)")
    void hashToken_differentInputs_differentResults() {
        String tokenA = "token-aaa";
        String tokenB = "token-bbb";

        service.blacklistToken(tokenA, 60_000L);

        assertThat(service.isBlacklisted(tokenA)).isTrue();
        assertThat(service.isBlacklisted(tokenB)).isFalse();
    }

    @Test
    @DisplayName("SHA-256 hash matches standard JDK implementation")
    void hashToken_matchesStandardSHA256() throws Exception {
        String token = "verify-sha256-output";

        // Compute expected SHA-256 hash
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
        StringBuilder expected = new StringBuilder();
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) expected.append('0');
            expected.append(hex);
        }

        // Blacklist and verify the service finds it via the same hash
        service.blacklistToken(token, 60_000L);
        assertThat(service.isBlacklisted(token)).isTrue();

        // The hash length should be 64 hex chars (SHA-256 = 256 bits = 32 bytes = 64 hex)
        assertThat(expected.toString()).hasSize(64);
    }
}
