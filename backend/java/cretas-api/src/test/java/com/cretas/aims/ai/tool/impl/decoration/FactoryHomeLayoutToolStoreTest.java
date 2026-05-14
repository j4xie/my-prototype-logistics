package com.cretas.aims.ai.tool.impl.decoration;

import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import com.cretas.aims.repository.FactoryHomeLayoutRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link FactoryHomeLayoutToolStore}: shape bridge correctness +
 * persistence semantics for the 3 decoration Tools.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FactoryHomeLayoutToolStore")
class FactoryHomeLayoutToolStoreTest {

    @Mock
    private FactoryHomeLayoutRepository layoutRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private FactoryHomeLayoutToolStore store;

    private static final String FACTORY_ID = "F006";

    private List<Map<String, Object>> defaultModules() {
        return List.of(
                Map.of("id", "stats_grid", "type", "stats_grid", "name", "数据统计",
                        "x", 0, "y", 0, "w", 2, "h", 2, "visible", true)
        );
    }

    @Test
    @DisplayName("flatToNested wraps x/y into gridPosition and w/h into gridSize")
    void flatToNested_correctShape() {
        Map<String, Object> flat = Map.of(
                "id", "welcome", "type", "welcome", "name", "欢迎",
                "x", 0, "y", 0, "w", 2, "h", 1, "visible", true);

        Map<String, Object> nested = store.flatToNested(flat);

        assertThat(nested).doesNotContainKeys("x", "y", "w", "h");
        assertThat(nested.get("gridPosition")).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) nested.get("gridPosition")).get("x")).isEqualTo(0);
        assertThat(((Map<?, ?>) nested.get("gridPosition")).get("y")).isEqualTo(0);
        assertThat(((Map<?, ?>) nested.get("gridSize")).get("w")).isEqualTo(2);
        assertThat(((Map<?, ?>) nested.get("gridSize")).get("h")).isEqualTo(1);
        // 旧字段也被回填给老 caller
        assertThat(nested.get("colSpan")).isEqualTo(2);
        assertThat(nested.get("rowSpan")).isEqualTo(1);
        assertThat(nested.get("title")).isEqualTo("欢迎");
    }

    @Test
    @DisplayName("nestedToFlat unwraps gridPosition / gridSize back to x/y/w/h")
    void nestedToFlat_correctShape() {
        Map<String, Object> nested = Map.of(
                "id", "stats_grid", "type", "stats_grid",
                "gridPosition", Map.of("x", 0, "y", 2),
                "gridSize", Map.of("w", 2, "h", 2),
                "visible", true);

        Map<String, Object> flat = store.nestedToFlat(nested);

        assertThat(flat).doesNotContainKeys("gridPosition", "gridSize");
        assertThat(flat.get("x")).isEqualTo(0);
        assertThat(flat.get("y")).isEqualTo(2);
        assertThat(flat.get("w")).isEqualTo(2);
        assertThat(flat.get("h")).isEqualTo(2);
    }

    @Test
    @DisplayName("nestedToFlat falls back to colSpan/rowSpan when gridSize missing")
    void nestedToFlat_fallbackOldFields() {
        Map<String, Object> oldShape = Map.of(
                "id", "welcome", "type", "welcome",
                "order", 0, "colSpan", 2, "rowSpan", 1,
                "visible", true);

        Map<String, Object> flat = store.nestedToFlat(oldShape);

        assertThat(flat.get("w")).isEqualTo(2);
        assertThat(flat.get("h")).isEqualTo(1);
    }

    @Test
    @DisplayName("loadFlatLayout returns defaults when no row exists")
    void loadFlatLayout_noRow_returnsDefaults() {
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.empty());

        List<Map<String, Object>> result = store.loadFlatLayout(FACTORY_ID, defaultModules());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("id")).isEqualTo("stats_grid");
    }

    @Test
    @DisplayName("loadFlatLayout returns defaults when modules_config is blank")
    void loadFlatLayout_blankModulesConfig_returnsDefaults() {
        FactoryHomeLayout row = FactoryHomeLayout.builder().factoryId(FACTORY_ID).modulesConfig("").build();
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.of(row));

        List<Map<String, Object>> result = store.loadFlatLayout(FACTORY_ID, defaultModules());

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("loadFlatLayout reads stored nested shape and returns flat form")
    void loadFlatLayout_returnsFlatFromNested() throws JsonProcessingException {
        String storedJson = objectMapper.writeValueAsString(Map.of(
                "modules", List.of(
                        Map.of("id", "stats_grid", "type", "stats_grid",
                                "gridPosition", Map.of("x", 0, "y", 0),
                                "gridSize", Map.of("w", 2, "h", 2),
                                "visible", true))));
        FactoryHomeLayout row = FactoryHomeLayout.builder()
                .factoryId(FACTORY_ID).modulesConfig(storedJson).build();
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.of(row));

        List<Map<String, Object>> result = store.loadFlatLayout(FACTORY_ID, defaultModules());

        assertThat(result).hasSize(1);
        Map<String, Object> m = result.get(0);
        assertThat(m).doesNotContainKeys("gridPosition", "gridSize");
        assertThat(m.get("x")).isEqualTo(0);
        assertThat(m.get("y")).isEqualTo(0);
        assertThat(m.get("w")).isEqualTo(2);
        assertThat(m.get("h")).isEqualTo(2);
    }

    @Test
    @DisplayName("loadFlatLayout falls back to defaults on malformed JSON")
    void loadFlatLayout_malformedJson_returnsDefaults() {
        FactoryHomeLayout row = FactoryHomeLayout.builder()
                .factoryId(FACTORY_ID).modulesConfig("not-json").build();
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.of(row));

        List<Map<String, Object>> result = store.loadFlatLayout(FACTORY_ID, defaultModules());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("id")).isEqualTo("stats_grid");
    }

    @Test
    @DisplayName("saveFlatLayout writes wrapped {modules:[...]} JSON + aiGenerated=1")
    void saveFlatLayout_persistsWrappedJson() throws JsonProcessingException {
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.empty());
        when(layoutRepository.save(any(FactoryHomeLayout.class))).thenAnswer(inv -> inv.getArgument(0));

        List<Map<String, Object>> flat = List.of(
                Map.of("id", "stats_grid", "type", "stats_grid", "name", "数据统计",
                        "x", 0, "y", 0, "w", 2, "h", 2, "visible", true));

        store.saveFlatLayout(FACTORY_ID, 42L, flat, "把数据放顶部");

        ArgumentCaptor<FactoryHomeLayout> captor = ArgumentCaptor.forClass(FactoryHomeLayout.class);
        org.mockito.Mockito.verify(layoutRepository).save(captor.capture());
        FactoryHomeLayout saved = captor.getValue();
        assertThat(saved.getFactoryId()).isEqualTo(FACTORY_ID);
        assertThat(saved.getAiGenerated()).isEqualTo(1);
        assertThat(saved.getAiPrompt()).isEqualTo("把数据放顶部");
        assertThat(saved.getLastSuggestionAt()).isNotNull();
        // 持久化的 modules_config 必须是 {"modules": [...]} 包装并含 gridPosition/gridSize
        Map<String, Object> parsed = objectMapper.readValue(saved.getModulesConfig(), new TypeReference<>() {});
        assertThat(parsed).containsKey("modules");
        List<?> mods = (List<?>) parsed.get("modules");
        assertThat(mods).hasSize(1);
        @SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) mods.get(0);
        assertThat(m).containsKey("gridPosition");
        assertThat(m).containsKey("gridSize");
        assertThat(m).doesNotContainKeys("x", "y", "w", "h");
    }

    @Test
    @DisplayName("saveFlatLayout updates existing row instead of creating new one")
    void saveFlatLayout_updatesExisting() {
        FactoryHomeLayout existing = FactoryHomeLayout.builder()
                .factoryId(FACTORY_ID).status(1).version(2).modulesConfig("{}").themeConfig("{}").build();
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.of(existing));
        when(layoutRepository.save(any(FactoryHomeLayout.class))).thenAnswer(inv -> inv.getArgument(0));

        store.saveFlatLayout(FACTORY_ID, 1L,
                List.of(Map.of("id", "stats_grid", "type", "stats_grid",
                        "x", 0, "y", 0, "w", 2, "h", 2, "visible", true)),
                null);

        ArgumentCaptor<FactoryHomeLayout> captor = ArgumentCaptor.forClass(FactoryHomeLayout.class);
        org.mockito.Mockito.verify(layoutRepository).save(captor.capture());
        assertThat(captor.getValue()).isSameAs(existing);
        assertThat(captor.getValue().getAiGenerated()).isEqualTo(1);
        // status (1=published) and version (2) preserved
        assertThat(captor.getValue().getStatus()).isEqualTo(1);
        assertThat(captor.getValue().getVersion()).isEqualTo(2);
    }
}
