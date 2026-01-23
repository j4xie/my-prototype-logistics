package com.cretas.aims.client.dahua;

import lombok.extern.slf4j.Slf4j;
import okhttp3.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 大华设备 Digest 认证拦截器 (RFC 2617)
 *
 * 大华设备使用 HTTP Digest 认证:
 * - 算法: MD5
 * - QOP: auth
 * - nonce 超时: 认证请求3秒, 非认证请求30秒
 *
 * 认证流程:
 * 1. 客户端发送请求 (无认证头)
 * 2. 服务器返回 401 + WWW-Authenticate 头
 * 3. 客户端计算 response 并重新发送请求
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Slf4j
public class DahuaDigestAuthenticator implements Interceptor {

    private final String username;
    private final String password;
    private final AtomicInteger nonceCount = new AtomicInteger(0);
    private final SecureRandom random = new SecureRandom();

    // 缓存上次的认证参数
    private volatile String cachedNonce;
    private volatile String cachedRealm;
    private volatile String cachedOpaque;
    private volatile long nonceTimestamp;

    // nonce 缓存时间 (秒)
    private static final int NONCE_CACHE_SECONDS = 25;

    public DahuaDigestAuthenticator(String username, String password) {
        this.username = username;
        this.password = password;
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request originalRequest = chain.request();

        // 如果有缓存的 nonce 且未过期，直接使用
        if (cachedNonce != null && !isNonceExpired()) {
            Request authenticatedRequest = buildAuthenticatedRequest(originalRequest,
                    cachedRealm, cachedNonce, cachedOpaque);
            return chain.proceed(authenticatedRequest);
        }

        // 发送原始请求
        Response response = chain.proceed(originalRequest);

        // 如果不是 401，直接返回
        if (response.code() != 401) {
            return response;
        }

        // 解析 WWW-Authenticate 头
        String authHeader = response.header("WWW-Authenticate");
        if (authHeader == null || !authHeader.toLowerCase().startsWith("digest")) {
            log.warn("大华设备未返回 Digest 认证挑战");
            return response;
        }

        // 关闭原始响应
        response.close();

        // 解析认证参数
        Map<String, String> authParams = parseAuthHeader(authHeader);
        String realm = authParams.get("realm");
        String nonce = authParams.get("nonce");
        String opaque = authParams.get("opaque");
        String qop = authParams.get("qop");

        if (nonce == null || realm == null) {
            log.error("认证头缺少必要参数: nonce={}, realm={}", nonce, realm);
            return response;
        }

        // 缓存认证参数
        this.cachedNonce = nonce;
        this.cachedRealm = realm;
        this.cachedOpaque = opaque;
        this.nonceTimestamp = System.currentTimeMillis();
        this.nonceCount.set(0);

        // 构建认证请求
        Request authenticatedRequest = buildAuthenticatedRequest(originalRequest, realm, nonce, opaque);

        log.debug("发送 Digest 认证请求: {} {}", originalRequest.method(), originalRequest.url());
        return chain.proceed(authenticatedRequest);
    }

    /**
     * 构建带认证头的请求
     */
    private Request buildAuthenticatedRequest(Request original, String realm, String nonce, String opaque) {
        String method = original.method();
        String uri = original.url().encodedPath();
        if (original.url().encodedQuery() != null) {
            uri += "?" + original.url().encodedQuery();
        }

        // 生成 cnonce
        String cnonce = generateCnonce();

        // 递增 nc
        int nc = nonceCount.incrementAndGet();
        String ncStr = String.format("%08x", nc);

        // 计算 response
        String response = calculateResponse(method, uri, realm, nonce, ncStr, cnonce);

        // 构建 Authorization 头
        StringBuilder authBuilder = new StringBuilder("Digest ");
        authBuilder.append("username=\"").append(username).append("\", ");
        authBuilder.append("realm=\"").append(realm).append("\", ");
        authBuilder.append("nonce=\"").append(nonce).append("\", ");
        authBuilder.append("uri=\"").append(uri).append("\", ");
        authBuilder.append("qop=auth, ");
        authBuilder.append("nc=").append(ncStr).append(", ");
        authBuilder.append("cnonce=\"").append(cnonce).append("\", ");
        authBuilder.append("response=\"").append(response).append("\"");

        if (opaque != null) {
            authBuilder.append(", opaque=\"").append(opaque).append("\"");
        }

        return original.newBuilder()
                .header("Authorization", authBuilder.toString())
                .build();
    }

    /**
     * 计算 Digest response
     *
     * response = MD5(MD5(A1):nonce:nc:cnonce:qop:MD5(A2))
     * A1 = username:realm:password
     * A2 = request-method:uri
     */
    private String calculateResponse(String method, String uri, String realm,
                                     String nonce, String nc, String cnonce) {
        // A1 = username:realm:password
        String a1 = username + ":" + realm + ":" + password;
        String ha1 = md5Hex(a1);

        // A2 = method:uri
        String a2 = method + ":" + uri;
        String ha2 = md5Hex(a2);

        // response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
        String responseStr = ha1 + ":" + nonce + ":" + nc + ":" + cnonce + ":auth:" + ha2;
        return md5Hex(responseStr);
    }

    /**
     * 计算 MD5 并返回十六进制字符串
     */
    private String md5Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 算法不可用", e);
        }
    }

    /**
     * 字节数组转十六进制字符串
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * 生成随机 cnonce
     */
    private String generateCnonce() {
        byte[] bytes = new byte[8];
        random.nextBytes(bytes);
        return bytesToHex(bytes);
    }

    /**
     * 解析 WWW-Authenticate 头
     */
    private Map<String, String> parseAuthHeader(String header) {
        Map<String, String> params = new HashMap<>();

        // 移除 "Digest " 前缀
        String content = header.substring(7).trim();

        // 解析 key="value" 或 key=value 格式
        int i = 0;
        while (i < content.length()) {
            // 跳过空白和逗号
            while (i < content.length() && (content.charAt(i) == ' ' || content.charAt(i) == ',')) {
                i++;
            }
            if (i >= content.length()) break;

            // 读取 key
            int keyStart = i;
            while (i < content.length() && content.charAt(i) != '=') {
                i++;
            }
            if (i >= content.length()) break;
            String key = content.substring(keyStart, i).trim().toLowerCase();
            i++; // 跳过 '='

            // 读取 value
            String value;
            if (i < content.length() && content.charAt(i) == '"') {
                // 带引号的值
                i++; // 跳过开始引号
                int valueStart = i;
                while (i < content.length() && content.charAt(i) != '"') {
                    i++;
                }
                value = content.substring(valueStart, i);
                if (i < content.length()) i++; // 跳过结束引号
            } else {
                // 不带引号的值
                int valueStart = i;
                while (i < content.length() && content.charAt(i) != ',' && content.charAt(i) != ' ') {
                    i++;
                }
                value = content.substring(valueStart, i);
            }

            params.put(key, value);
        }

        return params;
    }

    /**
     * 检查 nonce 是否过期
     */
    private boolean isNonceExpired() {
        long elapsed = (System.currentTimeMillis() - nonceTimestamp) / 1000;
        return elapsed > NONCE_CACHE_SECONDS;
    }

    /**
     * 清除缓存的认证信息
     */
    public void clearCache() {
        this.cachedNonce = null;
        this.cachedRealm = null;
        this.cachedOpaque = null;
        this.nonceCount.set(0);
    }
}
