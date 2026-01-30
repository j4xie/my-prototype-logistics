package com.cretas.aims.service.scale.parser;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Factory for obtaining the appropriate frame parser based on frame type.
 * Implements the Factory Pattern for parser selection.
 *
 * <p>Supported frame types:
 * <ul>
 *   <li>{@code ASCII_FIXED} - Fixed-length ASCII frames</li>
 *   <li>{@code ASCII_VARIABLE} - Variable-length delimited ASCII frames</li>
 *   <li>{@code HEX_FIXED} - Fixed-length binary frames</li>
 *   <li>{@code MODBUS_RTU} - Modbus RTU protocol frames</li>
 * </ul>
 *
 * <p>Usage example:
 * <pre>{@code
 * @Autowired
 * private FrameParserFactory parserFactory;
 *
 * public ScaleDataParseResult parse(String frameType, JsonNode format, byte[] rawData) {
 *     return parserFactory.getParser(frameType)
 *             .map(parser -> parser.parse(format, rawData))
 *             .orElse(ScaleDataParseResult.failure("UNSUPPORTED_FRAME_TYPE",
 *                     "No parser found for frame type: " + frameType));
 * }
 * }</pre>
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FrameParserFactory {

    private final List<AbstractFrameParser> parsers;
    private final Map<String, AbstractFrameParser> parserMap = new HashMap<>();

    /**
     * Initializes the parser map on application startup.
     * Registers all available parsers by their frame type.
     */
    @PostConstruct
    public void init() {
        for (AbstractFrameParser parser : parsers) {
            String frameType = parser.getFrameType();
            if (frameType != null && !frameType.isEmpty()) {
                parserMap.put(frameType.toUpperCase(), parser);
                log.info("Registered frame parser: {} -> {}", frameType, parser.getClass().getSimpleName());
            }
        }
        log.info("FrameParserFactory initialized with {} parsers", parserMap.size());
    }

    /**
     * Gets the appropriate parser for the specified frame type.
     *
     * @param frameType The frame type identifier (e.g., "ASCII_FIXED", "MODBUS_RTU")
     * @return Optional containing the parser, or empty if no parser found
     */
    public Optional<AbstractFrameParser> getParser(String frameType) {
        if (frameType == null || frameType.isEmpty()) {
            log.warn("Frame type is null or empty");
            return Optional.empty();
        }

        String normalizedType = frameType.toUpperCase().trim();
        AbstractFrameParser parser = parserMap.get(normalizedType);

        if (parser == null) {
            log.warn("No parser found for frame type: {}", frameType);
            return Optional.empty();
        }

        return Optional.of(parser);
    }

    /**
     * Gets the parser for the specified frame type, throwing exception if not found.
     *
     * @param frameType The frame type identifier
     * @return The parser instance
     * @throws IllegalArgumentException if no parser found for the frame type
     */
    public AbstractFrameParser getParserOrThrow(String frameType) {
        return getParser(frameType)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unsupported frame type: " + frameType + ". Available types: " + parserMap.keySet()));
    }

    /**
     * Checks if a parser exists for the specified frame type.
     *
     * @param frameType The frame type identifier
     * @return true if a parser exists, false otherwise
     */
    public boolean hasParser(String frameType) {
        if (frameType == null || frameType.isEmpty()) {
            return false;
        }
        return parserMap.containsKey(frameType.toUpperCase().trim());
    }

    /**
     * Gets all registered frame types.
     *
     * @return Set of supported frame type identifiers
     */
    public java.util.Set<String> getSupportedFrameTypes() {
        return java.util.Collections.unmodifiableSet(parserMap.keySet());
    }

    /**
     * Gets the total number of registered parsers.
     *
     * @return Number of registered parsers
     */
    public int getParserCount() {
        return parserMap.size();
    }

    /**
     * Frame type constants for convenience.
     */
    public static final class FrameTypes {
        public static final String ASCII_FIXED = "ASCII_FIXED";
        public static final String ASCII_VARIABLE = "ASCII_VARIABLE";
        public static final String HEX_FIXED = "HEX_FIXED";
        public static final String MODBUS_RTU = "MODBUS_RTU";

        private FrameTypes() {
            // Prevent instantiation
        }
    }
}
