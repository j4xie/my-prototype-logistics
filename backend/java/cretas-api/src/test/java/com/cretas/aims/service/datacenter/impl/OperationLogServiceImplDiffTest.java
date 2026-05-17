package com.cretas.aims.service.datacenter.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 测试 {@link OperationLogServiceImpl#computeDiff} 纯函数. C-LOG-AUDIT-1 Day 9.
 */
class OperationLogServiceImplDiffTest {

    @Test
    @DisplayName("computeDiff(null, null) → null")
    void bothNull() {
        assertNull(OperationLogServiceImpl.computeDiff(null, null));
    }

    @Test
    @DisplayName("CREATE — oldValue null, 新增 key 全列入 diff (from=null)")
    void createCase() {
        Map<String, Object> newV = new LinkedHashMap<>();
        newV.put("name", "foo");
        newV.put("status", "ACTIVE");
        List<Map<String, Object>> diff = OperationLogServiceImpl.computeDiff(null, newV);
        assertNotNull(diff);
        assertEquals(2, diff.size());
        // sorted by TreeSet → name, status
        assertEquals("name", diff.get(0).get("field"));
        assertNull(diff.get(0).get("from"));
        assertEquals("foo", diff.get(0).get("to"));
        assertEquals("status", diff.get(1).get("field"));
    }

    @Test
    @DisplayName("DELETE — newValue null, 全部 key 列入 (to=null)")
    void deleteCase() {
        Map<String, Object> oldV = new HashMap<>();
        oldV.put("name", "foo");
        List<Map<String, Object>> diff = OperationLogServiceImpl.computeDiff(oldV, null);
        assertNotNull(diff);
        assertEquals(1, diff.size());
        assertEquals("foo", diff.get(0).get("from"));
        assertNull(diff.get(0).get("to"));
    }

    @Test
    @DisplayName("UPDATE — 仅变更字段列入, 未变字段不进 diff")
    void updateOnlyChanged() {
        Map<String, Object> oldV = new HashMap<>();
        oldV.put("name", "foo");
        oldV.put("status", "ACTIVE");
        oldV.put("count", 5);
        Map<String, Object> newV = new HashMap<>();
        newV.put("name", "foo");          // 未变
        newV.put("status", "INACTIVE");    // 改
        newV.put("count", 5);              // 未变
        List<Map<String, Object>> diff = OperationLogServiceImpl.computeDiff(oldV, newV);
        assertNotNull(diff);
        assertEquals(1, diff.size());
        assertEquals("status", diff.get(0).get("field"));
        assertEquals("ACTIVE", diff.get(0).get("from"));
        assertEquals("INACTIVE", diff.get(0).get("to"));
    }

    @Test
    @DisplayName("无变化 → null (空 diff list 返 null 而非 [])")
    void noChange() {
        Map<String, Object> v = new HashMap<>();
        v.put("name", "foo");
        assertNull(OperationLogServiceImpl.computeDiff(v, v));
    }

    @Test
    @DisplayName("跨边类型 diff — Integer 5 与 Long 5L 视为相等 (Objects.equals false)")
    void typeMismatchProducesDiff() {
        // Objects.equals(Integer.valueOf(5), Long.valueOf(5L)) is FALSE — diff 会列出.
        // 这是 Jackson convertValue 后的 already-coerced 一致性的反例,记录 in test 提醒.
        Map<String, Object> oldV = new HashMap<>();
        oldV.put("count", Integer.valueOf(5));
        Map<String, Object> newV = new HashMap<>();
        newV.put("count", Long.valueOf(5L));
        List<Map<String, Object>> diff = OperationLogServiceImpl.computeDiff(oldV, newV);
        assertNotNull(diff);
        assertEquals(1, diff.size());
    }
}
