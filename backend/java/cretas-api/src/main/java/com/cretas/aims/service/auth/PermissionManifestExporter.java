package com.cretas.aims.service.auth;

import com.cretas.aims.entity.auth.PermissionRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * 权限 manifest 导出器 (Sprint 4 Wave 2 Chat J — C-CHECKPOWER-1).
 *
 * <p>把 permission_registry 表内容序列化为分层 JSON 结构,便于:
 * <ul>
 *   <li>运维 / 合规审计 — diff 不同环境 / 不同版本的权限矩阵</li>
 *   <li>前端 admin 界面渲染权限树</li>
 *   <li>导出后离线分析 (e.g. 哪些 module 权限最多,哪些 action 类型最常见)</li>
 * </ul>
 *
 * <p>输出形态:
 * <pre>
 * {
 *   "exportedAt": "2026-05-24T12:34:56",
 *   "totalCount": 1591,
 *   "summary": { ... auditSummary() output ... },
 *   "modules": {
 *     "production": [
 *       { "code": "production:read",  "action": "read",  "source": "ANNOTATION", ... },
 *       { "code": "production:write", "action": "write", "source": "ANNOTATION", ... }
 *     ],
 *     "quality": [ ... ]
 *   }
 * }
 * </pre>
 *
 * @since 2026-05-24
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PermissionManifestExporter {

    private final PermissionRegistryService registryService;

    /** 导出完整 manifest (跨 module 聚合). */
    public Map<String, Object> exportFullManifest() {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("exportedAt", LocalDateTime.now().toString());

        List<PermissionRegistry> all = registryService.listAllActive();
        manifest.put("totalCount", all.size());
        manifest.put("summary", registryService.auditSummary());

        // group by module, 排序: module 字母序, 内部 action 字母序
        Map<String, List<Map<String, Object>>> byModule = new TreeMap<>();
        for (PermissionRegistry p : all) {
            byModule
                .computeIfAbsent(p.getModule(), k -> new java.util.ArrayList<>())
                .add(toManifestEntry(p));
        }
        for (List<Map<String, Object>> list : byModule.values()) {
            list.sort(Comparator.comparing(m -> (String) m.get("code")));
        }
        manifest.put("modules", byModule);

        return manifest;
    }

    /** 导出指定 module 的权限. */
    public Map<String, Object> exportModule(String module) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("module", module);
        result.put("exportedAt", LocalDateTime.now().toString());

        List<Map<String, Object>> entries = registryService.listByModule(module).stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .map(this::toManifestEntry)
                .sorted(Comparator.comparing(m -> (String) m.get("code")))
                .collect(Collectors.toList());

        result.put("count", entries.size());
        result.put("entries", entries);
        return result;
    }

    private Map<String, Object> toManifestEntry(PermissionRegistry p) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("code",         p.getPermissionCode());
        entry.put("module",       p.getModule());
        entry.put("action",       p.getAction());
        entry.put("description",  p.getDescription());
        entry.put("source",       p.getSource() == null ? null : p.getSource().name());
        entry.put("sourceClass",  p.getSourceClass());
        entry.put("sourceMethod", p.getSourceMethod());
        entry.put("factoryId",    p.getFactoryId());
        entry.put("isActive",     p.getIsActive());
        return entry;
    }
}
