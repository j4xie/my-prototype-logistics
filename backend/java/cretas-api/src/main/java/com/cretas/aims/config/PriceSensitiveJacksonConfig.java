package com.cretas.aims.config;

import com.cretas.aims.security.PriceSensitiveSerializerModifier;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers {@link PriceSensitiveSerializerModifier} as a Jackson
 * {@link com.fasterxml.jackson.databind.ser.BeanSerializerModifier} so that
 * properties (fields or computed getters) annotated with
 * {@link com.cretas.aims.security.PriceSensitive} are short-circuited at
 * serialization time when the current request lacks price-view permission.
 *
 * <p>Registered as a {@link Module} bean — Spring Boot auto-wires modules
 * into the default {@code ObjectMapper}.
 *
 * <p>Part of P0 hotfix (2026-05-12) — closes NPE regression from PR #423
 * where stripped {@code @PriceSensitive} fields were still dereferenced by
 * {@code @Transient} computed getters during Jackson serialization.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-05-12
 */
@Configuration
public class PriceSensitiveJacksonConfig {

    /**
     * Jackson module that installs the {@link PriceSensitiveSerializerModifier}.
     * Bean name explicitly distinct from other Module beans to avoid conflict.
     */
    @Bean
    public Module priceSensitiveJacksonModule() {
        SimpleModule module = new SimpleModule("PriceSensitiveModule");
        module.setSerializerModifier(new PriceSensitiveSerializerModifier());
        return module;
    }
}
