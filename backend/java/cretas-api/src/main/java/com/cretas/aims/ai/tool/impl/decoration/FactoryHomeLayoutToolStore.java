package com.cretas.aims.ai.tool.impl.decoration;

import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import com.cretas.aims.repository.FactoryHomeLayoutRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Shared persistence helper for the three decoration Tools
 * ({@link HomeLayoutGenerateTool}, {@link HomeLayoutUpdateTool},
 *  {@link HomeLayoutSuggestTool}) — unifies their storage target on
 * {@code factory_home_layout} so the layouts they produce reach the same
 * table that {@code DecorationServiceImpl.getHomeLayout} reads (and that
 * the frontend FAHomeScreen renderer consumes via
 * {@code decorationApiClient.getLayout}).
 *
 * <p>Prior to Project 3 of Track A, these Tools wrote into
 * {@code factory_settings.ai_settings.homeLayout} JSON path — a different
 * table — meaning the Tool output was invisible to FAHomeScreen renderer.
 *
 * <p>Schema bridge: Tools internally work with a flat {@code List<Map>} of
 * {@code {id, type, name, x, y, w, h, visible}}. The persisted
 * {@code modules_config} JSON wraps the list as {@code {"modules": [...]}}
 * with each module shaped to mirror the frontend
 * {@code HomeModule} type (nested {@code gridPosition / gridSize}). This
 * helper converts between the two shapes at the boundary.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FactoryHomeLayoutToolStore {

    private final FactoryHomeLayoutRepository layoutRepository;
    private final ObjectMapper objectMapper;

    private static final TypeReference<List<Map<String, Object>>> LIST_OF_MAPS =
            new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> MAP_TYPE =
            new TypeReference<>() {};

    /**
     * Load the current persisted layout as a flat {@code [{id, type, name,
     * x, y, w, h, visible}]} list — the shape Tools operate on. Falls back
     * to {@code defaults} when no row exists or JSON is missing/malformed.
     */
    public List<Map<String, Object>> loadFlatLayout(String factoryId, List<Map<String, Object>> defaults) {
        try {
            Optional<FactoryHomeLayout> opt = layoutRepository.findByFactoryId(factoryId);
            if (opt.isEmpty() || opt.get().getModulesConfig() == null
                    || opt.get().getModulesConfig().isBlank()) {
                return new ArrayList<>(defaults);
            }
            Map<String, Object> wrapper = objectMapper.readValue(opt.get().getModulesConfig(), MAP_TYPE);
            Object modulesRaw = wrapper.get("modules");
            if (!(modulesRaw instanceof List<?> rawList)) {
                return new ArrayList<>(defaults);
            }
            List<Map<String, Object>> nested = objectMapper.convertValue(rawList, LIST_OF_MAPS);
            return nested.stream().map(this::nestedToFlat).toList();
        } catch (Exception e) {
            log.warn("Tool 加载 factory_home_layout 失败, 用默认布局: {}", e.getMessage());
            return new ArrayList<>(defaults);
        }
    }

    /**
     * Persist the flat layout into {@code factory_home_layout.modules_config}.
     * Sets {@code aiGenerated=1}, updates {@code aiPrompt} when provided,
     * and creates a row when none exists.
     */
    @Transactional
    public void saveFlatLayout(
            String factoryId,
            Long userId,
            List<Map<String, Object>> flatLayout,
            String aiPrompt) {
        try {
            FactoryHomeLayout entity = layoutRepository.findByFactoryId(factoryId)
                    .orElseGet(() -> FactoryHomeLayout.builder()
                            .factoryId(factoryId)
                            .gridColumns(2)
                            .status(0)
                            .version(1)
                            .aiGenerated(0)
                            .timeBasedEnabled(0)
                            .build());

            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("modules", flatLayout.stream().map(this::flatToNested).toList());
            entity.setModulesConfig(objectMapper.writeValueAsString(wrapper));
            entity.setAiGenerated(1);
            if (aiPrompt != null && !aiPrompt.isBlank()) {
                entity.setAiPrompt(aiPrompt);
            }
            // entity.updatedBy 由 BaseEntity 的 @LastModifiedBy/AuditingEntityListener
            // 自动填充 — 这里不显式 set, 保持与 DecorationServiceImpl 一致行为
            // 工具产出默认草稿状态；用户走 UI publish 才转 status=1
            if (entity.getStatus() == null) {
                entity.setStatus(0);
            }
            // last_suggestion_at 给 HomeLayoutSuggestTool 留索引点
            entity.setLastSuggestionAt(LocalDateTime.now());

            layoutRepository.save(entity);
            log.info("Tool 写入 factory_home_layout: factoryId={}, userId={}, moduleCount={}",
                    factoryId, userId, flatLayout.size());
        } catch (Exception e) {
            log.error("Tool 写入 factory_home_layout 失败: factoryId={}, err={}", factoryId, e.getMessage(), e);
            throw new RuntimeException("Tool 写入 factory_home_layout 失败", e);
        }
    }

    // ─── shape bridge ─────────────────────────────────────────────

    /**
     * Flat {@code {x,y,w,h}} → nested
     * {@code {gridPosition:{x,y}, gridSize:{w,h}}} mirror of frontend HomeModule.
     */
    Map<String, Object> flatToNested(Map<String, Object> flat) {
        Map<String, Object> out = new HashMap<>(flat);
        Map<String, Object> gridPos = new HashMap<>();
        gridPos.put("x", flat.getOrDefault("x", 0));
        gridPos.put("y", flat.getOrDefault("y", 0));
        Map<String, Object> gridSize = new HashMap<>();
        gridSize.put("w", flat.getOrDefault("w", 1));
        gridSize.put("h", flat.getOrDefault("h", 1));
        out.put("gridPosition", gridPos);
        out.put("gridSize", gridSize);
        // 同步旧字段, 双消费者都能读
        out.putIfAbsent("order", out.size());
        out.putIfAbsent("colSpan", gridSize.get("w"));
        out.putIfAbsent("rowSpan", gridSize.get("h"));
        if (out.get("title") == null && out.get("name") != null) {
            out.put("title", out.get("name"));
        }
        out.remove("x");
        out.remove("y");
        out.remove("w");
        out.remove("h");
        return out;
    }

    /** Nested → flat, opposite of {@link #flatToNested}. */
    @SuppressWarnings("unchecked")
    Map<String, Object> nestedToFlat(Map<String, Object> nested) {
        Map<String, Object> out = new HashMap<>(nested);
        Object pos = nested.get("gridPosition");
        Object size = nested.get("gridSize");
        if (pos instanceof Map<?, ?> p) {
            out.put("x", ((Map<String, Object>) p).getOrDefault("x", 0));
            out.put("y", ((Map<String, Object>) p).getOrDefault("y", 0));
        } else {
            out.putIfAbsent("x", nested.getOrDefault("x", 0));
            out.putIfAbsent("y", nested.getOrDefault("y", 0));
        }
        if (size instanceof Map<?, ?> s) {
            out.put("w", ((Map<String, Object>) s).getOrDefault("w", out.getOrDefault("colSpan", 1)));
            out.put("h", ((Map<String, Object>) s).getOrDefault("h", out.getOrDefault("rowSpan", 1)));
        } else {
            out.putIfAbsent("w", nested.getOrDefault("colSpan", 1));
            out.putIfAbsent("h", nested.getOrDefault("rowSpan", 1));
        }
        out.remove("gridPosition");
        out.remove("gridSize");
        return out;
    }
}
