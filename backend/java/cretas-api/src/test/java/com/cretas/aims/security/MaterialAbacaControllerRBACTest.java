package com.cretas.aims.security;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.controller.material.MaterialAbacaController;
import com.cretas.aims.dto.material.CreateAbacaQuantityLogRequest;
import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AbacaQuantityLogRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.service.material.AbacaQuantityLogService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Sprint1-Fix-K3 (#649 follow-up) — MaterialAbacaController RBAC + 双签 + factory 隔离 lock.
 *
 * <p>背景: Sprint 1 #649 (W-ABA-1 抄码品识别) merge 时 PR_AUDIT 标 🟠 必修后 merge 但实际未修:
 * 6 endpoint 全部 0 @RequirePermission + 自定义 currentUserId(authorization) 绕开 SecurityUtils.
 * 本 fix PR 补齐 RBAC + 删自定义 JWT parse, 单测锁死防止 regression.</p>
 *
 * <p>测试分两组:</p>
 * <ol>
 *   <li><strong>注解审计</strong> (反射) — 锁死 6 endpoint @RequirePermission 值, 防止删除/改宽.
 *       与 {@code R6V5PriceListRbacTest} 等其他 RBAC lock-down 测试同 pattern.</li>
 *   <li><strong>Service 侧 invariant</strong> (Mockito) — 双签 / 已复核拒删 / factory 隔离 由 service
 *       throw BusinessException. 这些是 PR #649 已有逻辑, 本测试 lock 起来防 regression.</li>
 * </ol>
 *
 * @see com.cretas.aims.security.R6V5PriceListRbacTest reference pattern
 * @see com.cretas.aims.service.material.AbacaQuantityLogService 被测 service
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Sprint1-Fix-K3 — MaterialAbacaController RBAC + 双签 + factory 隔离")
class MaterialAbacaControllerRBACTest {

    private static final String PROCUREMENT_READ = "procurement:read";
    private static final String PROCUREMENT_READ_WRITE = "procurement:read_write";

    /**
     * 注解审计 — 6 endpoint 全部加 @RequirePermission, 读 endpoint 接受
     * read/read_write 任一, 写 endpoint 只接受 read_write.
     */
    @Nested
    @DisplayName("注解审计: 6 endpoint @RequirePermission 锁死")
    class AnnotationAudit {

        @Test
        @DisplayName("GET listByBatch — procurement:read 或 read_write")
        void listByBatch_isAnnotated() throws Exception {
            assertReadGate("listByBatch", String.class, String.class);
        }

        @Test
        @DisplayName("GET getById — procurement:read 或 read_write")
        void getById_isAnnotated() throws Exception {
            assertReadGate("getById", String.class, String.class);
        }

        @Test
        @DisplayName("POST create — procurement:read_write")
        void create_isWriteGated() throws Exception {
            assertWriteOnlyGate("create", String.class, CreateAbacaQuantityLogRequest.class);
        }

        @Test
        @DisplayName("POST batch — procurement:read_write")
        void createBatch_isWriteGated() throws Exception {
            assertWriteOnlyGate("createBatch", String.class, List.class);
        }

        @Test
        @DisplayName("PUT verify — procurement:read_write")
        void verify_isWriteGated() throws Exception {
            assertWriteOnlyGate("verify", String.class, String.class);
        }

        @Test
        @DisplayName("DELETE softDelete — procurement:read_write")
        void softDelete_isWriteGated() throws Exception {
            assertWriteOnlyGate("softDelete", String.class, String.class);
        }

        @Test
        @DisplayName("Controller 不依赖 @RequestHeader Authorization (改用 SecurityUtils)")
        void controllerDoesNotInjectAuthorizationHeader() {
            for (Method m : MaterialAbacaController.class.getDeclaredMethods()) {
                for (var p : m.getParameters()) {
                    var hdr = p.getAnnotation(org.springframework.web.bind.annotation.RequestHeader.class);
                    if (hdr != null && "Authorization".equalsIgnoreCase(hdr.value())) {
                        throw new AssertionError(m.getName()
                                + " 仍然注入 @RequestHeader(\"Authorization\") — Sprint1-Fix-K3 已删除自定义 JWT parse, "
                                + "改用 SecurityUtils.getCurrentUserId(). 回写此 header 会再次绕开 RBAC.");
                    }
                }
            }
        }

        private void assertReadGate(String methodName, Class<?>... paramTypes) throws Exception {
            Method m = MaterialAbacaController.class.getDeclaredMethod(methodName, paramTypes);
            RequirePermission anno = m.getAnnotation(RequirePermission.class);
            assertNotNull(anno, methodName + " 缺 @RequirePermission — #649 PR_AUDIT 报警, Sprint1-Fix-K3 不可回退");
            List<String> perms = Arrays.asList(anno.value());
            assertTrue(perms.contains(PROCUREMENT_READ) || perms.contains(PROCUREMENT_READ_WRITE),
                    methodName + " @RequirePermission 必须包含 procurement:read 或 procurement:read_write, 实际: " + perms);
        }

        private void assertWriteOnlyGate(String methodName, Class<?>... paramTypes) throws Exception {
            Method m = MaterialAbacaController.class.getDeclaredMethod(methodName, paramTypes);
            RequirePermission anno = m.getAnnotation(RequirePermission.class);
            assertNotNull(anno, methodName + " 缺 @RequirePermission — 写 endpoint 必须显式 RBAC");
            assertArrayEquals(new String[]{PROCUREMENT_READ_WRITE}, anno.value(),
                    methodName + " 写 endpoint 必须严格 procurement:read_write (procurement:read 不够), 实际: "
                            + Arrays.toString(anno.value()));
        }
    }

    /**
     * Service 层 invariant — 双签 / 已复核拒删 / factory 隔离. Belt+suspenders: 即使 controller
     * 误删 RBAC, service 层 invariant 依然兜底.
     */
    @Nested
    @DisplayName("Service invariant: 双签 + 已复核拒删 + factory 隔离")
    class ServiceInvariant {

        @Mock
        private AbacaQuantityLogRepository abacaRepo;
        @Mock
        private RawMaterialTypeRepository rawMaterialTypeRepo;
        @Mock
        private MaterialBatchRepository materialBatchRepo;

        @InjectMocks
        private AbacaQuantityLogService service;

        @Test
        @DisplayName("verify(): weighedBy == verifierUserId → BusinessException (双签拒绝同一人复核)")
        void verify_rejectsSelfSignedByWeigher() {
            Long sameUser = 1001L;
            AbacaQuantityLog entry = new AbacaQuantityLog();
            entry.setId("ABACA-001");
            entry.setFactoryId("F001");
            entry.setWeighedBy(sameUser);
            // verifiedBy/At 未设 → isVerified()=false → 双签校验先生效
            lenient().when(abacaRepo.findByIdAndFactoryId("ABACA-001", "F001"))
                    .thenReturn(Optional.of(entry));

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.verify("F001", "ABACA-001", sameUser),
                    "称重员自己复核必须被 service 层拒绝 — 双签机制核心");
            assertTrue(ex.getMessage().contains("双签") || ex.getMessage().contains("不能由称重员"),
                    "双签拒绝异常文案应包含'双签'或'不能由称重员', 实际: " + ex.getMessage());
        }

        @Test
        @DisplayName("verify(): weighedBy != verifierUserId → save 成功 (合法复核)")
        void verify_acceptsDifferentVerifier() {
            Long weigher = 1001L;
            Long verifier = 1002L;
            AbacaQuantityLog entry = new AbacaQuantityLog();
            entry.setId("ABACA-002");
            entry.setFactoryId("F001");
            entry.setWeighedBy(weigher);
            lenient().when(abacaRepo.findByIdAndFactoryId("ABACA-002", "F001"))
                    .thenReturn(Optional.of(entry));
            lenient().when(abacaRepo.save(entry)).thenReturn(entry);

            AbacaQuantityLog result = service.verify("F001", "ABACA-002", verifier);
            assertNotNull(result.getVerifiedBy(), "合法复核必须 setVerifiedBy");
            assertNotNull(result.getVerifiedAt(), "合法复核必须 setVerifiedAt");
        }

        @Test
        @DisplayName("verify(): 跨工厂 (F001 user 调 F002 log) → BusinessException 不存在或无权访问")
        void verify_factoryIsolated() {
            // F002 的 log 在 F001 工厂上下文不可见 — repo findByIdAndFactoryId 返回 empty
            when(abacaRepo.findByIdAndFactoryId("ABACA-F002-001", "F001"))
                    .thenReturn(Optional.empty());

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.verify("F001", "ABACA-F002-001", 1001L),
                    "跨工厂访问必须被 service 层拒绝 — factory 隔离不变量");
            assertTrue(ex.getMessage().contains("不存在") || ex.getMessage().contains("无权"),
                    "跨工厂异常文案应包含'不存在'或'无权', 实际: " + ex.getMessage());
        }

        @Test
        @DisplayName("softDelete(): 已复核记录 → BusinessException 拒删")
        void softDelete_rejectsVerifiedRecord() {
            AbacaQuantityLog entry = new AbacaQuantityLog();
            entry.setId("ABACA-003");
            entry.setFactoryId("F001");
            entry.setWeighedBy(1001L);
            entry.setVerifiedBy(1002L);
            entry.setVerifiedAt(java.time.LocalDateTime.now());  // isVerified()=true
            lenient().when(abacaRepo.findByIdAndFactoryId("ABACA-003", "F001"))
                    .thenReturn(Optional.of(entry));

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> service.softDelete("F001", "ABACA-003"),
                    "已复核记录不可删除 — 历史一致性");
            assertTrue(ex.getMessage().contains("已复核") || ex.getMessage().contains("不可删除"),
                    "已复核拒删异常文案应包含'已复核'或'不可删除', 实际: " + ex.getMessage());
        }
    }
}
