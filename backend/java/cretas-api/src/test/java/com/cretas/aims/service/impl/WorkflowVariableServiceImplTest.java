package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.WorkflowVariableDef;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.config.WorkflowVariableDefRepository;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * WorkflowVariableServiceImpl 单元测试 — Sprint 4 W2 Chat J C-WF-VAR-1.
 */
@DisplayName("WorkflowVariableServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class WorkflowVariableServiceImplTest {

    @Mock
    private WorkflowVariableDefRepository repository;

    private WorkflowVariableServiceImpl service;
    private SandboxedSpelEvaluator evaluator;

    private static final String FACTORY_ID = "F001";
    private static final String OTHER_FACTORY = "F006";
    private static final String DEF_ID = "var-uuid-001";

    @BeforeEach
    void setUp() {
        evaluator = new SandboxedSpelEvaluator(); // 真实 SpEL — 测 testExpression 端到端
        service = new WorkflowVariableServiceImpl(repository, evaluator);
    }

    private WorkflowVariableDef factoryVarDef() {
        WorkflowVariableDef v = new WorkflowVariableDef();
        v.setId(DEF_ID);
        v.setFactoryId(FACTORY_ID);
        v.setVarName("customField");
        v.setVarType("STRING");
        v.setCategory("CUSTOM");
        v.setIsActive(true);
        return v;
    }

    private WorkflowVariableDef systemVarDef() {
        WorkflowVariableDef v = new WorkflowVariableDef();
        v.setId(DEF_ID);
        v.setFactoryId(null);
        v.setVarName("own.role");
        v.setVarType("STRING");
        v.setCategory("OWN");
        v.setIsActive(true);
        return v;
    }

    // ==================== CRUD ====================

    @Test
    @DisplayName("create happy path 注入 factoryId + 默认 category/isActive")
    void testCreateHappyPath() {
        WorkflowVariableDef req = new WorkflowVariableDef();
        req.setVarName("newVar");
        req.setVarType("STRING");
        req.setCategory("CUSTOM");
        when(repository.save(any(WorkflowVariableDef.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkflowVariableDef saved = service.create(FACTORY_ID, req);

        assertEquals(FACTORY_ID, saved.getFactoryId());
        assertEquals("CUSTOM", saved.getCategory());
        assertTrue(saved.getIsActive());
    }

    @Test
    @DisplayName("create 非法 varType 抛 BusinessException(400)")
    void testCreateInvalidType() {
        WorkflowVariableDef req = new WorkflowVariableDef();
        req.setVarName("bad");
        req.setVarType("NOT_A_TYPE");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(400, ex.getCode());
    }

    @Test
    @DisplayName("update 系统预设 (factoryId NULL) 抛 BusinessException(403)")
    void testUpdateSystemPresetRejected() {
        when(repository.findById(DEF_ID)).thenReturn(Optional.of(systemVarDef()));
        WorkflowVariableDef partial = new WorkflowVariableDef();
        partial.setDescription("attempt to modify system");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(FACTORY_ID, DEF_ID, partial));
        assertEquals(403, ex.getCode());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("delete 系统预设抛 BusinessException(403)")
    void testDeleteSystemPresetRejected() {
        when(repository.findById(DEF_ID)).thenReturn(Optional.of(systemVarDef()));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.delete(FACTORY_ID, DEF_ID));
        assertEquals(403, ex.getCode());
        verify(repository, never()).delete(any());
    }

    @Test
    @DisplayName("update 其他工厂的变量抛 403")
    void testUpdateOtherFactoryRejected() {
        WorkflowVariableDef other = factoryVarDef();
        other.setFactoryId(OTHER_FACTORY);
        when(repository.findById(DEF_ID)).thenReturn(Optional.of(other));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(FACTORY_ID, DEF_ID, new WorkflowVariableDef()));
        assertEquals(403, ex.getCode());
    }

    @Test
    @DisplayName("delete 不存在 id 抛 ResourceNotFoundException")
    void testDeleteNotFound() {
        when(repository.findById("missing")).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class,
                () -> service.delete(FACTORY_ID, "missing"));
    }

    @Test
    @DisplayName("listAvailable 透传到 repo")
    void testListAvailable() {
        when(repository.findAvailableForFactory(FACTORY_ID)).thenReturn(List.of(systemVarDef()));
        List<WorkflowVariableDef> result = service.listAvailable(FACTORY_ID);
        assertEquals(1, result.size());
    }

    // ==================== testExpression — 端到端 with real evaluator ====================

    @Test
    @DisplayName("testExpression happy path — own.role == 'admin' + sample own={role:admin}")
    void testExpressionHappyPath() {
        Map<String, Object> sample = Map.of("own", Map.of("role", "admin"));
        Map<String, Object> result = service.testExpression(FACTORY_ID, "#own.role == 'admin'", sample);
        assertEquals(true, result.get("success"));
        assertEquals(true, result.get("result"));
    }

    @Test
    @DisplayName("testExpression amount > 10000 — sample order={amount:15000}")
    void testExpressionAmountCompare() {
        Map<String, Object> sample = Map.of("order", Map.of("amount", 15000));
        Map<String, Object> result = service.testExpression(FACTORY_ID, "#order.amount > 10000", sample);
        assertEquals(true, result.get("success"));
        assertEquals(true, result.get("result"));
    }

    @Test
    @DisplayName("testExpression R5 友好错误 — 引用不存在字段返 hint")
    void testExpressionFriendlyError() {
        Map<String, Object> sample = Map.of("own", Map.of("role", "admin"));
        Map<String, Object> result = service.testExpression(FACTORY_ID, "#own.fakeField", sample);
        assertEquals(false, result.get("success"));
        assertNotNull(result.get("errorMessage"));
        assertNotNull(result.get("actionHint"));
    }

    @Test
    @DisplayName("testExpression ⛔ 拒绝 T(Runtime) 反射 attack")
    void testExpressionBlocksRuntime() {
        Map<String, Object> result = service.testExpression(FACTORY_ID,
                "T(java.lang.Runtime).getRuntime().exec('ls')",
                Map.of());
        assertEquals(false, result.get("success"));
        assertNotNull(result.get("actionHint"));
    }

    @Test
    @DisplayName("testExpression 空 spel 抛 BusinessException(400)")
    void testExpressionEmptySpel() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.testExpression(FACTORY_ID, "", Map.of()));
        assertEquals(400, ex.getCode());
    }
}
