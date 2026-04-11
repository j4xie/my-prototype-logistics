package com.cretas.aims.engine;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.entity.config.FactoryTriggerChain;
import com.cretas.aims.repository.config.FactoryTriggerChainRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.*;

/**
 * Canvas V2: Configurable trigger chain executor.
 * Listens to ALL ApplicationEvents and routes them through factory_trigger_chains.
 * If no chain is configured, the event falls through to existing @EventListener handlers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(1) // Execute BEFORE other listeners
public class TriggerChainExecutor {

    private final FactoryTriggerChainRepository triggerChainRepository;
    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    // Round 4 Fix P1-14: added SalesOrderCreatedEvent so trigger chains can react to
    // order creation (e.g. fetch external market price, create parallel workflows).
    // Full list should eventually be data-driven from factory_trigger_chains.event_type
    // but this hardcoded whitelist is the current performance-safe approach.
    private static final Set<String> HANDLED_EVENTS = Set.of(
            "SalesOrderCreatedEvent",
            "SalesOrderConfirmedEvent", "SalesOrderFinanceApprovedEvent",
            "MaterialReceivedEvent", "BatchCompletedEvent",
            "FinishedGoodsCreatedEvent", "PaymentReceivedEvent"
    );

    @EventListener
    public void onApplicationEvent(ApplicationEvent event) {
        String eventType = event.getClass().getSimpleName();
        if (!HANDLED_EVENTS.contains(eventType)) return;

        String factoryId = extractFactoryId(event);
        if (factoryId == null) {
            log.warn("TriggerChain: event {} has no factoryId accessor, skipping", eventType);
            return;
        }

        log.info("TriggerChain: event {} received for factory {}, looking up chains", eventType, factoryId);

        List<FactoryTriggerChain> chains = triggerChainRepository
                .findByFactoryIdAndEventTypeAndEnabledTrue(factoryId, eventType);

        if (chains.isEmpty()) {
            chains = triggerChainRepository.findGlobalByEventType(eventType);
        }

        if (chains.isEmpty()) {
            log.info("TriggerChain: no chain configured for event {} / factory {} (fallthrough to hardcoded handlers)",
                    eventType, factoryId);
            return;
        }

        log.info("TriggerChain: found {} chain(s) for event {} / factory {}",
                chains.size(), eventType, factoryId);

        for (FactoryTriggerChain chain : chains) {
            try {
                executeChain(chain, factoryId, event);
            } catch (Exception e) {
                log.error("Trigger chain {} failed for factory {}: {}",
                        chain.getChainCode(), factoryId, e.getMessage(), e);
            }
        }
    }

    private void executeChain(FactoryTriggerChain chain, String factoryId, ApplicationEvent event) {
        List<Map<String, Object>> steps = chain.getSteps();
        if (steps == null || steps.isEmpty()) return;

        Map<String, Object> chainContext = new HashMap<>();
        chainContext.put("factoryId", factoryId);

        log.info("Executing trigger chain {} ({} steps) for factory {}",
                chain.getChainCode(), steps.size(), factoryId);

        for (Map<String, Object> step : steps) {
            Boolean stepEnabled = (Boolean) step.getOrDefault("enabled", true);
            if (!stepEnabled) continue;

            String toolName = (String) step.get("tool");
            String condition = (String) step.getOrDefault("condition", "always");
            int order = step.containsKey("order") ? ((Number) step.get("order")).intValue() : 0;

            if (!"always".equals(condition) && !evaluateCondition(condition, chainContext)) {
                log.debug("Chain {} step {} skipped (condition: {})", chain.getChainCode(), toolName, condition);
                continue;
            }

            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            if (executor.isEmpty()) {
                log.warn("Tool not found in chain {}: {}", chain.getChainCode(), toolName);
                continue;
            }

            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) step.getOrDefault("params", Map.of());

                // Build proper ToolCall with JSON-serialized arguments
                String argsJson = objectMapper.writeValueAsString(params);
                ToolCall toolCall = ToolCall.of(
                        "chain-" + chain.getChainCode() + "-" + order,
                        toolName, argsJson);

                Map<String, Object> execContext = new HashMap<>(chainContext);

                String result = executor.get().execute(toolCall, execContext);
                chainContext.put("step" + order, Map.of("result", result, "success", true));
                log.info("Chain {} step {} executed OK", chain.getChainCode(), toolName);
            } catch (Exception e) {
                chainContext.put("step" + order, Map.of("success", false, "error", e.getMessage()));
                log.error("Chain {} step {} failed: {}", chain.getChainCode(), toolName, e.getMessage());

                if ("STOP".equals(chain.getErrorStrategy())) {
                    throw new RuntimeException("Trigger chain stopped at step " + toolName, e);
                }
            }
        }
    }

    private boolean evaluateCondition(String condition, Map<String, Object> context) {
        try {
            if (condition.contains("==")) {
                String[] parts = condition.split("==");
                String path = parts[0].trim();
                String expected = parts[1].trim();
                Object actual = resolvePath(path, context);
                return String.valueOf(actual).equals(expected);
            }
            if (condition.startsWith("!")) {
                String path = condition.substring(1).trim();
                Object val = resolvePath(path, context);
                return !Boolean.TRUE.equals(val) && !"true".equals(String.valueOf(val));
            }
            Object val = resolvePath(condition, context);
            return Boolean.TRUE.equals(val) || "true".equals(String.valueOf(val));
        } catch (Exception e) {
            log.debug("Condition evaluation failed: {} — treating as false", condition);
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private Object resolvePath(String path, Map<String, Object> context) {
        String[] parts = path.split("\\.");
        Object current = context;
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<String, Object>) current).get(part);
            } else {
                return null;
            }
        }
        return current;
    }

    private String extractFactoryId(ApplicationEvent event) {
        try {
            Method method = event.getClass().getMethod("getFactoryId");
            return (String) method.invoke(event);
        } catch (Exception e) {
            return null;
        }
    }
}
