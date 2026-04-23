package com.cretas.aims.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证 LenientDateJacksonModule 支持关键字 + 标准 ISO + 非法值.
 */
class LenientDateJacksonModuleTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        mapper.registerModule(new LenientDateJacksonModule().lenientLocalDateModule());
    }

    @Test
    void today_keyword_parses_to_now() throws Exception {
        LocalDate result = mapper.readValue("\"TODAY\"", LocalDate.class);
        assertEquals(LocalDate.now(), result);
    }

    @Test
    void yesterday_keyword_parses_to_minus_one() throws Exception {
        LocalDate result = mapper.readValue("\"YESTERDAY\"", LocalDate.class);
        assertEquals(LocalDate.now().minusDays(1), result);
    }

    @Test
    void tomorrow_keyword_parses_to_plus_one() throws Exception {
        LocalDate result = mapper.readValue("\"TOMORROW\"", LocalDate.class);
        assertEquals(LocalDate.now().plusDays(1), result);
    }

    @Test
    void keyword_is_case_insensitive() throws Exception {
        LocalDate result = mapper.readValue("\"today\"", LocalDate.class);
        assertEquals(LocalDate.now(), result);
    }

    @Test
    void keyword_with_whitespace_still_parses() throws Exception {
        LocalDate result = mapper.readValue("\"  TODAY  \"", LocalDate.class);
        assertEquals(LocalDate.now(), result);
    }

    @Test
    void negative_n_days_parses_relative() throws Exception {
        LocalDate result = mapper.readValue("\"-7_DAYS\"", LocalDate.class);
        assertEquals(LocalDate.now().minusDays(7), result);
    }

    @Test
    void positive_n_days_parses_relative() throws Exception {
        LocalDate result = mapper.readValue("\"+30_DAYS\"", LocalDate.class);
        assertEquals(LocalDate.now().plusDays(30), result);
    }

    @Test
    void iso_date_still_parses_normally() throws Exception {
        LocalDate result = mapper.readValue("\"2026-04-24\"", LocalDate.class);
        assertEquals(LocalDate.of(2026, 4, 24), result);
    }

    @Test
    void invalid_string_throws_400_exception() {
        // 非法值应该走 Spring 原有 400 路径 (抛异常,不是 swallow 成 null)
        assertThrows(Exception.class, () -> mapper.readValue("\"random garbage\"", LocalDate.class));
    }

    @Test
    void empty_string_returns_null() throws Exception {
        LocalDate result = mapper.readValue("\"\"", LocalDate.class);
        assertNull(result);
    }
}
