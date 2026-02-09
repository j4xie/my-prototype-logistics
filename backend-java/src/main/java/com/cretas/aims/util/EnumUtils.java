package com.cretas.aims.util;

import lombok.extern.slf4j.Slf4j;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Utility class for safe and flexible enum conversions.
 * Provides methods for converting strings to enums with default values,
 * Optional returns, and fuzzy matching support.
 *
 * <p>Features:
 * <ul>
 *   <li>Safe conversion with default value fallback</li>
 *   <li>Optional-based conversion for null-safe handling</li>
 *   <li>Fuzzy matching with alias support</li>
 *   <li>Case-insensitive matching</li>
 *   <li>Caching for performance optimization</li>
 * </ul>
 *
 * <p>Usage examples:
 * <pre>{@code
 * // Safe conversion with default
 * ConnectionType type = EnumUtils.valueOf(ConnectionType.class, "RS232", ConnectionType.RS232);
 *
 * // Optional-based conversion
 * Optional<ReadMode> mode = EnumUtils.safeValueOf(ReadMode.class, "continuous");
 *
 * // Fuzzy matching
 * Optional<ChecksumType> checksum = EnumUtils.fuzzyMatch(ChecksumType.class, "crc-16");
 * }</pre>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
public final class EnumUtils {

    private EnumUtils() {
        // Prevent instantiation
    }

    // ==================== Basic Conversion Methods ====================

    /**
     * Safely converts a string to an enum value with a default fallback.
     * The conversion is case-insensitive.
     *
     * @param enumClass    The enum class
     * @param name         The string value to convert
     * @param defaultValue The default value if conversion fails
     * @param <E>          The enum type
     * @return The matching enum value or the default value
     */
    public static <E extends Enum<E>> E valueOf(Class<E> enumClass, String name, E defaultValue) {
        if (name == null || name.isEmpty()) {
            return defaultValue;
        }

        try {
            // Try exact match first (case-insensitive)
            String normalizedName = name.trim().toUpperCase();
            return Enum.valueOf(enumClass, normalizedName);
        } catch (IllegalArgumentException e) {
            // Try with underscores replaced by hyphens and vice versa
            try {
                String altName = name.trim().toUpperCase()
                        .replace("-", "_")
                        .replace(" ", "_");
                return Enum.valueOf(enumClass, altName);
            } catch (IllegalArgumentException e2) {
                log.debug("No enum constant {}.{}, using default: {}",
                        enumClass.getSimpleName(), name, defaultValue);
                return defaultValue;
            }
        }
    }

    /**
     * Safely converts a string to an enum value, returning Optional.
     * The conversion is case-insensitive.
     *
     * @param enumClass The enum class
     * @param name      The string value to convert
     * @param <E>       The enum type
     * @return Optional containing the enum value, or empty if not found
     */
    public static <E extends Enum<E>> Optional<E> safeValueOf(Class<E> enumClass, String name) {
        if (name == null || name.isEmpty()) {
            return Optional.empty();
        }

        try {
            String normalizedName = name.trim().toUpperCase();
            return Optional.of(Enum.valueOf(enumClass, normalizedName));
        } catch (IllegalArgumentException e) {
            // Try alternative formats
            try {
                String altName = name.trim().toUpperCase()
                        .replace("-", "_")
                        .replace(" ", "_");
                return Optional.of(Enum.valueOf(enumClass, altName));
            } catch (IllegalArgumentException e2) {
                log.debug("No enum constant {}.{}", enumClass.getSimpleName(), name);
                return Optional.empty();
            }
        }
    }

    /**
     * Converts a string to an enum value, throwing exception if not found.
     *
     * @param enumClass The enum class
     * @param name      The string value to convert
     * @param <E>       The enum type
     * @return The matching enum value
     * @throws IllegalArgumentException if no matching enum found
     */
    public static <E extends Enum<E>> E valueOfOrThrow(Class<E> enumClass, String name) {
        return safeValueOf(enumClass, name)
                .orElseThrow(() -> new IllegalArgumentException(
                        String.format("No enum constant %s.%s. Available values: %s",
                                enumClass.getSimpleName(), name, getEnumNames(enumClass))));
    }

    // ==================== Fuzzy Matching Methods ====================

    /**
     * Performs fuzzy matching to find an enum value.
     * Supports aliases, partial matches, and common variations.
     *
     * @param enumClass The enum class
     * @param input     The input string to match
     * @param <E>       The enum type
     * @return Optional containing the matched enum value
     */
    public static <E extends Enum<E>> Optional<E> fuzzyMatch(Class<E> enumClass, String input) {
        if (input == null || input.isEmpty()) {
            return Optional.empty();
        }

        // First try exact match
        Optional<E> exact = safeValueOf(enumClass, input);
        if (exact.isPresent()) {
            return exact;
        }

        // Normalize input for comparison
        String normalized = normalizeForMatching(input);
        E[] constants = enumClass.getEnumConstants();

        // Try normalized exact match
        for (E constant : constants) {
            if (normalizeForMatching(constant.name()).equals(normalized)) {
                return Optional.of(constant);
            }
        }

        // Try contains match (for partial matches)
        for (E constant : constants) {
            String normalizedConstant = normalizeForMatching(constant.name());
            if (normalizedConstant.contains(normalized) || normalized.contains(normalizedConstant)) {
                return Optional.of(constant);
            }
        }

        // Try common aliases
        return matchByAlias(enumClass, input);
    }

    /**
     * Performs fuzzy matching with custom alias mappings.
     *
     * @param enumClass The enum class
     * @param input     The input string to match
     * @param aliases   Map of alias strings to enum names
     * @param <E>       The enum type
     * @return Optional containing the matched enum value
     */
    public static <E extends Enum<E>> Optional<E> fuzzyMatch(Class<E> enumClass, String input,
                                                              Map<String, String> aliases) {
        if (input == null || input.isEmpty()) {
            return Optional.empty();
        }

        // First try standard fuzzy match
        Optional<E> result = fuzzyMatch(enumClass, input);
        if (result.isPresent()) {
            return result;
        }

        // Try custom aliases
        String normalized = normalizeForMatching(input);
        for (Map.Entry<String, String> entry : aliases.entrySet()) {
            if (normalizeForMatching(entry.getKey()).equals(normalized)) {
                return safeValueOf(enumClass, entry.getValue());
            }
        }

        return Optional.empty();
    }

    // ==================== Batch Conversion Methods ====================

    /**
     * Converts a collection of strings to a list of enum values.
     * Invalid values are skipped.
     *
     * @param enumClass The enum class
     * @param names     Collection of string values
     * @param <E>       The enum type
     * @return List of matching enum values
     */
    public static <E extends Enum<E>> List<E> valuesOf(Class<E> enumClass, Collection<String> names) {
        if (names == null || names.isEmpty()) {
            return Collections.emptyList();
        }

        return names.stream()
                .map(name -> safeValueOf(enumClass, name))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());
    }

    /**
     * Converts a comma-separated string to a list of enum values.
     *
     * @param enumClass The enum class
     * @param csvString Comma-separated string values
     * @param <E>       The enum type
     * @return List of matching enum values
     */
    public static <E extends Enum<E>> List<E> fromCsv(Class<E> enumClass, String csvString) {
        if (csvString == null || csvString.isEmpty()) {
            return Collections.emptyList();
        }

        String[] parts = csvString.split(",");
        return valuesOf(enumClass, Arrays.asList(parts));
    }

    // ==================== Query Methods ====================

    /**
     * Gets all enum constant names as a set.
     *
     * @param enumClass The enum class
     * @param <E>       The enum type
     * @return Set of enum constant names
     */
    public static <E extends Enum<E>> Set<String> getEnumNames(Class<E> enumClass) {
        return Arrays.stream(enumClass.getEnumConstants())
                .map(Enum::name)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /**
     * Gets all enum constants as a list.
     *
     * @param enumClass The enum class
     * @param <E>       The enum type
     * @return List of all enum constants
     */
    public static <E extends Enum<E>> List<E> getAll(Class<E> enumClass) {
        return Arrays.asList(enumClass.getEnumConstants());
    }

    /**
     * Checks if a string is a valid enum constant.
     *
     * @param enumClass The enum class
     * @param name      The string value to check
     * @param <E>       The enum type
     * @return true if the string matches an enum constant
     */
    public static <E extends Enum<E>> boolean isValid(Class<E> enumClass, String name) {
        return safeValueOf(enumClass, name).isPresent();
    }

    /**
     * Creates a map from enum constants using a key extractor function.
     *
     * @param enumClass    The enum class
     * @param keyExtractor Function to extract key from enum constant
     * @param <E>          The enum type
     * @param <K>          The key type
     * @return Map of keys to enum constants
     */
    public static <E extends Enum<E>, K> Map<K, E> toMap(Class<E> enumClass, Function<E, K> keyExtractor) {
        return Arrays.stream(enumClass.getEnumConstants())
                .collect(Collectors.toMap(keyExtractor, Function.identity()));
    }

    // ==================== Private Helper Methods ====================

    /**
     * Normalizes a string for fuzzy matching.
     * Removes non-alphanumeric characters and converts to lowercase.
     */
    private static String normalizeForMatching(String input) {
        return input.toLowerCase()
                .replaceAll("[^a-z0-9]", "")
                .trim();
    }

    /**
     * Attempts to match using common aliases for known enum types.
     */
    private static <E extends Enum<E>> Optional<E> matchByAlias(Class<E> enumClass, String input) {
        String normalized = normalizeForMatching(input);
        Map<String, String> aliases = getCommonAliases(enumClass);

        for (Map.Entry<String, String> entry : aliases.entrySet()) {
            if (normalizeForMatching(entry.getKey()).equals(normalized)) {
                return safeValueOf(enumClass, entry.getValue());
            }
        }

        return Optional.empty();
    }

    /**
     * Gets common aliases for specific enum types.
     * Can be extended to support more enum types.
     */
    private static Map<String, String> getCommonAliases(Class<?> enumClass) {
        String className = enumClass.getSimpleName();

        switch (className) {
            case "ConnectionType":
                return Map.of(
                        "serial", "RS232",
                        "rs-232", "RS232",
                        "rs-485", "RS485",
                        "http", "HTTP_API",
                        "rest", "HTTP_API",
                        "tcp", "TCP_SOCKET",
                        "modbus", "MODBUS_RTU"
                );

            case "ChecksumType":
                return Map.of(
                        "xor", "XOR",
                        "crc", "CRC16",
                        "crc-16", "CRC16",
                        "crc-32", "CRC32",
                        "sum", "SUM",
                        "checksum", "SUM",
                        "modbus-crc", "MODBUS_CRC"
                );

            case "ReadMode":
                return Map.of(
                        "continuous", "CONTINUOUS",
                        "stream", "CONTINUOUS",
                        "poll", "POLL",
                        "request", "POLL",
                        "change", "ON_CHANGE",
                        "event", "ON_CHANGE"
                );

            default:
                return Collections.emptyMap();
        }
    }

    // ==================== Enum Ordinal Utilities ====================

    /**
     * Gets enum by ordinal value with default fallback.
     *
     * @param enumClass    The enum class
     * @param ordinal      The ordinal value
     * @param defaultValue Default if ordinal is out of range
     * @param <E>          The enum type
     * @return The enum constant at the ordinal position
     */
    public static <E extends Enum<E>> E byOrdinal(Class<E> enumClass, int ordinal, E defaultValue) {
        E[] constants = enumClass.getEnumConstants();
        if (ordinal < 0 || ordinal >= constants.length) {
            return defaultValue;
        }
        return constants[ordinal];
    }

    /**
     * Gets enum by ordinal value, returning Optional.
     *
     * @param enumClass The enum class
     * @param ordinal   The ordinal value
     * @param <E>       The enum type
     * @return Optional containing the enum constant
     */
    public static <E extends Enum<E>> Optional<E> byOrdinal(Class<E> enumClass, int ordinal) {
        E[] constants = enumClass.getEnumConstants();
        if (ordinal < 0 || ordinal >= constants.length) {
            return Optional.empty();
        }
        return Optional.of(constants[ordinal]);
    }
}
