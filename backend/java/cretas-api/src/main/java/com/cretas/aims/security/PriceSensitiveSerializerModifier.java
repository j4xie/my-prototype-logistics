package com.cretas.aims.security;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.SerializationConfig;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.ser.BeanPropertyWriter;
import com.fasterxml.jackson.databind.ser.BeanSerializerModifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Jackson {@link BeanSerializerModifier} that wraps {@link BeanPropertyWriter}s
 * for properties whose backing field or getter is annotated with
 * {@link PriceSensitive}. The wrapped writer consults the per-request
 * {@link PriceSensitiveContext} ThreadLocal — when the current user lacks the
 * required permission, the writer emits {@code null} <b>without invoking the
 * underlying getter</b>. This prevents NPEs from computed @Transient getters
 * (e.g. {@code SalesOrder.getPayableAmount()}) that would otherwise dereference
 * already-stripped price fields.
 *
 * <h2>Architectural choice (P0 fix 2026-05-12)</h2>
 *
 * <p>Two complementary layers protect the response pipeline:
 *
 * <ul>
 *   <li><b>Layer 1 — Field stripping</b>: {@link PriceFieldResponseAdvice}
 *       walks the response graph after the controller returns and nulls out
 *       {@code @PriceSensitive} fields. This existed pre-P0 (PR #423).</li>
 *   <li><b>Layer 2 — Method short-circuit</b> (this class): At Jackson
 *       serialization time, {@code @PriceSensitive} <b>methods</b> are
 *       intercepted by the property writer wrapper. When the request lacks
 *       price-view permission, the writer skips invoking the getter and emits
 *       {@code null} directly. This avoids the NPE class entirely, even if a
 *       developer forgets the defensive null guard.</li>
 * </ul>
 *
 * <p>The defensive null guards on the seven computed getters (added in the
 * same P0 fix) are <b>belt-and-suspenders</b> — even if this modifier fails
 * to register, the getters return {@code null} safely instead of NPE.
 *
 * <h2>Context propagation</h2>
 *
 * <p>{@link PriceFieldResponseAdvice} sets the ThreadLocal flag in
 * {@link PriceSensitiveContext} when it detects the current user lacks
 * permission. Jackson serialization runs on the same thread, so the writer
 * sees the flag. The flag is always cleared in a {@code finally} block.
 *
 * <p>Registered as a Spring bean via
 * {@code Jackson2ObjectMapperBuilderCustomizer} so it applies to all
 * {@link com.fasterxml.jackson.databind.ObjectMapper} instances built by
 * Spring Boot.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-05-12 (P0 hotfix — close NPE regression from PR #423)
 */
public class PriceSensitiveSerializerModifier extends BeanSerializerModifier {

    private static final Logger log = LoggerFactory.getLogger(PriceSensitiveSerializerModifier.class);

    @Override
    public List<BeanPropertyWriter> changeProperties(SerializationConfig config,
                                                     BeanDescription beanDesc,
                                                     List<BeanPropertyWriter> beanProperties) {
        for (int i = 0; i < beanProperties.size(); i++) {
            BeanPropertyWriter writer = beanProperties.get(i);
            AnnotatedMember member = writer.getMember();
            if (member == null) continue;
            // Check the property's annotated member (field OR getter) for @PriceSensitive.
            // Jackson's introspector resolves the underlying field/method automatically.
            PriceSensitive ann = member.getAnnotation(PriceSensitive.class);
            if (ann != null) {
                String permission = ann.permission();
                beanProperties.set(i, new PriceSensitivePropertyWriter(writer, permission));
                if (log.isTraceEnabled()) {
                    log.trace("Wrapped @PriceSensitive writer: class={}, property={}, permission={}",
                            beanDesc.getBeanClass().getSimpleName(), writer.getName(), permission);
                }
            }
        }
        return beanProperties;
    }

    /**
     * Delegating writer that consults {@link PriceSensitiveContext} per
     * serialization. When the current request lacks permission, emit
     * {@code null} <b>without invoking the underlying getter</b> — this is
     * the NPE-safe path that doesn't depend on getter null guards.
     */
    static final class PriceSensitivePropertyWriter extends BeanPropertyWriter {

        private final transient String permission;

        PriceSensitivePropertyWriter(BeanPropertyWriter base, String permission) {
            super(base);
            this.permission = permission;
        }

        @Override
        public void serializeAsField(Object bean, JsonGenerator gen,
                                     SerializerProvider prov) throws Exception {
            if (PriceSensitiveContext.shouldHide(permission)) {
                // Emit field name with null value (parallels Jackson default for null fields).
                // Skipping entirely would yield omitted key — to keep response schema
                // stable for clients (and parallel field-strip behavior), emit explicit null.
                gen.writeFieldName(getName());
                gen.writeNull();
                return;
            }
            // Permission granted — fall through to default behavior (invoke getter).
            super.serializeAsField(bean, gen, prov);
        }

        @Override
        public void serializeAsElement(Object bean, JsonGenerator gen,
                                       SerializerProvider prov) throws Exception {
            if (PriceSensitiveContext.shouldHide(permission)) {
                gen.writeNull();
                return;
            }
            super.serializeAsElement(bean, gen, prov);
        }
    }
}
