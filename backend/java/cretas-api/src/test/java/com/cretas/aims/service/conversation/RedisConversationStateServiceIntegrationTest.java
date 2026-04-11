package com.cretas.aims.service.conversation;

import com.cretas.aims.entity.conversation.ConversationTurn;
import com.cretas.aims.service.conversation.impl.RedisConversationStateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testcontainers-based integration test for RedisConversationStateService.
 *
 * <p>@Disabled by default — requires Docker for the redis:7-alpine container.
 * Run manually in CI where Docker is available:
 * <pre>
 * ./mvnw.cmd test -Dtest=RedisConversationStateServiceIntegrationTest
 * </pre>
 *
 * <p>Local test coverage for logic is provided by
 * {@link RedisConversationStateServiceMockTest} (Mockito-based, no Docker).
 */
@Disabled("Requires Docker for Testcontainers. Run in CI: "
        + "./mvnw.cmd test -Dtest=RedisConversationStateServiceIntegrationTest")
class RedisConversationStateServiceIntegrationTest {

    private RedisConversationStateService service;

    @BeforeEach
    void setup() {
        // Would normally set up via Testcontainers:
        //   GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
        //       .withExposedPorts(6379);
        //   redis.start();
        //   var config = new RedisStandaloneConfiguration(redis.getHost(),
        //       redis.getMappedPort(6379));
        //   var factory = new JedisConnectionFactory(config);
        //   factory.afterPropertiesSet();
        //   var template = new StringRedisTemplate(factory);
        //   template.afterPropertiesSet();
        //   service = new RedisConversationStateService(
        //       template, new ObjectMapper(), Duration.ofMinutes(30), 10);
        //
        // Left commented out so this file compiles without adding testcontainers
        // dep to pom.xml. Enable by adding:
        //   <dependency>
        //     <groupId>org.testcontainers</groupId>
        //     <artifactId>junit-jupiter</artifactId>
        //     <version>1.19.8</version>
        //     <scope>test</scope>
        //   </dependency>
        // and uncommenting the setup above.
        throw new UnsupportedOperationException(
                "Add testcontainers dep + uncomment setup() to enable this test");
    }

    @Test
    void append_and_load_single_turn() {
        ConversationTurn turn = new ConversationTurn(
                "帮我看成本刚性",
                "RESTAURANT_COST_RIGIDITY",
                "restaurant_cost_rigidity_analysis",
                null,
                Map.of("costRigidity", 0.561),
                System.currentTimeMillis()
        );
        service.appendTurn("F001", "U100", turn);

        List<ConversationTurn> loaded = service.loadRecent("F001", "U100", 5);
        assertThat(loaded).hasSize(1);
        assertThat(loaded.get(0).userMessage()).isEqualTo("帮我看成本刚性");
    }

    @Test
    void load_recent_returns_most_recent_first() {
        for (int i = 0; i < 5; i++) {
            service.appendTurn("F001", "U100",
                    ConversationTurn.userOnly("turn " + i));
        }
        List<ConversationTurn> recent = service.loadRecent("F001", "U100", 3);
        assertThat(recent).hasSize(3);
        assertThat(recent.get(0).userMessage()).isEqualTo("turn 4");
        assertThat(recent.get(2).userMessage()).isEqualTo("turn 2");
    }

    @Test
    void list_capped_at_max_turns() {
        for (int i = 0; i < 20; i++) {
            service.appendTurn("F001", "U100",
                    ConversationTurn.userOnly("turn " + i));
        }
        assertThat(service.turnCount("F001", "U100")).isEqualTo(10);
    }

    @Test
    void clear_removes_all_turns() {
        service.appendTurn("F001", "U100", ConversationTurn.userOnly("hi"));
        service.clear("F001", "U100");
        assertThat(service.loadRecent("F001", "U100", 5)).isEmpty();
    }

    @Test
    void different_users_isolated() {
        service.appendTurn("F001", "U100", ConversationTurn.userOnly("user A"));
        service.appendTurn("F001", "U200", ConversationTurn.userOnly("user B"));
        assertThat(service.loadRecent("F001", "U100", 5)).hasSize(1);
        assertThat(service.loadRecent("F001", "U200", 5)).hasSize(1);
    }
}
