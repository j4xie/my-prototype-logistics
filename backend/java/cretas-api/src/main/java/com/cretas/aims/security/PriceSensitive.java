package com.cretas.aims.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marker annotation for fields containing price / amount / cost information
 * that must be masked from users lacking the {@code procurement:price:view}
 * permission.
 *
 * <p>Fields annotated with {@code @PriceSensitive} are stripped (set to
 * {@code null}) by {@link PriceFieldResponseAdvice} after the controller
 * returns and before Jackson serialization. The stripping is recursive — it
 * applies to nested objects, collections and {@link com.cretas.aims.dto.common.ApiResponse}
 * payloads.
 *
 * <p>Usage:
 * <pre>{@code
 *   public class PurchaseOrderItem {
 *       @PriceSensitive
 *       private BigDecimal unitPrice;
 *
 *       @PriceSensitive
 *       private BigDecimal lineAmount;
 *   }
 * }</pre>
 *
 * <p>RBAC isolation source-of-truth: PR #415 Option B (2026-05-12).
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-05-12
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface PriceSensitive {

    /**
     * Optional permission code required to view this field.
     * Default is {@code procurement:price:view}.
     */
    String permission() default "procurement:price:view";
}
