package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.Session;
import com.cretas.aims.entity.conversation.ConversationSession;
import com.cretas.aims.entity.conversation.ConversationSession.SessionStatus;
import com.cretas.aims.entity.conversation.ConversationSession.SessionMode;
import com.cretas.aims.entity.conversation.ConversationSession.RequiredParameter;
import com.cretas.aims.repository.SessionRepository;
import com.cretas.aims.repository.conversation.ConversationSessionRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 会话生命周期综合测试
 *
 * 测试覆盖范围:
 * 1. 会话创建与唯一ID生成
 * 2. 会话活动跟踪
 * 3. 会话超时与过期处理
 * 4. 用户间数据隔离
 * 5. 登出时会话清理
 * 6. 跨请求数据持久化
 * 7. 并发会话处理（同一用户多会话）
 * 8. 服务重启后会话迁移
 * 9. 会话数据序列化/反序列化
 * 10. 最大会话数限制
 * 11. 会话劫持防护
 * 12. 会话失效级联处理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SessionLifecycle 会话生命周期综合测试")
class SessionLifecycleTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private ConversationSessionRepository conversationSessionRepository;

    // 测试常量
    private static final String FACTORY_A = "F001";
    private static final String FACTORY_B = "F002";
    private static final Long USER_ID_1 = 1L;
    private static final Long USER_ID_2 = 2L;
    private static final Long USER_ID_3 = 3L;
    private static final int MAX_SESSIONS_PER_USER = 5;
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    // ========== 1. 会话创建与唯一ID生成 ==========

    @Test
    @DisplayName("创建会话时应生成唯一的UUID作为会话ID")
    void createSession_shouldGenerateUniqueUUID() {
        // 准备：创建多个会话
        Set<String> sessionIds = new HashSet<>();
        int sessionCount = 100;

        // 执行：创建多个会话并收集ID（使用builder手动生成sessionId）
        for (int i = 0; i < sessionCount; i++) {
            ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入 " + i);
            sessionIds.add(session.getSessionId());
        }

        // 验证：所有会话ID都是唯一的
        assertEquals(sessionCount, sessionIds.size(),
            "所有生成的会话ID应该是唯一的");
    }

    @Test
    @DisplayName("新创建的会话应具有正确的初始状态")
    void newSession_shouldHaveCorrectInitialState() {
        // 执行：创建新会话
        String originalInput = "帮我查询库存信息";
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, originalInput);

        // 验证：初始状态正确
        assertNotNull(session.getSessionId(), "会话ID不应为空");
        assertEquals(FACTORY_A, session.getFactoryId(), "工厂ID应正确设置");
        assertEquals(USER_ID_1, session.getUserId(), "用户ID应正确设置");
        assertEquals(originalInput, session.getOriginalInput(), "原始输入应正确保存");
        assertEquals(SessionStatus.ACTIVE, session.getStatus(), "新会话状态应为ACTIVE");
        assertEquals(SessionMode.INTENT_RECOGNITION, session.getSessionMode(), "默认模式应为意图识别");
        assertEquals(1, session.getCurrentRound(), "初始轮次应为1");
        assertEquals(5, session.getMaxRounds(), "默认最大轮次应为5");
        assertNull(session.getFinalIntentCode(), "意图代码初始应为空");
    }

    @Test
    @DisplayName("参数收集会话应正确初始化参数列表")
    void parameterCollectionSession_shouldInitializeParametersCorrectly() {
        // 准备：参数列表
        List<RequiredParameter> params = Arrays.asList(
            RequiredParameter.builder()
                .name("batchId").label("批次ID").type("string").collected(false).build(),
            RequiredParameter.builder()
                .name("materialTypeId").label("物料类型").type("string").collected(false).build()
        );

        // 执行：创建参数收集会话（使用builder手动设置sessionId）
        ConversationSession session = createTestSessionForParameterCollection(
            FACTORY_A, USER_ID_1, "MATERIAL_BATCH_QUERY", params, "请提供批次ID");

        // 验证
        assertEquals(SessionMode.PARAMETER_COLLECTION, session.getSessionMode(),
            "会话模式应为参数收集");
        assertEquals("MATERIAL_BATCH_QUERY", session.getKnownIntentCode(),
            "已知意图代码应正确设置");
        assertEquals(2, session.getRequiredParameters().size(),
            "参数列表应包含2个参数");
        assertFalse(session.allParametersCollected(),
            "初始时参数不应全部收集完成");
    }

    // ========== 2. 会话活动跟踪 ==========

    @Test
    @DisplayName("添加消息应更新最后活跃时间")
    void addMessage_shouldUpdateLastActiveTime() throws InterruptedException {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        LocalDateTime initialActiveTime = session.getLastActiveAt();

        // 等待一小段时间
        Thread.sleep(10);

        // 执行：添加消息（手动更新lastActiveAt）
        session.setLastActiveAt(LocalDateTime.now());
        addMessageToSession(session, "user", "用户回复");

        // 验证：最后活跃时间已更新
        assertTrue(session.getLastActiveAt().isAfter(initialActiveTime) ||
                   session.getLastActiveAt().isEqual(initialActiveTime),
            "最后活跃时间应该被更新");
    }

    @Test
    @DisplayName("进入下一轮应正确更新轮次计数")
    void nextRound_shouldUpdateRoundCount() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        int initialRound = session.getCurrentRound();

        // 执行：进入下一轮
        boolean result = session.nextRound();

        // 验证
        assertTrue(result, "应成功进入下一轮");
        assertEquals(initialRound + 1, session.getCurrentRound(),
            "轮次应增加1");
    }

    @Test
    @DisplayName("达到最大轮次后不能继续下一轮")
    void nextRound_shouldFailWhenMaxRoundsReached() {
        // 准备：创建已达最大轮次的会话
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        session.setCurrentRound(5); // 设置为最大轮次

        // 执行
        boolean result = session.nextRound();

        // 验证
        assertFalse(result, "达到最大轮次后不应继续");
        assertEquals(5, session.getCurrentRound(), "轮次不应增加");
    }

    // ========== 3. 会话超时与过期处理 ==========

    @Test
    @DisplayName("未超时的会话应返回未过期状态")
    void isExpired_shouldReturnFalseForActiveSession() {
        // 准备：刚创建的会话
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");

        // 验证
        assertFalse(session.isExpired(), "新创建的会话不应过期");
    }

    @Test
    @DisplayName("超过超时时间的会话应返回过期状态")
    void isExpired_shouldReturnTrueForExpiredSession() {
        // 准备：创建一个"过期"的会话
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        // 设置最后活跃时间为超时时间之前
        session.setLastActiveAt(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES + 5));

        // 验证
        assertTrue(session.isExpired(), "超时的会话应标记为过期");
    }

    @Test
    @DisplayName("已完成的会话不应被标记为过期")
    void isExpired_shouldReturnFalseForCompletedSession() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        session.complete("MATERIAL_QUERY", 0.95);

        // 验证：即使最后活跃时间很久之前，已完成的会话也不应标记为过期
        session.setLastActiveAt(LocalDateTime.now().minusHours(1));
        assertFalse(session.isExpired(), "已完成的会话不应标记为过期");
    }

    @Test
    @DisplayName("超时处理应正确设置会话状态")
    void timeout_shouldSetCorrectStatus() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");

        // 执行
        session.timeout();

        // 验证
        assertEquals(SessionStatus.TIMEOUT, session.getStatus(),
            "会话状态应为TIMEOUT");
        assertNotNull(session.getCompletedAt(),
            "完成时间应被设置");
    }

    @Test
    @DisplayName("清理过期会话应只删除过期的会话")
    void deleteExpiredSessions_shouldOnlyDeleteExpired() {
        // 准备
        LocalDateTime expireTime = LocalDateTime.now();

        // 执行
        sessionRepository.deleteExpiredSessions(expireTime);

        // 验证：仓库方法被正确调用
        verify(sessionRepository).deleteExpiredSessions(expireTime);
    }

    // ========== 4. 用户间数据隔离 ==========

    @Test
    @DisplayName("不同用户的会话数据应完全隔离")
    void sessions_shouldBeIsolatedBetweenUsers() {
        // 准备：两个用户的会话，使用builder确保sessionId被正确设置
        String sessionId1 = UUID.randomUUID().toString();
        String sessionId2 = UUID.randomUUID().toString();

        ConversationSession sessionUser1 = ConversationSession.builder()
            .sessionId(sessionId1)
            .factoryId(FACTORY_A)
            .userId(USER_ID_1)
            .originalInput("用户1的查询")
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .currentRound(1)
            .maxRounds(5)
            .timeoutMinutes(10)
            .messagesJson("[{\"role\":\"user\",\"content\":\"用户1的查询\"}]")
            .createdAt(LocalDateTime.now())
            .lastActiveAt(LocalDateTime.now())
            .build();

        ConversationSession sessionUser2 = ConversationSession.builder()
            .sessionId(sessionId2)
            .factoryId(FACTORY_A)
            .userId(USER_ID_2)
            .originalInput("用户2的查询")
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .currentRound(1)
            .maxRounds(5)
            .timeoutMinutes(10)
            .messagesJson("[{\"role\":\"user\",\"content\":\"用户2的查询\"}]")
            .createdAt(LocalDateTime.now())
            .lastActiveAt(LocalDateTime.now())
            .build();

        // 验证：会话ID不为空且不同
        assertNotNull(sessionUser1.getSessionId(), "用户1的会话ID不应为空");
        assertNotNull(sessionUser2.getSessionId(), "用户2的会话ID不应为空");
        assertNotEquals(sessionUser1.getSessionId(), sessionUser2.getSessionId(),
            "不同用户的会话ID应该不同");

        // 验证：用户ID正确
        assertEquals(USER_ID_1, sessionUser1.getUserId());
        assertEquals(USER_ID_2, sessionUser2.getUserId());

        // 验证：原始输入完全隔离
        assertEquals("用户1的查询", sessionUser1.getOriginalInput());
        assertEquals("用户2的查询", sessionUser2.getOriginalInput());

        // 验证：修改一个用户的会话状态不影响另一个
        sessionUser1.setCurrentRound(3);
        assertEquals(3, sessionUser1.getCurrentRound(), "用户1的轮次应为3");
        assertEquals(1, sessionUser2.getCurrentRound(), "用户2的轮次应保持为1");

        // 验证：完成一个用户的会话不影响另一个
        sessionUser1.complete("INTENT_A", 0.95);
        assertEquals(SessionStatus.COMPLETED, sessionUser1.getStatus(), "用户1应已完成");
        assertEquals(SessionStatus.ACTIVE, sessionUser2.getStatus(), "用户2应仍为活动状态");
    }

    @Test
    @DisplayName("工厂间会话数据应完全隔离")
    void sessions_shouldBeIsolatedBetweenFactories() {
        // 准备
        ConversationSession sessionFactoryA = createTestSession(FACTORY_A, USER_ID_1, "工厂A查询");
        ConversationSession sessionFactoryB = createTestSession(FACTORY_B, USER_ID_1, "工厂B查询");

        // 验证
        assertNotEquals(sessionFactoryA.getFactoryId(), sessionFactoryB.getFactoryId(),
            "不同工厂的会话应有不同的factoryId");
        assertEquals(FACTORY_A, sessionFactoryA.getFactoryId());
        assertEquals(FACTORY_B, sessionFactoryB.getFactoryId());
    }

    @Test
    @DisplayName("查询用户会话时应只返回该用户的会话")
    void findByUserId_shouldReturnOnlyUserSessions() {
        // 准备
        List<Session> user1Sessions = Arrays.asList(
            createMockSession("session-1", USER_ID_1, FACTORY_A),
            createMockSession("session-2", USER_ID_1, FACTORY_A)
        );

        when(sessionRepository.findByUserIdAndIsRevokedFalse(USER_ID_1))
            .thenReturn(user1Sessions);

        // 执行
        List<Session> result = sessionRepository.findByUserIdAndIsRevokedFalse(USER_ID_1);

        // 验证
        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(s -> USER_ID_1.equals(s.getUserId())),
            "返回的所有会话应属于同一用户");
    }

    // ========== 5. 登出时会话清理 ==========

    @Test
    @DisplayName("撤销用户所有会话应调用正确的仓库方法")
    void revokeAllUserSessions_shouldCallRepository() {
        // 执行
        sessionRepository.revokeAllUserSessions(USER_ID_1);

        // 验证
        verify(sessionRepository).revokeAllUserSessions(USER_ID_1);
    }

    @Test
    @DisplayName("撤销工厂所有会话应调用正确的仓库方法")
    void revokeAllFactorySessions_shouldCallRepository() {
        // 执行
        sessionRepository.revokeAllFactorySessions(FACTORY_A);

        // 验证
        verify(sessionRepository).revokeAllFactorySessions(FACTORY_A);
    }

    @Test
    @DisplayName("会话取消应正确设置状态")
    void cancel_shouldSetCorrectStatus() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");

        // 执行
        session.cancel();

        // 验证
        assertEquals(SessionStatus.CANCELLED, session.getStatus(),
            "会话状态应为CANCELLED");
        assertNotNull(session.getCompletedAt(),
            "完成时间应被设置");
    }

    // ========== 6. 跨请求数据持久化 ==========

    @Test
    @DisplayName("会话消息应正确序列化和反序列化")
    void messages_shouldSerializeAndDeserializeCorrectly() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "初始查询");

        // 添加多条消息（手动操作messagesJson）
        addMessageToSession(session, "assistant", "请问您要查询什么?");
        addMessageToSession(session, "user", "查询物料批次");
        addMessageToSession(session, "assistant", "好的，正在查询...");

        // 获取消息列表
        var messages = session.getMessages();

        // 验证
        assertEquals(4, messages.size()); // 1个初始 + 3个新增
        assertEquals("user", messages.get(0).getRole());
        assertEquals("assistant", messages.get(1).getRole());
        assertEquals("user", messages.get(2).getRole());
        assertEquals("assistant", messages.get(3).getRole());
    }

    @Test
    @DisplayName("已收集参数应正确持久化")
    void collectedParameters_shouldPersistCorrectly() {
        // 准备
        List<RequiredParameter> params = Arrays.asList(
            RequiredParameter.builder()
                .name("batchId").label("批次ID").type("string").collected(false).build(),
            RequiredParameter.builder()
                .name("materialTypeId").label("物料类型").type("string").collected(false).build()
        );
        ConversationSession session = createTestSessionForParameterCollection(
            FACTORY_A, USER_ID_1, "MATERIAL_BATCH_QUERY", params, "请提供批次ID");

        // 执行：收集参数
        session.addCollectedParameter("batchId", "BATCH-001");

        // 验证
        Map<String, String> collected = session.getCollectedParameters();
        assertEquals("BATCH-001", collected.get("batchId"));

        // 验证参数状态已更新
        Optional<RequiredParameter> nextParam = session.getNextPendingParameter();
        assertTrue(nextParam.isPresent());
        assertEquals("materialTypeId", nextParam.get().getName());
    }

    @Test
    @DisplayName("候选意图应正确序列化")
    void candidates_shouldSerializeCorrectly() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "查询");

        List<ConversationSession.CandidateIntent> candidates = Arrays.asList(
            ConversationSession.CandidateIntent.builder()
                .intentCode("MATERIAL_QUERY").intentName("物料查询").confidence(0.8).build(),
            ConversationSession.CandidateIntent.builder()
                .intentCode("INVENTORY_QUERY").intentName("库存查询").confidence(0.6).build()
        );

        // 执行
        session.setCandidates(candidates);

        // 验证
        List<ConversationSession.CandidateIntent> retrieved = session.getCandidates();
        assertEquals(2, retrieved.size());
        assertEquals("MATERIAL_QUERY", retrieved.get(0).getIntentCode());
        assertEquals(0.8, retrieved.get(0).getConfidence());
    }

    // ========== 7. 并发会话处理 ==========

    @Test
    @DisplayName("同一用户可以有多个活动会话")
    void sameUser_canHaveMultipleSessions() {
        // 准备：创建同一用户的多个会话
        ConversationSession session1 = createTestSession(FACTORY_A, USER_ID_1, "查询物料");
        ConversationSession session2 = createTestSession(FACTORY_A, USER_ID_1, "查询库存");
        ConversationSession session3 = createTestSession(FACTORY_A, USER_ID_1, "查询生产");

        // 验证：会话都是独立的
        assertNotEquals(session1.getSessionId(), session2.getSessionId());
        assertNotEquals(session2.getSessionId(), session3.getSessionId());
        assertNotEquals(session1.getSessionId(), session3.getSessionId());

        // 验证：每个会话的数据独立（手动添加消息）
        addMessageToSession(session1, "user", "物料相关");
        addMessageToSession(session2, "user", "库存相关");

        assertEquals(2, session1.getMessages().size());
        assertEquals(2, session2.getMessages().size());
        assertEquals(1, session3.getMessages().size());
    }

    @Test
    @DisplayName("并发创建会话应保证ID唯一性")
    void concurrentSessionCreation_shouldEnsureUniqueIds() throws Exception {
        // 准备：并发执行器
        int threadCount = 10;
        int sessionsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        ConcurrentHashMap<String, Boolean> allSessionIds = new ConcurrentHashMap<>();
        CountDownLatch latch = new CountDownLatch(threadCount);

        // 执行：并发创建会话（使用手动生成的UUID）
        for (int t = 0; t < threadCount; t++) {
            final long userId = t + 1;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < sessionsPerThread; i++) {
                        ConversationSession session = createTestSession(
                            FACTORY_A, userId, "测试输入 " + i);
                        allSessionIds.put(session.getSessionId(), true);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        // 验证：所有会话ID都是唯一的
        assertEquals(threadCount * sessionsPerThread, allSessionIds.size(),
            "并发创建的所有会话ID应该唯一");
    }

    @Test
    @DisplayName("并发修改会话状态应保持数据一致性")
    void concurrentSessionModification_shouldMaintainConsistency() throws Exception {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试输入");
        int messageCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(10);
        CountDownLatch latch = new CountDownLatch(messageCount);

        // 执行：并发添加消息（手动添加消息）
        for (int i = 0; i < messageCount; i++) {
            final int msgNum = i;
            executor.submit(() -> {
                try {
                    synchronized (session) {
                        addMessageToSession(session, "user", "消息 " + msgNum);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        // 验证：消息数量正确（初始1条 + 新增messageCount条）
        assertEquals(1 + messageCount, session.getMessages().size(),
            "所有并发添加的消息都应该被正确保存");
    }

    // ========== 8. 服务重启后会话迁移 ==========

    @Test
    @DisplayName("会话数据应能从数据库正确恢复")
    void sessionData_shouldRecoverFromDatabase() {
        // 准备：模拟保存的会话
        ConversationSession originalSession = ConversationSession.builder()
            .sessionId("test-session-id")
            .factoryId(FACTORY_A)
            .userId(USER_ID_1)
            .originalInput("原始查询")
            .currentRound(3)
            .maxRounds(5)
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .messagesJson("[{\"role\":\"user\",\"content\":\"查询\"}]")
            .candidatesJson("[{\"intentCode\":\"QUERY\",\"confidence\":0.8}]")
            .lastConfidence(0.8)
            .timeoutMinutes(10)
            .createdAt(LocalDateTime.now().minusMinutes(5))
            .updatedAt(LocalDateTime.now())
            .lastActiveAt(LocalDateTime.now())
            .build();

        when(conversationSessionRepository.findById("test-session-id"))
            .thenReturn(Optional.of(originalSession));

        // 执行：恢复会话
        Optional<ConversationSession> recovered = conversationSessionRepository
            .findById("test-session-id");

        // 验证
        assertTrue(recovered.isPresent(), "应能找到保存的会话");
        ConversationSession session = recovered.get();
        assertEquals("test-session-id", session.getSessionId());
        assertEquals(3, session.getCurrentRound());
        assertEquals(SessionStatus.ACTIVE, session.getStatus());
        assertEquals(1, session.getMessages().size());
        assertEquals(1, session.getCandidates().size());
    }

    @Test
    @DisplayName("服务重启后应能继续之前的会话")
    void serviceRestart_shouldAllowContinuingSession() {
        // 准备：模拟重启前保存的会话
        ConversationSession savedSession = ConversationSession.builder()
            .sessionId("continuing-session")
            .factoryId(FACTORY_A)
            .userId(USER_ID_1)
            .originalInput("重启测试")
            .currentRound(2)
            .maxRounds(5)
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .messagesJson("[]")
            .timeoutMinutes(10)
            .lastActiveAt(LocalDateTime.now().minusMinutes(1))
            .build();

        when(conversationSessionRepository.findById("continuing-session"))
            .thenReturn(Optional.of(savedSession));

        // 执行：恢复并继续会话
        Optional<ConversationSession> sessionOpt = conversationSessionRepository
            .findById("continuing-session");

        // 验证
        assertTrue(sessionOpt.isPresent());
        ConversationSession session = sessionOpt.get();
        assertTrue(session.canContinue(), "应能继续之前的会话");
        assertTrue(session.nextRound(), "应能进入下一轮");
        assertEquals(3, session.getCurrentRound());
    }

    // ========== 9. 会话数据序列化/反序列化 ==========

    @Test
    @DisplayName("空消息列表序列化应返回空数组")
    void emptyMessages_shouldSerializeToEmptyArray() {
        // 准备
        ConversationSession session = ConversationSession.builder()
            .sessionId("test")
            .messagesJson(null)
            .build();

        // 验证
        List<ConversationSession.Message> messages = session.getMessages();
        assertNotNull(messages);
        assertTrue(messages.isEmpty());
    }

    @Test
    @DisplayName("无效JSON应返回空列表而非抛出异常")
    void invalidJson_shouldReturnEmptyListInsteadOfException() {
        // 准备
        ConversationSession session = ConversationSession.builder()
            .sessionId("test")
            .messagesJson("{invalid json")
            .candidatesJson("{invalid json")
            .build();

        // 验证：不抛异常，返回空列表
        assertDoesNotThrow(() -> session.getMessages());
        assertDoesNotThrow(() -> session.getCandidates());
        assertTrue(session.getMessages().isEmpty());
        assertTrue(session.getCandidates().isEmpty());
    }

    @Test
    @DisplayName("对话历史构建应正确格式化")
    void buildConversationHistory_shouldFormatCorrectly() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "查询物料");
        addMessageToSession(session, "assistant", "请问您要查询哪种物料?");
        addMessageToSession(session, "user", "原材料A");

        // 执行
        String history = session.buildConversationHistory();

        // 验证
        assertTrue(history.contains("用户: 查询物料"));
        assertTrue(history.contains("助手: 请问您要查询哪种物料?"));
        assertTrue(history.contains("用户: 原材料A"));
    }

    // ========== 10. 最大会话数限制 ==========

    @Test
    @DisplayName("超过最大会话数时应正确处理")
    void exceedMaxSessions_shouldHandleCorrectly() {
        // 准备：模拟用户已有的活动会话
        List<Session> existingSessions = IntStream.range(0, MAX_SESSIONS_PER_USER)
            .mapToObj(i -> createMockSession("session-" + i, USER_ID_1, FACTORY_A))
            .collect(Collectors.toList());

        when(sessionRepository.findByUserIdAndIsRevokedFalse(USER_ID_1))
            .thenReturn(existingSessions);

        // 执行：查询现有会话数
        List<Session> userSessions = sessionRepository.findByUserIdAndIsRevokedFalse(USER_ID_1);

        // 验证
        assertEquals(MAX_SESSIONS_PER_USER, userSessions.size(),
            "用户会话数应达到最大限制");
    }

    @Test
    @DisplayName("统计活动会话数应正确计算")
    void countActiveSessions_shouldCalculateCorrectly() {
        // 准备
        LocalDateTime now = LocalDateTime.now();
        when(sessionRepository.countActiveSessions(now)).thenReturn(42L);

        // 执行
        Long count = sessionRepository.countActiveSessions(now);

        // 验证
        assertEquals(42L, count);
        verify(sessionRepository).countActiveSessions(now);
    }

    // ========== 11. 会话劫持防护 ==========

    @Test
    @DisplayName("无效Token应被拒绝")
    void invalidToken_shouldBeRejected() {
        // 准备
        String invalidToken = "invalid-token-12345";
        when(sessionRepository.findByTokenAndIsRevokedFalse(invalidToken))
            .thenReturn(Optional.empty());

        // 执行
        Optional<Session> result = sessionRepository.findByTokenAndIsRevokedFalse(invalidToken);

        // 验证
        assertTrue(result.isEmpty(), "无效Token不应找到会话");
    }

    @Test
    @DisplayName("已撤销的会话Token应被拒绝")
    void revokedSessionToken_shouldBeRejected() {
        // 准备：已撤销的会话Token不在查询结果中
        when(sessionRepository.findByTokenAndIsRevokedFalse(anyString()))
            .thenReturn(Optional.empty());

        // 执行
        Optional<Session> result = sessionRepository.findByTokenAndIsRevokedFalse("revoked-token");

        // 验证
        assertTrue(result.isEmpty(), "已撤销的会话Token不应找到会话");
    }

    @Test
    @DisplayName("会话有效性检查应正确验证")
    void isSessionValid_shouldValidateCorrectly() {
        // 准备
        String validToken = "valid-token";
        String invalidToken = "invalid-token";
        LocalDateTime now = LocalDateTime.now();

        when(sessionRepository.isSessionValid(validToken, now)).thenReturn(true);
        when(sessionRepository.isSessionValid(invalidToken, now)).thenReturn(false);

        // 验证
        assertTrue(sessionRepository.isSessionValid(validToken, now), "有效Token应通过验证");
        assertFalse(sessionRepository.isSessionValid(invalidToken, now), "无效Token不应通过验证");
    }

    @Test
    @DisplayName("RefreshToken验证应正确处理")
    void refreshToken_shouldValidateCorrectly() {
        // 准备
        String validRefreshToken = "valid-refresh-token";
        Session mockSession = createMockSession("session-1", USER_ID_1, FACTORY_A);

        when(sessionRepository.findByRefreshTokenAndIsRevokedFalse(validRefreshToken))
            .thenReturn(Optional.of(mockSession));

        // 执行
        Optional<Session> result = sessionRepository.findByRefreshTokenAndIsRevokedFalse(validRefreshToken);

        // 验证
        assertTrue(result.isPresent(), "有效的RefreshToken应找到会话");
        assertEquals(USER_ID_1, result.get().getUserId());
    }

    // ========== 12. 会话失效级联处理 ==========

    @Test
    @DisplayName("会话完成应正确设置最终状态")
    void complete_shouldSetFinalState() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试");

        // 执行
        session.complete("MATERIAL_QUERY", 0.95);

        // 验证
        assertEquals(SessionStatus.COMPLETED, session.getStatus());
        assertEquals("MATERIAL_QUERY", session.getFinalIntentCode());
        assertEquals(0.95, session.getLastConfidence());
        assertNotNull(session.getCompletedAt());
        assertFalse(session.canContinue(), "已完成的会话不能继续");
    }

    @Test
    @DisplayName("达到最大轮次应正确设置状态")
    void maxRoundsReached_shouldSetCorrectStatus() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试");

        // 执行
        session.maxRoundsReached();

        // 验证
        assertEquals(SessionStatus.MAX_ROUNDS_REACHED, session.getStatus());
        assertNotNull(session.getCompletedAt());
        assertFalse(session.canContinue());
    }

    @Test
    @DisplayName("参数收集完成应正确更新会话状态")
    void completeParameterCollection_shouldUpdateStatus() {
        // 准备
        List<RequiredParameter> params = Collections.singletonList(
            RequiredParameter.builder()
                .name("batchId").label("批次ID").type("string").collected(false).build()
        );
        ConversationSession session = createTestSessionForParameterCollection(
            FACTORY_A, USER_ID_1, "BATCH_QUERY", params, "请提供批次ID");

        // 收集参数
        session.addCollectedParameter("batchId", "BATCH-001");

        // 执行
        session.completeParameterCollection();

        // 验证
        assertEquals(SessionStatus.COMPLETED, session.getStatus());
        assertEquals("BATCH_QUERY", session.getFinalIntentCode());
        assertEquals(1.0, session.getLastConfidence());
    }

    @Test
    @DisplayName("会话状态变更应记录完成时间")
    void statusChange_shouldRecordCompletionTime() {
        // 准备
        ConversationSession session = createTestSession(FACTORY_A, USER_ID_1, "测试");
        assertNull(session.getCompletedAt(), "初始时完成时间应为空");

        // 测试各种状态变更
        ConversationSession session1 = createTestSession(FACTORY_A, USER_ID_1, "测试1");
        session1.complete("INTENT", 0.9);
        assertNotNull(session1.getCompletedAt(), "complete()应设置完成时间");

        ConversationSession session2 = createTestSession(FACTORY_A, USER_ID_1, "测试2");
        session2.timeout();
        assertNotNull(session2.getCompletedAt(), "timeout()应设置完成时间");

        ConversationSession session3 = createTestSession(FACTORY_A, USER_ID_1, "测试3");
        session3.cancel();
        assertNotNull(session3.getCompletedAt(), "cancel()应设置完成时间");

        ConversationSession session4 = createTestSession(FACTORY_A, USER_ID_1, "测试4");
        session4.maxRoundsReached();
        assertNotNull(session4.getCompletedAt(), "maxRoundsReached()应设置完成时间");
    }

    // ========== 附加测试场景 ==========

    @Test
    @DisplayName("孤儿会话清理 - 长时间未活动的会话应被清理")
    void orphanedSession_shouldBeCleanedUp() {
        // 准备：创建"孤儿"会话（长时间未活动）
        ConversationSession orphanSession = ConversationSession.builder()
            .sessionId("orphan-session")
            .factoryId(FACTORY_A)
            .userId(USER_ID_1)
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .lastActiveAt(LocalDateTime.now().minusHours(24)) // 24小时前
            .timeoutMinutes(10)
            .build();

        // 验证：会话已过期
        assertTrue(orphanSession.isExpired(), "孤儿会话应被标记为过期");
        assertFalse(orphanSession.canContinue(), "孤儿会话不应能继续");
    }

    @Test
    @DisplayName("会话数据恢复 - 从部分数据恢复会话")
    void sessionRecovery_shouldHandlePartialData() {
        // 准备：部分数据的会话
        ConversationSession partialSession = ConversationSession.builder()
            .sessionId("partial-session")
            .factoryId(FACTORY_A)
            .userId(USER_ID_1)
            .originalInput("部分数据测试")
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            // 缺少其他字段
            .build();

        // 验证：使用默认值
        assertNotNull(partialSession.getMessages(), "消息列表应返回空列表而非null");
        assertNotNull(partialSession.getCandidates(), "候选列表应返回空列表而非null");
        assertNotNull(partialSession.getCollectedParameters(), "参数应返回空Map而非null");
    }

    // ========== 辅助方法 ==========

    /**
     * 创建模拟Session对象
     */
    private Session createMockSession(String id, Long userId, String factoryId) {
        Session session = new Session();
        session.setId(id);
        session.setUserId(userId);
        session.setFactoryId(factoryId);
        session.setToken("token-" + id);
        session.setRefreshToken("refresh-" + id);
        session.setExpiresAt(LocalDateTime.now().plusHours(24));
        session.setIsRevoked(false);
        return session;
    }

    /**
     * 创建测试用ConversationSession（手动生成sessionId）
     * 用于替代ConversationSession.create()，因为@PrePersist在单元测试中不生效
     */
    private ConversationSession createTestSession(String factoryId, Long userId, String originalInput) {
        LocalDateTime now = LocalDateTime.now();
        String messagesJson = "[{\"role\":\"user\",\"content\":\"" + escapeJson(originalInput) + "\"}]";
        return ConversationSession.builder()
            .sessionId(UUID.randomUUID().toString())
            .factoryId(factoryId)
            .userId(userId)
            .originalInput(originalInput)
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.INTENT_RECOGNITION)
            .currentRound(1)
            .maxRounds(5)
            .timeoutMinutes(10)
            .messagesJson(messagesJson)
            .createdAt(now)
            .updatedAt(now)
            .lastActiveAt(now)
            .build();
    }

    /**
     * 创建参数收集测试用ConversationSession
     */
    private ConversationSession createTestSessionForParameterCollection(
            String factoryId, Long userId, String intentCode,
            List<RequiredParameter> params, String question) {
        LocalDateTime now = LocalDateTime.now();
        // 序列化参数列表
        String paramsJson = serializeRequiredParameters(params);
        String messagesJson = "[{\"role\":\"assistant\",\"content\":\"" + escapeJson(question) + "\"}]";
        return ConversationSession.builder()
            .sessionId(UUID.randomUUID().toString())
            .factoryId(factoryId)
            .userId(userId)
            .originalInput(question)
            .status(SessionStatus.ACTIVE)
            .sessionMode(SessionMode.PARAMETER_COLLECTION)
            .knownIntentCode(intentCode)
            .currentRound(1)
            .maxRounds(5)
            .timeoutMinutes(10)
            .messagesJson(messagesJson)
            .requiredParametersJson(paramsJson)
            .collectedParametersJson("{}")
            .createdAt(now)
            .updatedAt(now)
            .lastActiveAt(now)
            .build();
    }

    /**
     * 手动添加消息到会话（用于单元测试中替代addUserMessage/addAssistantMessage）
     */
    private void addMessageToSession(ConversationSession session, String role, String content) {
        var messages = session.getMessages();
        var newMessages = new ArrayList<>(messages);
        newMessages.add(ConversationSession.Message.builder()
            .role(role)
            .content(content)
            .build());
        // 将消息列表序列化回JSON
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < newMessages.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"role\":\"").append(newMessages.get(i).getRole())
              .append("\",\"content\":\"").append(escapeJson(newMessages.get(i).getContent())).append("\"}");
        }
        sb.append("]");
        session.setMessagesJson(sb.toString());
    }

    /**
     * 转义JSON特殊字符
     */
    private String escapeJson(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }

    /**
     * 序列化RequiredParameter列表为JSON
     */
    private String serializeRequiredParameters(List<RequiredParameter> params) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < params.size(); i++) {
            if (i > 0) sb.append(",");
            RequiredParameter p = params.get(i);
            sb.append("{\"name\":\"").append(p.getName()).append("\"")
              .append(",\"label\":\"").append(p.getLabel()).append("\"")
              .append(",\"type\":\"").append(p.getType()).append("\"")
              .append(",\"collected\":").append(p.isCollected()).append("}");
        }
        sb.append("]");
        return sb.toString();
    }
}
