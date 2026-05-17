package com.cretas.aims.service.auth.impl;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.entity.auth.PermissionRegistry;
import com.cretas.aims.entity.auth.PermissionRegistry.Source;
import com.cretas.aims.repository.auth.PermissionRegistryRepository;
import com.cretas.aims.service.auth.PermissionRegistryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.stereotype.Controller;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * {@link PermissionRegistryService} 实现 — 反射扫描 {@code @RequirePermission}。
 *
 * <p>扫描范围:
 * <ul>
 *   <li>所有 {@code @RestController} bean</li>
 *   <li>所有 {@code @Controller} bean</li>
 *   <li>class-level + method-level {@code @RequirePermission}</li>
 * </ul>
 *
 * <p>启动时机:{@link ApplicationReadyEvent} (Spring Boot 全部 bean 就绪)。
 * 也可通过 admin API 手动触发 {@link #scanAndRegister()}。
 *
 * @since 2026-05-24
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionRegistryServiceImpl implements PermissionRegistryService {

    private final ApplicationContext applicationContext;
    private final PermissionRegistryRepository registryRepository;

    /**
     * Spring Boot 全部 bean 就绪后自动扫描注册。
     * 失败不阻断启动 (catch + log)。
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            ScanResult result = scanAndRegister();
            log.info("[PermissionRegistry] 启动扫描完成: classes={}, methods={}, " +
                    "registered={}, updated={}, skipped={}, errors={}",
                    result.scannedClasses(), result.scannedMethods(),
                    result.registeredPermissions(), result.updatedPermissions(),
                    result.skippedPermissions(), result.errors().size());
        } catch (Exception e) {
            log.error("[PermissionRegistry] 启动扫描失败 (非致命): {}", e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public ScanResult scanAndRegister() {
        Set<Object> controllers = new HashSet<>();
        controllers.addAll(applicationContext.getBeansWithAnnotation(RestController.class).values());
        controllers.addAll(applicationContext.getBeansWithAnnotation(Controller.class).values());

        int scannedClasses = 0;
        int scannedMethods = 0;
        int registered = 0;
        int updated = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (Object controller : controllers) {
            Class<?> targetClass = unwrapProxy(controller.getClass());
            scannedClasses++;

            // class-level @RequirePermission
            RequirePermission classAnn = AnnotationUtils.findAnnotation(targetClass, RequirePermission.class);
            if (classAnn != null) {
                for (String code : classAnn.value()) {
                    try {
                        UpsertResult r = upsert(code, targetClass.getName(), "<class-level>");
                        switch (r) {
                            case REGISTERED -> registered++;
                            case UPDATED    -> updated++;
                            case SKIPPED    -> skipped++;
                        }
                    } catch (Exception e) {
                        errors.add(formatError(targetClass, "<class>", code, e));
                    }
                }
            }

            // method-level @RequirePermission
            for (Method method : targetClass.getDeclaredMethods()) {
                RequirePermission methodAnn = AnnotationUtils.findAnnotation(method, RequirePermission.class);
                if (methodAnn == null) continue;

                scannedMethods++;
                for (String code : methodAnn.value()) {
                    try {
                        UpsertResult r = upsert(code, targetClass.getName(), method.getName());
                        switch (r) {
                            case REGISTERED -> registered++;
                            case UPDATED    -> updated++;
                            case SKIPPED    -> skipped++;
                        }
                    } catch (Exception e) {
                        errors.add(formatError(targetClass, method.getName(), code, e));
                    }
                }
            }
        }

        return new ScanResult(scannedClasses, scannedMethods, registered, updated, skipped, errors);
    }

    /**
     * 单条权限 upsert。
     * <ul>
     *   <li>不存在 → INSERT 新行 (source=ANNOTATION)</li>
     *   <li>已存在且 source=ANNOTATION → UPDATE source_class / source_method</li>
     *   <li>已存在且 source=MANUAL or SEED → SKIP (不覆盖手动 / 种子来源)</li>
     * </ul>
     */
    private UpsertResult upsert(String permissionCode, String sourceClass, String sourceMethod) {
        if (permissionCode == null || permissionCode.isBlank()) {
            return UpsertResult.SKIPPED;
        }
        String code = permissionCode.trim();

        // module:action split
        String module;
        String action;
        int colonIdx = code.indexOf(':');
        if (colonIdx > 0 && colonIdx < code.length() - 1) {
            module = code.substring(0, colonIdx);
            action = code.substring(colonIdx + 1);
        } else {
            // 不规范 — 退化处理,module=action=code
            module = code;
            action = code;
        }

        Optional<PermissionRegistry> existing =
                registryRepository.findByPermissionCodeAndFactoryIdIsNull(code);

        if (existing.isPresent()) {
            PermissionRegistry row = existing.get();
            if (row.getSource() != Source.ANNOTATION) {
                // 手动 / 种子来源,不覆盖
                return UpsertResult.SKIPPED;
            }
            // 更新 source_class / source_method (注解迁移到了别的 controller)
            boolean changed = false;
            if (!sourceClass.equals(row.getSourceClass())) {
                row.setSourceClass(sourceClass);
                changed = true;
            }
            if (!sourceMethod.equals(row.getSourceMethod())) {
                row.setSourceMethod(sourceMethod);
                changed = true;
            }
            if (changed) {
                registryRepository.save(row);
                return UpsertResult.UPDATED;
            }
            return UpsertResult.SKIPPED;
        }

        PermissionRegistry row = PermissionRegistry.builder()
                .permissionCode(code)
                .module(module)
                .action(action)
                .source(Source.ANNOTATION)
                .sourceClass(sourceClass)
                .sourceMethod(sourceMethod)
                .isActive(true)
                .build();
        registryRepository.save(row);
        return UpsertResult.REGISTERED;
    }

    @Override
    public List<PermissionRegistry> listAllActive() {
        return registryRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .toList();
    }

    @Override
    public List<PermissionRegistry> listByModule(String module) {
        return registryRepository.findByModuleOrderByActionAsc(module);
    }

    @Override
    public List<PermissionRegistry> listBySource(Source source) {
        return registryRepository.findBySource(source);
    }

    @Override
    public List<String> listModules() {
        return registryRepository.findDistinctModules();
    }

    @Override
    public Map<String, Object> auditSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalActive", listAllActive().size());

        Map<String, Long> bySource = new LinkedHashMap<>();
        for (Source s : Source.values()) {
            bySource.put(s.name(), registryRepository.countBySource(s));
        }
        summary.put("bySource", bySource);

        List<String> modules = listModules();
        summary.put("modules", modules);
        summary.put("moduleCount", modules.size());

        // per-module count
        Map<String, Integer> byModule = new HashMap<>();
        for (String m : modules) {
            byModule.put(m, listByModule(m).size());
        }
        summary.put("byModule", byModule);

        return summary;
    }

    // ==================== helpers ====================

    /** Spring CGLIB proxy 拆包,拿真正的 user class. */
    private Class<?> unwrapProxy(Class<?> proxyClass) {
        Class<?> current = proxyClass;
        while (current.getName().contains("$$") && current.getSuperclass() != null) {
            current = current.getSuperclass();
        }
        return current;
    }

    private String formatError(Class<?> clazz, String method, String code, Exception e) {
        return String.format("%s#%s [%s]: %s", clazz.getSimpleName(), method, code, e.getMessage());
    }

    private enum UpsertResult { REGISTERED, UPDATED, SKIPPED }
}
