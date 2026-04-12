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
        List<String> columns = new ArrayList<>(List.of("parent_id"));
        List<Object> values = new ArrayList<>(List.of(parentId));
        List<String> placeholders = new ArrayList<>(List.of("CAST(? AS uuid)"));

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String colName = entry.getKey().startsWith("cf_") ? entry.getKey() : "cf_" + entry.getKey();
            columns.add(colName);
            values.add(entry.getValue());
            placeholders.add("?");
        }

        String sql = "INSERT INTO " + subTableName + " (" + String.join(", ", columns) + ") VALUES (" + String.join(", ", placeholders) + ") RETURNING *";
        return jdbcTemplate.queryForMap(sql, values.toArray());
    }

    public void updateRow(String subTableName, String rowId, Map<String, Object> row) {
        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        for (Map.Entry<String, Object> entry : row.entrySet()) {
            String colName = entry.getKey().startsWith("cf_") ? entry.getKey() : "cf_" + entry.getKey();
            setClauses.add(colName + " = ?");
            params.add(entry.getValue());
        }
        setClauses.add("updated_at = NOW()");
        params.add(rowId);

        String sql = "UPDATE " + subTableName + " SET " + String.join(", ", setClauses) + " WHERE id = ?::uuid";
        jdbcTemplate.update(sql, params.toArray());
    }

    public void deleteRow(String subTableName, String rowId) {
        jdbcTemplate.update("DELETE FROM " + subTableName + " WHERE id = ?::uuid", rowId);
    }
}
