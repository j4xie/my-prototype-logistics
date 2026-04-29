package com.cretas.aims.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * LocalDate lenient deserializer.
 * <p>
 * 业务前端反复发 keyword 字符串 ("TODAY"/"YESTERDAY"/"TOMORROW")
 * 触发 Jackson DateTimeParseException → 400. 2026-04-24 起接受这些关键词作为
 * 动态日期,避免前端紧急修 UI. 真的非法值仍然抛原异常走 400 路径.
 * <p>
 * 支持:
 * <ul>
 *   <li>ISO 日期: 2026-04-24 (正常 fallback)</li>
 *   <li>TODAY — LocalDate.now()</li>
 *   <li>YESTERDAY — now-1d</li>
 *   <li>TOMORROW — now+1d</li>
 *   <li>-N_DAYS / +N_DAYS — 相对今天 N 天 (e.g. -7_DAYS, +30_DAYS)</li>
 * </ul>
 * 不支持的字符串 (e.g. 空串 / 乱码) 走 Spring 原有 400 路径.
 */
@Configuration
public class LenientDateJacksonModule {

    @Bean
    public Module lenientLocalDateModule() {
        SimpleModule module = new SimpleModule("LenientLocalDateModule");
        module.addDeserializer(LocalDate.class, new LenientLocalDateDeserializer());
        return module;
    }

    private static final class LenientLocalDateDeserializer extends JsonDeserializer<LocalDate> {

        @Override
        public LocalDate deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            String text = p.getText();
            if (text == null || text.isBlank()) {
                return null;
            }
            String upper = text.trim().toUpperCase();

            switch (upper) {
                case "TODAY":
                    return LocalDate.now();
                case "YESTERDAY":
                    return LocalDate.now().minusDays(1);
                case "TOMORROW":
                    return LocalDate.now().plusDays(1);
                default:
                    // -N_DAYS / +N_DAYS 模式 (N 最多 5 位)
                    if (upper.matches("^[+-]?\\d{1,5}_DAYS?$")) {
                        try {
                            int days = Integer.parseInt(upper.replace("_DAYS", "").replace("_DAY", ""));
                            return LocalDate.now().plusDays(days);
                        } catch (NumberFormatException ignore) {
                            // fall through to default parse
                        }
                    }
                    return LocalDate.parse(text.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
            }
        }
    }
}
