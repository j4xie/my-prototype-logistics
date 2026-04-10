package com.cretas.aims.engine;

import com.cretas.aims.entity.config.CanvasDynamicField;
import com.cretas.aims.repository.config.CanvasDynamicFieldRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicFieldService {

    private final JdbcTemplate jdbcTemplate;
    private final CanvasDynamicFieldRepository fieldRepo;
    private final DDLExecutor ddlExecutor;

    private final Map<String, List<CanvasDynamicField>> cache = new ConcurrentHashMap<>();

    public List<CanvasDynamicField> getActiveFields(String factoryId, String moduleCode) {
        String key = factoryId + ":" + moduleCode;
        return cache.computeIfAbsent(key, k ->
            fieldRepo.findActiveByModuleCodeForFactory(factoryId, moduleCode));
    }

    public void refreshCache() {
        cache.clear();
        log.info("DynamicFieldService cache cleared");
    }

    public void refreshCache(String factoryId, String moduleCode) {
        cache.remove(factoryId + ":" + moduleCode);
    }

    /**
     * Determine whether the id column of a given table is UUID or VARCHAR.
     * Canvas V3 supports both because different modules use different id types:
     * - sales_orders.id: VARCHAR (legacy)
     * - bom_items.id: BIGINT
     * - canvas_dynamic_field.id: UUID
     * We query information_schema once per table and cache the result.
     */
    private final Map<String, String> idTypeCache = new ConcurrentHashMap<>();

    private String getIdColumnType(String tableName) {
        return idTypeCache.computeIfAbsent(tableName, t -> {
            try {
                String type = jdbcTemplate.queryForObject(
                    "SELECT data_type FROM information_schema.columns " +
                    "WHERE table_name = ? AND column_name = 'id'",
                    String.class, t);
                return type != null ? type.toLowerCase() : "character varying";
            } catch (Exception e) {
                log.warn("Could not determine id type for table {}, defaulting to text", t);
                return "character varying";
            }
        });
    }

    /** Build the id WHERE clause fragment appropriate for the id column type. */
    private String idWhereClause(String tableName) {
        String type = getIdColumnType(tableName);
        if (type.contains("uuid")) return "WHERE id = ?::uuid";
        if (type.contains("bigint") || type.contains("integer")) return "WHERE id = ?";
        return "WHERE id = ?"; // varchar/text — PostgreSQL auto-casts string literal
    }

    public Map<String, Object> getDynamicFields(String factoryId, String moduleCode, String recordId) {
        List<CanvasDynamicField> fields = getActiveFields(factoryId, moduleCode);
        if (fields.isEmpty()) return Map.of();

        String tableName = ddlExecutor.resolveTable(moduleCode);
        List<String> columns = fields.stream()
            .filter(f -> !"SUB_TABLE".equals(f.getFieldType()))
            .map(CanvasDynamicField::getColumnName)
            .collect(Collectors.toList());

        if (columns.isEmpty()) return Map.of();

        String sql = "SELECT " + String.join(", ", columns) + " FROM " + tableName + " " + idWhereClause(tableName);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(sql, recordId);
            Map<String, Object> result = new LinkedHashMap<>();
            for (CanvasDynamicField f : fields) {
                if (!"SUB_TABLE".equals(f.getFieldType()) && row.containsKey(f.getColumnName())) {
                    result.put(f.getFieldCode(), row.get(f.getColumnName()));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to read dynamic fields for {}/{}: {}", moduleCode, recordId, e.getMessage());
            return Map.of();
        }
    }

    public void setDynamicFields(String factoryId, String moduleCode, String recordId, Map<String, Object> fields) {
        if (fields == null || fields.isEmpty()) return;
        List<CanvasDynamicField> activeDefs = getActiveFields(factoryId, moduleCode);
        Map<String, CanvasDynamicField> defMap = activeDefs.stream()
            .collect(Collectors.toMap(CanvasDynamicField::getFieldCode, f -> f));

        String tableName = ddlExecutor.resolveTable(moduleCode);
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        for (Map.Entry<String, Object> entry : fields.entrySet()) {
            CanvasDynamicField def = defMap.get(entry.getKey());
            if (def != null && !"SUB_TABLE".equals(def.getFieldType())) {
                setClauses.add(def.getColumnName() + " = ?");
                params.add(entry.getValue());
            }
        }

        if (setClauses.isEmpty()) return;
        params.add(recordId);
        String sql = "UPDATE " + tableName + " SET " + String.join(", ", setClauses) + " " + idWhereClause(tableName);
        jdbcTemplate.update(sql, params.toArray());
    }
}
