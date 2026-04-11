package com.cretas.aims.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class AggregateFormulaExecutor {

    private final JdbcTemplate jdbcTemplate;
    private final DDLExecutor ddlExecutor;

    private static final Pattern GROUP_BY_PATTERN =
        Pattern.compile("GROUP_BY\\(\\s*(\\w+)\\s*,\\s*'(\\w+)'\\s*,\\s*(\\w+)\\(\\s*'(\\w+)'\\s*\\)\\s*\\)");

    /** Round 4 Fix P1-15: RATIO(table, 'groupField', 'numeratorField', 'denominatorField')
     *  Computes SUM(numerator) / SUM(denominator) * 100 per group.
     *  Use case: BOM 达成率 = SUM(cf_actual) / SUM(cf_theory) * 100. */
    private static final Pattern RATIO_PATTERN =
        Pattern.compile("RATIO\\(\\s*(\\w+)\\s*,\\s*'(\\w+)'\\s*,\\s*'(\\w+)'\\s*,\\s*'(\\w+)'\\s*\\)");

    public List<Map<String, Object>> execute(String expression, Map<String, Object> context) {
        String expr = expression.trim();

        // Try RATIO first (bigger pattern) — Round 4 Fix P1-15
        Matcher ratioM = RATIO_PATTERN.matcher(expr);
        if (ratioM.matches()) {
            return executeRatio(ratioM, context);
        }

        Matcher m = GROUP_BY_PATTERN.matcher(expr);
        if (!m.matches()) {
            log.warn("Unsupported aggregate expression: {}", expression);
            return List.of();
        }

        String sourceTable = m.group(1);
        String groupField = m.group(2);
        String aggFunc = m.group(3).toUpperCase();
        String valueField = m.group(4);

        if (!Set.of("SUM", "COUNT", "AVG", "MIN", "MAX").contains(aggFunc)) {
            log.warn("Unsupported aggregate function: {}", aggFunc);
            return List.of();
        }

        String tableName = ddlExecutor.resolveTable(sourceTable);
        if (sourceTable.endsWith("_items")) {
            tableName = sourceTable;
        }

        String parentId = (String) context.get("parentId");
        String factoryId = (String) context.get("factoryId");

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(groupField).append(", ").append(aggFunc).append("(").append(valueField).append(") as agg_value");
        sql.append(" FROM ").append(tableName);

        List<Object> params = new ArrayList<>();
        List<String> wheres = new ArrayList<>();
        if (parentId != null) {
            if (hasColumn(tableName, "parent_id")) {
                wheres.add("parent_id = ?::uuid");
                params.add(parentId);
            } else if (hasColumn(tableName, "order_id")) {
                wheres.add("order_id = ?::uuid");
                params.add(parentId);
            }
        }
        if (factoryId != null && hasColumn(tableName, "factory_id")) {
            wheres.add("factory_id = ?");
            params.add(factoryId);
        }

        if (!wheres.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", wheres));
        }
        sql.append(" GROUP BY ").append(groupField);

        log.debug("Aggregate SQL: {} params: {}", sql, params);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    /** Round 4 Fix P1-15: RATIO execution — SUM(a)/SUM(b)*100 per group */
    private List<Map<String, Object>> executeRatio(Matcher m, Map<String, Object> context) {
        String sourceTable = m.group(1);
        String groupField = m.group(2);
        String numField = m.group(3);
        String denField = m.group(4);

        String tableName = ddlExecutor.resolveTable(sourceTable);
        if (sourceTable.endsWith("_items")) {
            tableName = sourceTable;
        }

        String parentId = (String) context.get("parentId");
        String factoryId = (String) context.get("factoryId");

        // PostgreSQL: NULLIF protects against divide-by-zero
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(groupField)
           .append(", SUM(").append(numField).append(") as numerator")
           .append(", SUM(").append(denField).append(") as denominator")
           .append(", ROUND(SUM(").append(numField).append(")::numeric / NULLIF(SUM(").append(denField).append("), 0)::numeric * 100, 2) as ratio_pct")
           .append(" FROM ").append(tableName);

        List<Object> params = new ArrayList<>();
        List<String> wheres = new ArrayList<>();
        if (parentId != null) {
            if (hasColumn(tableName, "parent_id")) {
                wheres.add("parent_id = ?::uuid");
                params.add(parentId);
            } else if (hasColumn(tableName, "order_id")) {
                wheres.add("order_id = ?::uuid");
                params.add(parentId);
            }
        }
        if (factoryId != null && hasColumn(tableName, "factory_id")) {
            wheres.add("factory_id = ?");
            params.add(factoryId);
        }
        if (!wheres.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", wheres));
        }
        sql.append(" GROUP BY ").append(groupField);

        log.debug("Ratio SQL: {} params: {}", sql, params);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    private boolean hasColumn(String tableName, String columnName) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
                Integer.class, tableName, columnName);
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
