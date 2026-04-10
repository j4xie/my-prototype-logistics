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
        String sql = "SELECT * FROM " + subTableName + " WHERE parent_id = ?::uuid ORDER BY created_at";
        return jdbcTemplate.queryForList(sql, parentId);
    }

    public Map<String, Object> addRow(String subTableName, String parentId, Map<String, Object> row) {
        List<String> columns = new ArrayList<>(List.of("parent_id"));
        List<Object> values = new ArrayList<>(List.of(parentId));
        List<String> placeholders = new ArrayList<>(List.of("?::uuid"));

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
