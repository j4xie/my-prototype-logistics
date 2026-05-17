package com.cretas.aims.service.datacenter.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * 测试 {@link ImportExecutor#applyValidators} validator DSL. C-IMPORT-CENTER-1.
 */
class ImportExecutorValidatorTest {

    @Test
    @DisplayName("required — null / 空字符串 / 仅空格 全部失败")
    void required() {
        assertFalse(ImportExecutor.applyValidators(null, "required").isEmpty());
        assertFalse(ImportExecutor.applyValidators("", "required").isEmpty());
        assertFalse(ImportExecutor.applyValidators("   ", "required").isEmpty());
        assertTrue(ImportExecutor.applyValidators("x", "required").isEmpty());
    }

    @Test
    @DisplayName("maxLength:5 — 6 chars 失败, 5 chars 通过")
    void maxLength() {
        assertFalse(ImportExecutor.applyValidators("123456", "maxLength:5").isEmpty());
        assertTrue(ImportExecutor.applyValidators("12345", "maxLength:5").isEmpty());
    }

    @Test
    @DisplayName("minLength:3 — 空值跳过, 短值失败, 长值通过")
    void minLength() {
        assertTrue(ImportExecutor.applyValidators("", "minLength:3").isEmpty(),
                "空值不触发 minLength (留 required 处理)");
        assertFalse(ImportExecutor.applyValidators("ab", "minLength:3").isEmpty());
        assertTrue(ImportExecutor.applyValidators("abc", "minLength:3").isEmpty());
    }

    @Test
    @DisplayName("numeric — 非数字失败")
    void numeric() {
        assertTrue(ImportExecutor.applyValidators("123", "numeric").isEmpty());
        assertTrue(ImportExecutor.applyValidators("3.14", "numeric").isEmpty());
        assertFalse(ImportExecutor.applyValidators("abc", "numeric").isEmpty());
    }

    @Test
    @DisplayName("email — 简单格式校验")
    void email() {
        assertTrue(ImportExecutor.applyValidators("a@b.co", "email").isEmpty());
        assertFalse(ImportExecutor.applyValidators("not-email", "email").isEmpty());
    }

    @Test
    @DisplayName("regex:^[0-9]+$ — 仅数字通过")
    void regex() {
        assertTrue(ImportExecutor.applyValidators("123", "regex:^[0-9]+$").isEmpty());
        assertFalse(ImportExecutor.applyValidators("12a", "regex:^[0-9]+$").isEmpty());
    }

    @Test
    @DisplayName("enum:A,B,C — 不在列表内失败")
    void enumValidator() {
        assertTrue(ImportExecutor.applyValidators("A", "enum:A,B,C").isEmpty());
        assertTrue(ImportExecutor.applyValidators("B", "enum:A,B,C").isEmpty());
        assertFalse(ImportExecutor.applyValidators("D", "enum:A,B,C").isEmpty());
    }

    @Test
    @DisplayName("管道多 validator — 全部触发, 列出全部 errors")
    void pipeChain() {
        List<String> errs = ImportExecutor.applyValidators("", "required|maxLength:5");
        assertEquals(1, errs.size(), "空值仅 required 触发, maxLength 不触发空字符串");

        errs = ImportExecutor.applyValidators("123456789", "required|maxLength:5|numeric");
        // required ok, maxLength fails, numeric ok
        assertEquals(1, errs.size());
    }

    @Test
    @DisplayName("空 validator / null — 0 errors")
    void emptyValidator() {
        assertTrue(ImportExecutor.applyValidators("anything", "").isEmpty());
        assertTrue(ImportExecutor.applyValidators("anything", null).isEmpty());
    }
}
