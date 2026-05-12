package com.cretas.aims.security;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import java.util.Collection;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Strips fields annotated with {@link PriceSensitive} from response bodies
 * for users lacking the {@code procurement:price:view} permission.
 *
 * <h2>Behavior</h2>
 * <ul>
 *   <li>Runs <b>after</b> the controller returns, <b>before</b> Jackson serialization.</li>
 *   <li>Recursively walks the response body (including {@link ApiResponse#getData()},
 *       {@link PageResponse#getContent()}, nested entities, lists, maps).</li>
 *   <li>Reflectively sets each {@code @PriceSensitive} field to {@code null}.</li>
 *   <li>If the current request has no authenticated user (e.g. health checks,
 *       login endpoints), the response is passed through unchanged — fail-safe
 *       behavior delegates to existing {@link com.cretas.aims.config.JwtAuthInterceptor}
 *       which already blocks unauthenticated traffic at the auth layer.</li>
 *   <li>Users with the permission (factory_super_admin, finance_manager,
 *       procurement_manager) see all price fields. Roles without the permission
 *       (warehouse_manager, warehouse_worker, quality_inspector, operator, etc.)
 *       see {@code null} in those fields.</li>
 * </ul>
 *
 * <h2>Field cache</h2>
 * <p>Reflective field lookup is cached per class to keep overhead negligible
 * (a single {@link Class#getDeclaredFields()} walk per type per JVM, then
 * O(1) hash lookups). Per-request CPU cost is dominated by traversal of the
 * payload graph, not reflection.
 *
 * <h2>Cycle protection</h2>
 * <p>An {@link IdentityHashMap}-backed visited set prevents stack-overflow on
 * entities with bidirectional JPA associations (e.g. PurchaseOrder ↔ items).
 *
 * <p>RBAC isolation source-of-truth: PR #415 Option B (2026-05-12).
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-05-12
 */
@ControllerAdvice
public class PriceFieldResponseAdvice implements ResponseBodyAdvice<Object> {

    private static final Logger log = LoggerFactory.getLogger(PriceFieldResponseAdvice.class);

    /** Default permission gate for price field visibility. */
    public static final String PRICE_VIEW_PERMISSION = "procurement:price:view";

    /** Per-class cache: Class → list of @PriceSensitive fields. Made accessible. */
    private static final Map<Class<?>, List<Field>> PRICE_FIELD_CACHE = new ConcurrentHashMap<>();

    /** Classes known to contain zero @PriceSensitive fields (terminate traversal early). */
    private static final Set<Class<?>> CLEAN_CLASSES = ConcurrentHashMap.newKeySet();

    /** Package prefix of project-owned classes — only descend into these to avoid jdk/lib introspection. */
    private static final String PROJECT_PACKAGE = "com.cretas.aims";

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private UserRepository userRepository;

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        // Only intercept JSON-serializable responses (skip binary streams, file uploads).
        // Returning true here lets beforeBodyWrite filter by content type / class.
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body,
                                   MethodParameter returnType,
                                   org.springframework.http.MediaType selectedContentType,
                                   Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                   ServerHttpRequest request,
                                   ServerHttpResponse response) {
        if (body == null) {
            return null;
        }

        // Restrict to JSON responses — binary / streaming / form responses pass through
        if (selectedContentType != null
                && !MediaType.APPLICATION_JSON.includes(selectedContentType)
                && !MediaType.parseMediaType("application/*+json").includes(selectedContentType)) {
            return body;
        }

        // Resolve current user from request attributes (set by JwtAuthInterceptor).
        User currentUser = resolveCurrentUser(request);
        if (currentUser == null) {
            // No authenticated user (login, health checks, public endpoints).
            // Public endpoints are filtered by JwtAuthInterceptor — if we reach
            // here without a user, the endpoint is intentionally unauthenticated.
            return body;
        }

        // Check permission once — short-circuit for users with full access.
        if (permissionService.hasPermission(currentUser, PRICE_VIEW_PERMISSION)) {
            return body;
        }

        // User lacks price view permission — strip @PriceSensitive fields recursively.
        try {
            stripPriceFields(body, new IdentityHashMap<>());
        } catch (Exception e) {
            // Defensive: never fail the response on a stripping error. Log and
            // pass through the body — admin-role parity preserved (no regression).
            log.warn("PriceFieldResponseAdvice strip failed for userId={}, role={}: {}",
                    currentUser.getId(),
                    currentUser.getRoleEnum() != null ? currentUser.getRoleEnum().name() : "null",
                    e.getMessage());
        }
        return body;
    }

    /**
     * Recursively visit the response body graph and null-out any field annotated
     * with {@link PriceSensitive}. Visits collections (List/Set), maps and
     * nested project objects. Skips JDK types (String, Number, Date, etc).
     */
    private void stripPriceFields(Object obj, IdentityHashMap<Object, Boolean> visited) {
        if (obj == null) {
            return;
        }
        if (visited.containsKey(obj)) {
            return;
        }

        Class<?> clazz = obj.getClass();

        // Collection — recurse into elements (containers may be JDK types but
        // their contents are what we care about).
        if (obj instanceof Collection<?>) {
            for (Object item : (Collection<?>) obj) {
                stripPriceFields(item, visited);
            }
            return;
        }

        // Map — recurse into values (keys are typically String / primitive)
        if (obj instanceof Map<?, ?>) {
            for (Object value : ((Map<?, ?>) obj).values()) {
                stripPriceFields(value, visited);
            }
            return;
        }

        // Array
        if (clazz.isArray() && !clazz.getComponentType().isPrimitive()) {
            Object[] arr = (Object[]) obj;
            for (Object item : arr) {
                stripPriceFields(item, visited);
            }
            return;
        }

        // Skip JDK leaf values — they cannot have @PriceSensitive annotations
        if (isJdkType(clazz)) {
            return;
        }

        // Mark visited for project objects (post-container check)
        if (clazz.getName().startsWith(PROJECT_PACKAGE)) {
            visited.put(obj, Boolean.TRUE);
        }

        // Project object — locate & null @PriceSensitive fields, then descend
        if (!clazz.getName().startsWith(PROJECT_PACKAGE)) {
            return;
        }

        if (CLEAN_CLASSES.contains(clazz)) {
            // Class has no @PriceSensitive fields anywhere — still descend
            // into non-primitive fields (graph may contain dirty children)
            descendChildren(obj, clazz, visited);
            return;
        }

        List<Field> priceFields = PRICE_FIELD_CACHE.computeIfAbsent(clazz, this::scanPriceFields);
        for (Field f : priceFields) {
            try {
                f.set(obj, null);
            } catch (IllegalAccessException e) {
                log.debug("Failed to null @PriceSensitive field {}.{}: {}", clazz.getSimpleName(), f.getName(), e.getMessage());
            }
        }

        descendChildren(obj, clazz, visited);
    }

    /** Walk reference fields of a project class and recurse into each non-null value. */
    private void descendChildren(Object obj, Class<?> clazz, IdentityHashMap<Object, Boolean> visited) {
        // Walk all fields (including inherited up to Object). Recurse into project objects + containers.
        Class<?> walk = clazz;
        while (walk != null && walk != Object.class) {
            for (Field f : walk.getDeclaredFields()) {
                if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
                if (java.lang.reflect.Modifier.isTransient(f.getModifiers())) continue;
                Class<?> type = f.getType();
                if (type.isPrimitive()) continue;
                // Skip declared leaf types (String / BigDecimal / dates / etc).
                // Generic Object fields (T data in ApiResponse) are NOT skipped here —
                // the runtime check inside stripPriceFields handles them.
                if (type != Object.class && isLeafValue(type)) continue;
                f.setAccessible(true);
                try {
                    Object child = f.get(obj);
                    if (child != null) {
                        stripPriceFields(child, visited);
                    }
                } catch (IllegalAccessException e) {
                    log.debug("Failed to access field {}.{}: {}", walk.getSimpleName(), f.getName(), e.getMessage());
                }
            }
            walk = walk.getSuperclass();
        }
    }

    /**
     * Returns {@code true} for types that never contain @PriceSensitive — primitives,
     * String, Number, java.time, UUID, Boolean. Collections, Maps and Object[] are NOT
     * leaf — they're containers we must descend into.
     */
    private boolean isLeafValue(Class<?> type) {
        if (type.isPrimitive()) return true;
        if (Collection.class.isAssignableFrom(type)) return false;
        if (Map.class.isAssignableFrom(type)) return false;
        if (type.isArray()) {
            Class<?> comp = type.getComponentType();
            return comp.isPrimitive() || isLeafValue(comp);
        }
        String name = type.getName();
        // Primitive wrappers, String, Number subtypes, dates, UUIDs etc — leaf.
        if (name.startsWith("java.lang.")) return true;
        if (name.startsWith("java.math.")) return true;
        if (name.startsWith("java.time.")) return true;
        if (name.startsWith("java.util.UUID")) return true;
        if (name.equals("java.util.Date")) return true;
        // Other java.* are containers/wrappers that may hold project objects (Optional, etc.)
        // but for safety we treat unknown JDK types as leaf to avoid heavy reflection.
        if (name.startsWith("java.")
                || name.startsWith("javax.")
                || name.startsWith("jakarta.")
                || name.startsWith("sun.")
                || name.startsWith("com.fasterxml.jackson")
                || name.startsWith("org.hibernate.")
                || name.startsWith("org.springframework.")) {
            return true;
        }
        return false;
    }

    /**
     * Scan all fields of the class (including inherited) for {@link PriceSensitive}.
     * Returns an immutable list. Marks class as clean when no fields are found.
     */
    private List<Field> scanPriceFields(Class<?> clazz) {
        List<Field> result = new java.util.ArrayList<>();
        Class<?> walk = clazz;
        while (walk != null && walk != Object.class) {
            for (Field f : walk.getDeclaredFields()) {
                if (f.isAnnotationPresent(PriceSensitive.class)) {
                    // Always ensure accessible for instance/private fields (canAccess
                    // requires a concrete target — calling it with null on an instance
                    // field throws IllegalArgumentException).
                    f.setAccessible(true);
                    result.add(f);
                }
            }
            walk = walk.getSuperclass();
        }
        if (result.isEmpty()) {
            CLEAN_CLASSES.add(clazz);
        }
        return java.util.Collections.unmodifiableList(result);
    }

    /**
     * Returns {@code true} for types we don't want to introspect (JDK / framework primitives).
     */
    private boolean isJdkType(Class<?> clazz) {
        if (clazz.isPrimitive()) return true;
        String name = clazz.getName();
        // Strings, numbers, dates, UUIDs etc never contain @PriceSensitive
        return name.startsWith("java.")
                || name.startsWith("javax.")
                || name.startsWith("jakarta.")
                || name.startsWith("sun.")
                || name.startsWith("com.fasterxml.jackson")
                || name.startsWith("org.hibernate.")
                || name.startsWith("org.springframework.");
    }

    /** Resolve the current user from request attributes set by {@link com.cretas.aims.config.JwtAuthInterceptor}. */
    private User resolveCurrentUser(ServerHttpRequest request) {
        if (!(request instanceof ServletServerHttpRequest)) {
            return null;
        }
        HttpServletRequest servletReq = ((ServletServerHttpRequest) request).getServletRequest();
        Object userIdObj = servletReq.getAttribute("userId");
        if (userIdObj == null) {
            return null;
        }
        Long userId = null;
        if (userIdObj instanceof Long) {
            userId = (Long) userIdObj;
        } else if (userIdObj instanceof Integer) {
            userId = ((Integer) userIdObj).longValue();
        } else if (userIdObj instanceof String) {
            try {
                userId = Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        if (userId == null) {
            return null;
        }
        try {
            Optional<User> userOpt = userRepository.findById(userId);
            return userOpt.orElse(null);
        } catch (Exception e) {
            log.debug("Failed to resolve user for userId={}: {}", userId, e.getMessage());
            return null;
        }
    }
}
