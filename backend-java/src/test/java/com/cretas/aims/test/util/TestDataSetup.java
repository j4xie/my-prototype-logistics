package com.cretas.aims.test.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 测试数据准备工具类
 *
 * 用途：执行测试数据的准备、清理和验证
 *
 * 使用示例：
 * <pre>
 * {@code
 * // 准备测试数据
 * String setupSql = "INSERT INTO material_batches (batch_number, material_type_id) VALUES ('B001', 'MT001')";
 * testDataSetup.setupTestData(setupSql);
 *
 * // 查询验证
 * int count = testDataSetup.getCount("material_batches", "batch_number = 'B001'");
 * assertEquals(1, count);
 *
 * // 清理数据
 * String cleanupSql = "DELETE FROM material_batches WHERE batch_number = 'B001'";
 * testDataSetup.cleanupTestData(cleanupSql);
 * }
 * </pre>
 *
 * @author Claude
 * @version 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TestDataSetup {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 执行测试数据准备SQL
     *
     * 支持执行多条SQL语句（用分号分隔）
     * 所有SQL在同一事务中执行，失败会回滚
     *
     * @param sql SQL语句，可以包含多条（用分号分隔）
     * @throws RuntimeException 如果SQL执行失败
     */
    @Transactional
    public void setupTestData(String sql) {
        if (sql == null || sql.trim().isEmpty()) {
            log.debug("No setup SQL to execute");
            return;
        }

        log.info("Executing test data setup SQL");

        // 分割多条SQL语句
        String[] statements = splitSqlStatements(sql);

        for (String stmt : statements) {
            String trimmed = stmt.trim();
            if (!trimmed.isEmpty()) {
                try {
                    log.debug("Executing SQL: {}", trimmed);
                    jdbcTemplate.execute(trimmed);
                    log.debug("SQL executed successfully");
                } catch (Exception e) {
                    log.error("Failed to execute SQL: {}", trimmed, e);
                    throw new RuntimeException("Failed to setup test data: " + e.getMessage(), e);
                }
            }
        }

        log.info("Test data setup completed successfully");
    }

    /**
     * 清理测试数据
     *
     * 与setupTestData类似，但在清理失败时不会抛出异常
     * 适用于测试清理场景，即使清理失败也不影响测试结果
     *
     * @param cleanupSql 清理SQL语句
     */
    @Transactional
    public void cleanupTestData(String cleanupSql) {
        if (cleanupSql == null || cleanupSql.trim().isEmpty()) {
            log.debug("No cleanup SQL to execute");
            return;
        }

        log.info("Executing test data cleanup SQL");

        String[] statements = splitSqlStatements(cleanupSql);

        for (String stmt : statements) {
            String trimmed = stmt.trim();
            if (!trimmed.isEmpty()) {
                try {
                    log.debug("Executing cleanup SQL: {}", trimmed);
                    jdbcTemplate.execute(trimmed);
                    log.debug("Cleanup SQL executed successfully");
                } catch (Exception e) {
                    // 清理失败只记录警告，不抛出异常
                    log.warn("Failed to execute cleanup SQL (ignored): {}", trimmed, e);
                }
            }
        }

        log.info("Test data cleanup completed");
    }

    /**
     * 查询数据并映射到对象列表
     *
     * @param sql SQL查询语句
     * @param type 目标类型
     * @param <T> 泛型类型
     * @return 查询结果列表
     */
    public <T> List<T> queryData(String sql, Class<T> type) {
        log.debug("Querying data: {}", sql);

        try {
            List<T> results = jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(type));
            log.debug("Query returned {} rows", results.size());
            return results;
        } catch (Exception e) {
            log.error("Failed to query data: {}", sql, e);
            throw new RuntimeException("Failed to query data: " + e.getMessage(), e);
        }
    }

    /**
     * 查询数据并返回Map列表
     *
     * 适用于动态查询，不需要预定义实体类
     *
     * @param sql SQL查询语句
     * @return 查询结果Map列表
     */
    public List<Map<String, Object>> queryDataAsMap(String sql) {
        log.debug("Querying data as map: {}", sql);

        try {
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            log.debug("Query returned {} rows", results.size());
            return results;
        } catch (Exception e) {
            log.error("Failed to query data: {}", sql, e);
            throw new RuntimeException("Failed to query data: " + e.getMessage(), e);
        }
    }

    /**
     * 获取指定条件的数据数量
     *
     * @param tableName 表名
     * @param whereClause WHERE条件（不包含WHERE关键字）
     * @return 记录数量
     */
    public int getCount(String tableName, String whereClause) {
        String sql = String.format("SELECT COUNT(*) FROM %s WHERE %s", tableName, whereClause);
        log.debug("Counting records: {}", sql);

        try {
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            log.debug("Count result: {}", count);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.error("Failed to get count: {}", sql, e);
            throw new RuntimeException("Failed to get count: " + e.getMessage(), e);
        }
    }

    /**
     * 获取表的总记录数
     *
     * @param tableName 表名
     * @return 记录数量
     */
    public int getTableCount(String tableName) {
        String sql = String.format("SELECT COUNT(*) FROM %s", tableName);
        log.debug("Counting table records: {}", sql);

        try {
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            log.debug("Table count: {}", count);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.error("Failed to get table count: {}", sql, e);
            throw new RuntimeException("Failed to get table count: " + e.getMessage(), e);
        }
    }

    /**
     * 验证数据是否存在
     *
     * @param tableName 表名
     * @param whereClause WHERE条件
     * @return 如果存在返回true，否则返回false
     */
    public boolean exists(String tableName, String whereClause) {
        int count = getCount(tableName, whereClause);
        return count > 0;
    }

    /**
     * 查询单个值
     *
     * @param sql SQL查询语句
     * @param type 目标类型
     * @param <T> 泛型类型
     * @return 查询结果
     */
    public <T> T queryForObject(String sql, Class<T> type) {
        log.debug("Querying for object: {}", sql);

        try {
            return jdbcTemplate.queryForObject(sql, type);
        } catch (Exception e) {
            log.error("Failed to query for object: {}", sql, e);
            throw new RuntimeException("Failed to query for object: " + e.getMessage(), e);
        }
    }

    /**
     * 执行更新操作（INSERT/UPDATE/DELETE）
     *
     * @param sql SQL语句
     * @return 影响的行数
     */
    @Transactional
    public int executeUpdate(String sql) {
        log.debug("Executing update: {}", sql);

        try {
            int rows = jdbcTemplate.update(sql);
            log.debug("Update affected {} rows", rows);
            return rows;
        } catch (Exception e) {
            log.error("Failed to execute update: {}", sql, e);
            throw new RuntimeException("Failed to execute update: " + e.getMessage(), e);
        }
    }

    /**
     * 批量执行SQL语句
     *
     * @param sqlStatements SQL语句数组
     * @return 每条SQL影响的行数数组
     */
    @Transactional
    public int[] executeBatch(String[] sqlStatements) {
        log.info("Executing batch of {} SQL statements", sqlStatements.length);

        try {
            int[] results = jdbcTemplate.batchUpdate(sqlStatements);
            log.info("Batch execution completed");
            return results;
        } catch (Exception e) {
            log.error("Failed to execute batch", e);
            throw new RuntimeException("Failed to execute batch: " + e.getMessage(), e);
        }
    }

    /**
     * 清空表（保留表结构）
     *
     * @param tableName 表名
     */
    @Transactional
    public void truncateTable(String tableName) {
        String sql = String.format("TRUNCATE TABLE %s", tableName);
        log.info("Truncating table: {}", tableName);

        try {
            jdbcTemplate.execute(sql);
            log.info("Table truncated successfully");
        } catch (Exception e) {
            log.error("Failed to truncate table: {}", tableName, e);
            throw new RuntimeException("Failed to truncate table: " + e.getMessage(), e);
        }
    }

    /**
     * 删除表中所有数据（软删除友好）
     *
     * @param tableName 表名
     * @return 删除的行数
     */
    @Transactional
    public int deleteAll(String tableName) {
        String sql = String.format("DELETE FROM %s", tableName);
        log.info("Deleting all data from table: {}", tableName);

        try {
            int rows = jdbcTemplate.update(sql);
            log.info("Deleted {} rows from table", rows);
            return rows;
        } catch (Exception e) {
            log.error("Failed to delete data from table: {}", tableName, e);
            throw new RuntimeException("Failed to delete data: " + e.getMessage(), e);
        }
    }

    /**
     * 重置自增ID
     *
     * @param tableName 表名
     * @param startValue 起始值
     */
    @Transactional
    public void resetAutoIncrement(String tableName, int startValue) {
        String sql = String.format("ALTER TABLE %s AUTO_INCREMENT = %d", tableName, startValue);
        log.info("Resetting auto increment for table: {} to {}", tableName, startValue);

        try {
            jdbcTemplate.execute(sql);
            log.info("Auto increment reset successfully");
        } catch (Exception e) {
            log.error("Failed to reset auto increment: {}", tableName, e);
            throw new RuntimeException("Failed to reset auto increment: " + e.getMessage(), e);
        }
    }

    // ========================================================================
    // 私有辅助方法
    // ========================================================================

    /**
     * 分割SQL语句
     *
     * 支持：
     * - 分号分隔的多条语句
     * - 忽略注释行（以--开头）
     * - 忽略空行
     *
     * @param sql 原始SQL
     * @return SQL语句数组
     */
    private String[] splitSqlStatements(String sql) {
        if (sql == null || sql.trim().isEmpty()) {
            return new String[0];
        }

        // 按分号分割
        String[] statements = sql.split(";");

        // 过滤注释和空行
        return java.util.Arrays.stream(statements)
            .map(String::trim)
            .filter(stmt -> !stmt.isEmpty())
            .filter(stmt -> !stmt.startsWith("--"))
            .filter(stmt -> !stmt.startsWith("/*"))
            .toArray(String[]::new);
    }
}
