package com.cretas.edge;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Edge Gateway 应用测试
 */
@SpringBootTest
@ActiveProfiles("test")
class EdgeGatewayApplicationTests {

    @Test
    void contextLoads() {
        // 验证 Spring 上下文能够正常加载
    }
}
