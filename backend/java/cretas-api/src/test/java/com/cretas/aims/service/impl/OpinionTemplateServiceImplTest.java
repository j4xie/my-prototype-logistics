package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.OpinionTemplate;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.OpinionTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * OpinionTemplateServiceImpl 单元测试 — Sprint 4 W2 Chat J (C-OPINION-1).
 *
 * <p>覆盖核心 8 cases:
 * <ol>
 *   <li>listAvailable 透传到 repo 合并查询</li>
 *   <li>listAvailable 空 decisionType → BusinessException(400)</li>
 *   <li>create happy path 注入 factoryId + defaults</li>
 *   <li>create 空 content → BusinessException(400)</li>
 *   <li>create content 超 500 → BusinessException(400)</li>
 *   <li>update PATCH 语义 (null 字段不动)</li>
 *   <li>update 系统预设 (factoryId NULL) → BusinessException(403)</li>
 *   <li>update 其他工厂模板 → BusinessException(403)</li>
 *   <li>delete 系统预设 → BusinessException(403)</li>
 *   <li>delete 不存在 → ResourceNotFoundException</li>
 * </ol>
 */
@DisplayName("OpinionTemplateServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class OpinionTemplateServiceImplTest {

    @Mock
    private OpinionTemplateRepository repository;

    private OpinionTemplateServiceImpl service;

    private static final String FACTORY_ID = "F001";
    private static final String OTHER_FACTORY = "F006";
    private static final String TEMPLATE_ID = "tpl-uuid-001";

    @BeforeEach
    void setUp() {
        service = new OpinionTemplateServiceImpl(repository);
    }

    private OpinionTemplate validRequest(String content) {
        return OpinionTemplate.builder()
                .decisionType("CUSTOM")
                .content(content)
                .sortOrder(10)
                .build();
    }

    private OpinionTemplate existingFactoryTemplate() {
        // Setter-based init to avoid SuperBuilder + @Builder.Default 交互 (Integer 默认 0 覆盖问题)
        OpinionTemplate t = new OpinionTemplate();
        t.setId(TEMPLATE_ID);
        t.setFactoryId(FACTORY_ID);
        t.setDecisionType("CUSTOM");
        t.setContent("原内容");
        t.setSortOrder(5);
        t.setIsActive(true);
        return t;
    }

    private OpinionTemplate systemPresetTemplate() {
        OpinionTemplate t = new OpinionTemplate();
        t.setId(TEMPLATE_ID);
        t.setFactoryId(null);
        t.setDecisionType("CUSTOM");
        t.setContent("同意");
        t.setSortOrder(1);
        t.setIsActive(true);
        return t;
    }

    // ==================== listAvailable ====================

    @Test
    @DisplayName("listAvailable 透传到 repo.findAvailableForFactory 合并查询")
    void testListAvailableDelegatesToRepo() {
        List<OpinionTemplate> mockList = List.of(systemPresetTemplate());
        when(repository.findAvailableForFactory("CUSTOM", FACTORY_ID)).thenReturn(mockList);

        List<OpinionTemplate> result = service.listAvailable(FACTORY_ID, "CUSTOM");

        assertEquals(1, result.size());
        verify(repository).findAvailableForFactory("CUSTOM", FACTORY_ID);
    }

    @Test
    @DisplayName("listAvailable 空 decisionType 抛 BusinessException(400)")
    void testListAvailableEmptyDecisionTypeRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.listAvailable(FACTORY_ID, ""));
        assertEquals(400, ex.getCode());
    }

    // ==================== create ====================

    @Test
    @DisplayName("create happy path 注入 factoryId + 默认 sortOrder/isActive")
    void testCreateHappyPath() {
        OpinionTemplate req = validRequest("新增意见");
        req.setIsActive(null);
        req.setSortOrder(null);
        when(repository.save(any(OpinionTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        OpinionTemplate saved = service.create(FACTORY_ID, req);

        assertEquals(FACTORY_ID, saved.getFactoryId());
        assertEquals("新增意见", saved.getContent());
        assertEquals(0, saved.getSortOrder());
        assertTrue(saved.getIsActive());
    }

    @Test
    @DisplayName("create 空 content 抛 BusinessException(400)")
    void testCreateEmptyContentRejected() {
        OpinionTemplate req = validRequest("");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(400, ex.getCode());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("create content 超 500 字抛 BusinessException(400)")
    void testCreateContentTooLong() {
        String longContent = "a".repeat(501);
        OpinionTemplate req = validRequest(longContent);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(400, ex.getCode());
        verify(repository, never()).save(any());
    }

    // ==================== update ====================

    @Test
    @DisplayName("update PATCH 语义 — content 字段被更新")
    void testUpdatePatchSemantics() {
        OpinionTemplate existing = existingFactoryTemplate();
        when(repository.findById(TEMPLATE_ID)).thenReturn(Optional.of(existing));
        when(repository.save(any(OpinionTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        // 只显式覆盖 content; sortOrder / isActive 由 entity field-initializer (Integer 0 / Boolean true)
        // 占位 — 真正 nullable-PATCH 语义需要 DTO 包装层 (PR #730 foundation 未含).
        OpinionTemplate partial = new OpinionTemplate();
        partial.setContent("更新内容");
        partial.setDecisionType(null); // string 字段无 initializer, 可保持 null

        OpinionTemplate result = service.update(FACTORY_ID, TEMPLATE_ID, partial);

        assertEquals("更新内容", result.getContent());            // 显式覆盖
        assertEquals("CUSTOM", result.getDecisionType());        // null → service skip → 保留原值 ✓
    }

    @Test
    @DisplayName("update 系统预设 (factoryId NULL) 抛 BusinessException(403)")
    void testUpdateSystemPresetRejected() {
        when(repository.findById(TEMPLATE_ID)).thenReturn(Optional.of(systemPresetTemplate()));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(FACTORY_ID, TEMPLATE_ID, validRequest("覆盖系统")));
        assertEquals(403, ex.getCode());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("update 其他工厂模板抛 BusinessException(403)")
    void testUpdateOtherFactoryRejected() {
        OpinionTemplate other = existingFactoryTemplate();
        other.setFactoryId(OTHER_FACTORY);
        when(repository.findById(TEMPLATE_ID)).thenReturn(Optional.of(other));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(FACTORY_ID, TEMPLATE_ID, validRequest("跨工厂修改")));
        assertEquals(403, ex.getCode());
        verify(repository, never()).save(any());
    }

    // ==================== delete ====================

    @Test
    @DisplayName("delete 系统预设抛 BusinessException(403)")
    void testDeleteSystemPresetRejected() {
        when(repository.findById(TEMPLATE_ID)).thenReturn(Optional.of(systemPresetTemplate()));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.delete(FACTORY_ID, TEMPLATE_ID));
        assertEquals(403, ex.getCode());
        verify(repository, never()).delete(any());
    }

    @Test
    @DisplayName("delete 不存在 id 抛 ResourceNotFoundException")
    void testDeleteNotFound() {
        when(repository.findById("missing-id")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.delete(FACTORY_ID, "missing-id"));
        verify(repository, never()).delete(any());
    }

    @Test
    @DisplayName("delete happy path 软删除工厂自定义模板")
    void testDeleteHappyPath() {
        OpinionTemplate existing = existingFactoryTemplate();
        when(repository.findById(TEMPLATE_ID)).thenReturn(Optional.of(existing));

        service.delete(FACTORY_ID, TEMPLATE_ID);

        verify(repository).delete(existing);
    }
}
