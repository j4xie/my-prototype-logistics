package com.cretas.aims.service.datacenter.impl;

import com.alibaba.excel.EasyExcel;
import com.cretas.aims.entity.datacenter.ImportRule;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Import commit 阶段执行器 — 用反射把 dryrun 阶段 mapped rows 写入 {@code rule.targetEntity}.
 *
 * <p>Sprint 4 Chat K C-IMPORT-CENTER-1.
 *
 * <p>失败行通过 {@link #exportErrorRows} 反向导出为 Excel,供用户修正后重新 dryrun.
 *
 * <p>简化决定 (v1):
 * <ul>
 *   <li>不做 dedup 实际查询 — dedup_strategy 仅用于元数据记录, 真实 dedup 由 DB 唯一约束兜底.</li>
 *   <li>字段类型转换仅支持 String / Long / Integer / Boolean / BigDecimal — 其他类型 fallback 给
 *       ObjectMapper.convertValue.</li>
 *   <li>每行单独 try-catch, 单行失败不阻塞其他行写入.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImportCommitter {

    @PersistenceContext
    private EntityManager em;

    private final ObjectMapper objectMapper;

    public static class CommitResult {
        public final int committedRows;
        public final List<Map<String, Object>> commitErrors;

        CommitResult(int committedRows, List<Map<String, Object>> commitErrors) {
            this.committedRows = committedRows;
            this.commitErrors = commitErrors;
        }
    }

    /**
     * 重新解析 Excel + 反射写入 target entity. 必须在 @Transactional 上下文中调用.
     *
     * @param rule        导入规则 (含 targetEntity 全限定类名)
     * @param excelFile   dryrun 时已落盘的 Excel
     * @param factoryId   工厂 ID (会强行 set 到 entity 的 factoryId 字段, 防越权)
     */
    @Transactional
    public CommitResult commit(ImportRule rule, File excelFile, String factoryId) throws Exception {
        Class<?> entityClass = Class.forName(rule.getTargetEntity());

        // 重新解析 Excel (与 dryrun 一致). 用 ImportExecutor.readExcel 同样的 ReadListener
        // 这里 inline 避免循环依赖.
        try (InputStream in = Files.newInputStream(excelFile.toPath())) {
            List<Map<String, Object>> rawRows = readExcel(in);
            List<Map<String, Object>> mapped = mapToEntityFields(rule, rawRows);

            int committed = 0;
            List<Map<String, Object>> errors = new ArrayList<>();
            for (int i = 0; i < mapped.size(); i++) {
                try {
                    Object entity = entityClass.getDeclaredConstructor().newInstance();
                    populateFields(entity, mapped.get(i));
                    forceFactoryId(entity, factoryId);
                    em.persist(entity);
                    committed++;
                } catch (Exception ex) {
                    Map<String, Object> err = new LinkedHashMap<>();
                    err.put("row", i + 2);
                    err.put("msg", "写入失败: " + ex.getMessage());
                    errors.add(err);
                    log.warn("[ImportCommitter] row {} write failed: {}", i + 2, ex.getMessage());
                }
            }
            // batch flush — 任意单行抛后 outer @Transactional 会回滚, 这里不主动 flush 让 Spring 处理.
            return new CommitResult(committed, errors);
        }
    }

    /**
     * 反向导出失败行为 Excel (3 列: row / col / msg). 供用户修正后 re-dryrun.
     *
     * @return 生成文件的绝对路径
     */
    public String exportErrorRows(List<Map<String, Object>> errors, String jobId) throws Exception {
        File tmpDir = new File(System.getProperty("java.io.tmpdir"), "cretas/import-errors");
        if (!tmpDir.exists() && !tmpDir.mkdirs()) {
            throw new IllegalStateException("无法创建 import-errors 目录: " + tmpDir.getAbsolutePath());
        }
        File out = new File(tmpDir, jobId + ".xlsx");

        List<List<String>> head = List.of(List.of("行号"), List.of("列"), List.of("错误"));
        List<List<Object>> data = new ArrayList<>(errors.size());
        for (Map<String, Object> e : errors) {
            List<Object> r = new ArrayList<>(3);
            r.add(e.get("row"));
            r.add(e.get("col"));
            r.add(e.get("msg"));
            data.add(r);
        }
        EasyExcel.write(out).head(head).sheet("失败行").doWrite(data);
        return out.getAbsolutePath();
    }

    /** Reuse ImportExecutor 同款 read 逻辑 — 调 static helper 而非依赖 bean 防止循环. */
    static List<Map<String, Object>> readExcel(InputStream stream) {
        return ImportExecutor.readExcel(stream);
    }

    /** Map raw 表头 → entity 字段 (按 rule.mapping). */
    static List<Map<String, Object>> mapToEntityFields(ImportRule rule, List<Map<String, Object>> rawRows) {
        List<Map<String, Object>> result = new ArrayList<>(rawRows.size());
        for (Map<String, Object> raw : rawRows) {
            Map<String, Object> entityMap = new LinkedHashMap<>();
            for (Map<String, Object> col : rule.getMapping()) {
                String excelCol = String.valueOf(col.get("excelCol"));
                String entityField = String.valueOf(col.get("entityField"));
                entityMap.put(entityField, raw.get(excelCol));
            }
            result.add(entityMap);
        }
        return result;
    }

    /** Setter-based field population. 优先 setter, fallback direct field. */
    void populateFields(Object entity, Map<String, Object> fields) throws Exception {
        Class<?> clazz = entity.getClass();
        for (Map.Entry<String, Object> e : fields.entrySet()) {
            String field = e.getKey();
            Object value = e.getValue();
            if (value == null) continue;
            String setter = "set" + Character.toUpperCase(field.charAt(0)) + field.substring(1);
            Method setterMethod = findSetter(clazz, setter);
            if (setterMethod != null) {
                Object coerced = coerce(value, setterMethod.getParameterTypes()[0]);
                setterMethod.invoke(entity, coerced);
            } else {
                Field f = findField(clazz, field);
                if (f != null) {
                    f.setAccessible(true);
                    f.set(entity, coerce(value, f.getType()));
                } else {
                    log.warn("[ImportCommitter] entity {} 未找到字段或 setter: {}", clazz.getSimpleName(), field);
                }
            }
        }
    }

    /** 强制写入 factoryId — 防越权 (即使 Excel 数据带了其他 factoryId 也会被覆盖). */
    void forceFactoryId(Object entity, String factoryId) {
        try {
            Field f = findField(entity.getClass(), "factoryId");
            if (f != null) {
                f.setAccessible(true);
                f.set(entity, factoryId);
            }
        } catch (Exception ex) {
            log.warn("[ImportCommitter] 设置 factoryId 失败: {}", ex.getMessage());
        }
    }

    /** Walk superclass chain to find declared field. */
    static Field findField(Class<?> clazz, String name) {
        for (Class<?> c = clazz; c != null && c != Object.class; c = c.getSuperclass()) {
            try {
                return c.getDeclaredField(name);
            } catch (NoSuchFieldException ignore) {
                // continue
            }
        }
        return null;
    }

    /** Walk to find single-param setter (just by name; takes first match). */
    static Method findSetter(Class<?> clazz, String setterName) {
        for (Class<?> c = clazz; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                if (m.getName().equals(setterName) && m.getParameterCount() == 1) {
                    return m;
                }
            }
        }
        return null;
    }

    /** Type coercion. 简单类型直接, 复杂类型 fallback Jackson convertValue. */
    Object coerce(Object value, Class<?> targetType) {
        if (value == null) return null;
        if (targetType.isInstance(value)) return value;
        String s = value.toString().trim();
        if (s.isEmpty()) return null;
        try {
            if (targetType == String.class) return s;
            if (targetType == Long.class || targetType == long.class) return Long.parseLong(s);
            if (targetType == Integer.class || targetType == int.class) return Integer.parseInt(s);
            if (targetType == Double.class || targetType == double.class) return Double.parseDouble(s);
            if (targetType == java.math.BigDecimal.class) return new java.math.BigDecimal(s);
            if (targetType == Boolean.class || targetType == boolean.class) {
                return "true".equalsIgnoreCase(s) || "1".equals(s) || "yes".equalsIgnoreCase(s)
                        || "是".equals(s);
            }
            return objectMapper.convertValue(value, targetType);
        } catch (Exception ex) {
            log.warn("[ImportCommitter] coerce {} → {} 失败: {}", value, targetType.getSimpleName(), ex.getMessage());
            return null;
        }
    }
}
