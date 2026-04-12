package com.cretas.aims.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicTableService {

    private final JdbcTemplate jdbcTemplate;
    private final DDLExecutor ddlExecutor;

    private static final java.util.regex.Pattern COLUMN_NAME_PATTERN =
        java.util.regex.Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]{0,60}$");
    private static final java.util.regex.Pattern TABLE_NAME_PATTERN =
        java.util.regex.Pattern.compile("^[a-z][a-z0-9_]{2,80}$");

    /** Validate table name to prevent SQL injection from any caller (not just controllers). */
    private static void validateTableName(String tableName) {
        if (tableName == null || !TABLE_NAME_PATTERN.matcher(tableName).matches()) {
            throw new IllegalArgumentException("非法表名: " + tableName);
        }
    }

    /** Validate and normalize a user-supplied column key to a safe SQL column name. */
    private static String safeColumnName(String key) {
        String colName = key.startsWith("cf_") ? key : "cf_" + key;
        if (!COLUMN_NAME_PATTERN.matcher(colName).matches()) {
            throw new IllegalArgumentException("非法列名: " + key);
        }
        return colName;
    }

    /**
     * Verify that the parent record belongs to the given factory.
     * Prevents cross-tenant sub-table access.
     */
    public void verifyParentOwnership(String moduleCode, String parentId, String factoryId) {
        String parentTable = ddlExecutor.resolveTable(moduleCode);
        validateTableName(parentTable);
        // Check if parent table has factory_id column before using it in the query.
        // Some tables (e.g. global config tables) may not have tenant scoping.
        boolean hasTenantCol;
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = 'factory_id'",
                Integer.class, parentTable);
            hasTenantCol = count != null && count > 0;
        } catch (Exception e) {
            log.warn("Cannot check factory_id column for {}: {}", parentTable, e.getMessage());
            hasTenantCol = false;
        }
        if (!hasTenantCol) {
            // Table has no factory_id — verify record exists at minimum
            Integer exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + parentTable + " WHERE id::text = ?",
                Integer.class, parentId);
            if (exists == null || exists == 0) {
                throw new com.cretas.aims.exception.BusinessException(
                    "记录不存在: " + moduleCode + "/" + parentId);
            }
            return;
        }
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM " + parentTable + " WHERE id::text = ? AND factory_id = ?",
            Integer.class, parentId, factoryId);
        if (count == null || count == 0) {
            throw new com.cretas.aims.exception.BusinessException(
                "记录不属于当前工厂或不存在: " + moduleCode + "/" + parentId);
        }
    }

    public List<Map<String, Object>> getRows(String subTableName, String parentId) {
        return getRows(subTableName, parentId, null);
    }

    /**
     * Round 4 Fix P1-13: filter support for sub-table rows.
     *
     * filters map values:
     *   cf_xxx  : equality (becomes "cf_xxx = ?")
     *   dateFrom: inclusive from created_at (becomes "created_at >= ?")
     *   dateTo  : inclusive until created_at (becomes "created_at <= ?")
     *   limit   : max rows (becomes LIMIT N)
     *
     * Column names are validated against a whitelist regex to prevent SQL injection.
     */
    public List<Map<String, Object>> getRows(String subTableName, String parentId, Map<String, Object> filters) {
        validateTableName(subTableName);
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(subTableName)
                .append(" WHERE parent_id = ?::uuid");
        List<Object> params = new ArrayList<>();
        params.add(parentId);

        Integer limit = null;
        if (filters != null) {
            for (Map.Entry<String, Object> entry : filters.entrySet()) {
                String key = entry.getKey();
                Object value = entry.getValue();
                if (value == null || key == null) continue;

                if ("dateFrom".equals(key)) {
                    sql.append(" AND created_at >= ?");
                    params.add(value);
                } else if ("dateTo".equals(key)) {
                    sql.append(" AND created_at <= ?");
                    params.add(value);
                } else if ("limit".equals(key)) {
                    try { limit = Integer.parseInt(value.toString()); } catch (NumberFormatException ignored) {}
                } else if (key.matches("^[a-zA-Z_][a-zA-Z0-9_]{0,60}$")) {
                    // safe column name
                    String colName = key.startsWith("cf_") ? key : "cf_" + key;
                    sql.append(" AND ").append(colName).append(" = ?");
                    params.add(value);
                } else {
                    log.warn("Rejected suspicious sub-table filter key: {}", key);
                }
            }
        }

        sql.append(" ORDER BY created_at");
        if (limit != null && limit > 0 && limit <= 1000) {
            sql.append(" LIMIT ").append(limit);
        }
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    public Map<String, Object> addRow(String subTableName, String parentId, Map<String, Object> row) {
        validateTableName(subTableName);
        List<String> columns = new ArrayList<>(List.of("parent_id"));
        List<Object> values = new ArrayList<>(List.of(parentId));
        List<String> placeholders = new ArrayList<>(List.of("?::uuid"));

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            columns.add(safeColumnName(entry.getKey()));
            values.add(entry.getValue());
            placeholders.add("?");
        }

        String sql = "INSERT INTO " + subTableName + " (" + String.join(", ", columns) + ") VALUES (" + String.join(", ", placeholders) + ") RETURNING *";
        return jdbcTemplate.queryForMap(sql, values.toArray());
    }

    public void updateRow(String subTableName, String parentId, String rowId, Map<String, Object> row) {
        validateTableName(subTableName);
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            setClauses.add(safeColumnName(entry.getKey()) + " = ?");
            params.add(entry.getValue());
        }
        setClauses.add("updated_at = NOW()");
        params.add(rowId);
        params.add(parentId);

        String sql = "UPDATE " + subTableName + " SET " + String.join(", ", setClauses)
            + " WHERE id = ?::uuid AND parent_id = ?::uuid";
        jdbcTemplate.update(sql, params.toArray());
    }

    public void deleteRow(String subTableName, String parentId, String rowId) {
        validateTableName(subTableName);
        jdbcTemplate.update("DELETE FROM " + subTableName + " WHERE id = ?::uuid AND parent_id = ?::uuid",
            rowId, parentId);
    }
}
