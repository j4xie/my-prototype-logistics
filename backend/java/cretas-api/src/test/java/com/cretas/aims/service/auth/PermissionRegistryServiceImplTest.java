package com.cretas.aims.service.auth;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.auth.PermissionRegistry;
import com.cretas.aims.entity.auth.PermissionRegistry.Source;
import com.cretas.aims.repository.auth.PermissionRegistryRepository;
import com.cretas.aims.service.auth.PermissionRegistryService.ScanResult;
import com.cretas.aims.service.auth.impl.PermissionRegistryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * {@link PermissionRegistryServiceImpl} 单元测试 (Sprint 4 Wave 2 Chat J — C-CHECKPOWER-1).
 *
 * <p>覆盖:
 * <ul>
 *   <li>反射扫描 @RequirePermission (class-level + method-level)</li>
 *   <li>upsert: 新增 / 更新 source_class / 跳过 MANUAL 源</li>
 *   <li>module:action 解析 (含不规范输入退化)</li>
 *   <li>auditSummary 结构</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PermissionRegistryService 单元测试")
class PermissionRegistryServiceImplTest {

    @Mock
    private ApplicationContext applicationContext;

    @Mock
    private PermissionRegistryRepository registryRepository;

    @InjectMocks
    private PermissionRegistryServiceImpl service;

    @BeforeEach
    void setupContext() {
        // ApplicationContext 默认返回空 bean map; per-test 覆盖。
        // lenient — auditSummary 测试不调 scanAndRegister, 不应被 strict stubbing 误判。
        lenient().when(applicationContext.getBeansWithAnnotation(RestController.class))
                .thenReturn(new HashMap<>());
        lenient().when(applicationContext.getBeansWithAnnotation(Controller.class))
                .thenReturn(new HashMap<>());
    }

    @Test
    @DisplayName("scanAndRegister - 空 controller 集 → 全 0 计数")
    void scanAndRegister_emptyControllers_returnsZeroCounts() {
        ScanResult result = service.scanAndRegister();

        assertEquals(0, result.scannedClasses());
        assertEquals(0, result.scannedMethods());
        assertEquals(0, result.registeredPermissions());
        assertEquals(0, result.updatedPermissions());
        assertEquals(0, result.skippedPermissions());
        assertTrue(result.errors().isEmpty());
        verify(registryRepository, never()).save(any());
    }

    @Test
    @DisplayName("scanAndRegister - method-level 注解 → 新权限注册到 registry")
    void scanAndRegister_methodLevelAnnotation_registersNewPermission() {
        Map<String, Object> beans = new HashMap<>();
        beans.put("sampleController", new SampleController());
        when(applicationContext.getBeansWithAnnotation(RestController.class)).thenReturn(beans);
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull(anyString()))
                .thenReturn(Optional.empty());

        ScanResult result = service.scanAndRegister();

        assertEquals(1, result.scannedClasses());
        assertTrue(result.scannedMethods() >= 1, "应扫描到 method-level 注解");
        assertTrue(result.registeredPermissions() >= 2,
                "SampleController 声明 production:read + quality:write");

        ArgumentCaptor<PermissionRegistry> captor = ArgumentCaptor.forClass(PermissionRegistry.class);
        verify(registryRepository, atLeast(2)).save(captor.capture());

        boolean foundProductionRead = captor.getAllValues().stream()
                .anyMatch(p -> "production:read".equals(p.getPermissionCode())
                        && "production".equals(p.getModule())
                        && "read".equals(p.getAction())
                        && p.getSource() == Source.ANNOTATION);
        assertTrue(foundProductionRead, "production:read 应当被解析并注册");
    }

    @Test
    @DisplayName("scanAndRegister - 已有 ANNOTATION 源 且 source_class 变化 → UPDATE")
    void scanAndRegister_existingAnnotationSource_updatesSourceClass() {
        Map<String, Object> beans = new HashMap<>();
        beans.put("sampleController", new SampleController());
        when(applicationContext.getBeansWithAnnotation(RestController.class)).thenReturn(beans);

        PermissionRegistry existing = PermissionRegistry.builder()
                .permissionCode("production:read")
                .module("production").action("read")
                .source(Source.ANNOTATION)
                .sourceClass("OldClass")    // 旧 source class
                .sourceMethod("oldMethod")
                .isActive(true)
                .build();
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull("production:read"))
                .thenReturn(Optional.of(existing));
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull("quality:write"))
                .thenReturn(Optional.empty());

        ScanResult result = service.scanAndRegister();

        assertTrue(result.updatedPermissions() >= 1, "source_class 变化应触发 UPDATE");
        // existing 行被改成新 class name
        assertTrue(existing.getSourceClass().contains("SampleController"),
                "existing.sourceClass 应被更新为 SampleController");
    }

    @Test
    @DisplayName("scanAndRegister - 已有 MANUAL 源 → SKIP (不覆盖)")
    void scanAndRegister_existingManualSource_isSkipped() {
        Map<String, Object> beans = new HashMap<>();
        beans.put("sampleController", new SampleController());
        when(applicationContext.getBeansWithAnnotation(RestController.class)).thenReturn(beans);

        PermissionRegistry manualEntry = PermissionRegistry.builder()
                .permissionCode("production:read")
                .source(Source.MANUAL)
                .sourceClass("AdminPanel")
                .build();
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull("production:read"))
                .thenReturn(Optional.of(manualEntry));
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull("quality:write"))
                .thenReturn(Optional.empty());

        ScanResult result = service.scanAndRegister();

        // production:read 是 MANUAL → SKIP, quality:write 新增 → REGISTERED
        assertEquals("AdminPanel", manualEntry.getSourceClass(),
                "MANUAL 源不应被 ANNOTATION scan 覆盖");
        assertTrue(result.skippedPermissions() >= 1, "MANUAL 应当 SKIP");
    }

    @Test
    @DisplayName("scanAndRegister - 不规范 permission code 退化处理")
    void scanAndRegister_malformedCode_falsBackToModuleEqualsAction() {
        Map<String, Object> beans = new HashMap<>();
        beans.put("badController", new MalformedController());
        when(applicationContext.getBeansWithAnnotation(RestController.class)).thenReturn(beans);
        when(registryRepository.findByPermissionCodeAndFactoryIdIsNull(anyString()))
                .thenReturn(Optional.empty());

        ScanResult result = service.scanAndRegister();
        assertTrue(result.registeredPermissions() >= 1);

        ArgumentCaptor<PermissionRegistry> captor = ArgumentCaptor.forClass(PermissionRegistry.class);
        verify(registryRepository, atLeastOnce()).save(captor.capture());
        PermissionRegistry saved = captor.getAllValues().get(0);
        // "admin" (无 :) → module="admin", action="admin"
        assertEquals(saved.getModule(), saved.getAction(),
                "无 ':' 的 code 应当 module=action 退化");
    }

    @Test
    @DisplayName("auditSummary 包含 totalActive / byModule / bySource / moduleCount")
    void auditSummary_structureIsComplete() {
        when(registryRepository.findAll()).thenReturn(java.util.List.of(
                PermissionRegistry.builder()
                        .permissionCode("production:read")
                        .module("production").action("read")
                        .source(Source.ANNOTATION).isActive(true).build()
        ));
        when(registryRepository.findDistinctModules()).thenReturn(java.util.List.of("production"));
        when(registryRepository.countBySource(any(Source.class))).thenReturn(0L);
        when(registryRepository.findByModuleOrderByActionAsc("production"))
                .thenReturn(java.util.List.of(PermissionRegistry.builder().build()));

        Map<String, Object> summary = service.auditSummary();

        assertNotNull(summary.get("totalActive"));
        assertNotNull(summary.get("bySource"));
        assertNotNull(summary.get("modules"));
        assertNotNull(summary.get("moduleCount"));
        assertNotNull(summary.get("byModule"));
    }

    // ==================== test fixtures ====================

    @RestController
    static class SampleController {
        @RequirePermission("production:read")
        public String getProduction() { return "ok"; }

        @RequirePermission("quality:write")
        public String updateQuality() { return "ok"; }
    }

    @RestController
    static class MalformedController {
        @RequirePermission("admin")  // 无 ':'
        public String adminAction() { return "ok"; }
    }
}
