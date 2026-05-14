package com.cretas.aims.service.decoration.impl;

import com.cretas.aims.ai.client.PythonLLMClient;
import com.cretas.aims.dto.decoration.AILayoutRequest;
import com.cretas.aims.dto.decoration.AILayoutResponse;
import com.cretas.aims.dto.decoration.HomeLayoutDTO;
import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import com.cretas.aims.repository.FactoryHomeLayoutRepository;
import com.cretas.aims.service.validator.LayoutValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DecorationServiceImpl#generateLayoutWithAI}.
 *
 * <p>Covers the LLM-driven happy path + 5 boundary cases that must route to the
 * rule-based fallback while keeping the API contract intact (frontend
 * AILayoutGenerateResponse shape).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DecorationServiceImpl.generateLayoutWithAI")
class DecorationServiceImplAITest {

    @Mock
    private FactoryHomeLayoutRepository layoutRepository;

    @Mock
    private PythonLLMClient pythonLLMClient;

    @Spy
    private LayoutValidator layoutValidator = new LayoutValidator();

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DecorationServiceImpl service;

    private static final String FACTORY_ID = "F006";

    @BeforeEach
    void seedRepository() {
        when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.empty());
        when(layoutRepository.save(any(FactoryHomeLayout.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private AILayoutRequest req(String prompt) {
        return AILayoutRequest.builder().prompt(prompt).gridColumns(2).build();
    }

    private String validLlmJson() {
        return """
                {
                  "modules": [
                    {"id":"welcome","type":"welcome","name":"欢迎区","visible":true,"order":0,
                     "gridPosition":{"x":0,"y":0},"gridSize":{"w":2,"h":1}},
                    {"id":"stats_grid","type":"stats_grid","name":"数据统计","visible":true,"order":1,
                     "gridPosition":{"x":0,"y":1},"gridSize":{"w":2,"h":2}},
                    {"id":"quick_actions","type":"quick_actions","name":"快捷操作","visible":true,"order":2,
                     "gridPosition":{"x":0,"y":3},"gridSize":{"w":2,"h":1}}
                  ],
                  "theme": {
                    "primaryColor":"#2E7D32","backgroundColor":"#F5F5F5","cardBorderRadius":12
                  },
                  "explanation": "把数据统计放在中部, 上下夹欢迎区和快捷操作。",
                  "suggestions": ["再加 AI 洞察", "切换深色主题"]
                }
                """;
    }

    @Nested
    @DisplayName("Happy path")
    class HappyPath {

        @Test
        @DisplayName("Valid LLM JSON → flat layout returned + LLM model name + persisted")
        void validLlmJson_returnsFlatLayoutAndPersists() {
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(validLlmJson());

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("突出数据"));

            assertThat(resp.getLayout()).hasSize(3);
            assertThat(resp.getLayout())
                    .extracting(HomeLayoutDTO.ModuleConfig::getType)
                    .containsExactly("welcome", "stats_grid", "quick_actions");
            assertThat(resp.getTheme()).isNotNull();
            assertThat(resp.getTheme().getPrimaryColor()).isEqualTo("#2E7D32");
            assertThat(resp.getModelUsed()).isEqualTo("qwen-flash");
            assertThat(resp.getSuggestions()).containsExactly("再加 AI 洞察", "切换深色主题");
            assertThat(resp.getNeedsClarification()).isFalse();
            assertThat(resp.getGridColumns()).isEqualTo(2);

            ArgumentCaptor<FactoryHomeLayout> captor = ArgumentCaptor.forClass(FactoryHomeLayout.class);
            verify(layoutRepository).save(captor.capture());
            assertThat(captor.getValue().getAiGenerated()).isEqualTo(1);
            assertThat(captor.getValue().getAiPrompt()).isEqualTo("突出数据");
            // 持久化的 JSON 应包含 gridPosition 字段 (扁平形态)
            assertThat(captor.getValue().getModulesConfig()).contains("gridPosition");
        }

        @Test
        @DisplayName("Each layout module is normalized with name + ID + grid fields")
        void modulesAreNormalized() {
            // LLM 返回最小字段（无 name/id），normalize 应填充
            String minimal = """
                    {"modules":[
                      {"type":"stats_grid","visible":true,
                       "gridPosition":{"x":0,"y":0},"gridSize":{"w":2,"h":2}}
                    ],"theme":{}}
                    """;
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(minimal);

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("数据"));

            HomeLayoutDTO.ModuleConfig m = resp.getLayout().get(0);
            assertThat(m.getId()).isEqualTo("stats_grid");
            assertThat(m.getName()).isEqualTo("数据统计");
            assertThat(m.getColSpan()).isEqualTo(2);  // back-compat 旧字段也被填
            assertThat(m.getRowSpan()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("Fallback path")
    class FallbackPath {

        @Test
        @DisplayName("LLM throws → rule-based-fallback + still returns flat shape")
        void llmThrows_returnsRuleBasedFallback() {
            when(pythonLLMClient.chatLowTemp(anyString(), anyString()))
                    .thenThrow(new RuntimeException("LLM timeout"));

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("anything"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
            assertThat(resp.getLayout()).isNotEmpty();
            // Fallback 必须仍是扁平 + gridPosition 已填
            assertThat(resp.getLayout())
                    .allSatisfy(m -> assertThat(m.getGridPosition()).isNotNull());
            assertThat(resp.getLayout())
                    .extracting(HomeLayoutDTO.ModuleConfig::getType)
                    .contains("stats_grid");  // fallback 必含 required module
            verify(layoutRepository).save(any(FactoryHomeLayout.class));
        }

        @Test
        @DisplayName("LLM returns non-JSON → fallback")
        void llmReturnsGarbage_fallback() {
            when(pythonLLMClient.chatLowTemp(anyString(), anyString()))
                    .thenReturn("Sure! Here's the layout: ... not JSON");

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
        }

        @Test
        @DisplayName("LLM returns JSON without modules → fallback")
        void llmReturnsJsonMissingModules_fallback() {
            when(pythonLLMClient.chatLowTemp(anyString(), anyString()))
                    .thenReturn("{\"theme\":{\"primaryColor\":\"#000\"}}");

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
        }

        @Test
        @DisplayName("LLM modules use illegal type → filtered, validator rejects (no stats_grid) → fallback")
        void llmReturnsOnlyIllegalTypes_fallback() {
            String illegal = """
                    {"modules":[
                      {"id":"x1","type":"fake_module","visible":true,
                       "gridPosition":{"x":0,"y":0},"gridSize":{"w":1,"h":1}}
                    ]}
                    """;
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(illegal);

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
        }

        @Test
        @DisplayName("LLM modules lack stats_grid (required) → validator rejects → fallback")
        void llmReturnsNoStatsGrid_fallback() {
            String noStats = """
                    {"modules":[
                      {"id":"welcome","type":"welcome","visible":true,
                       "gridPosition":{"x":0,"y":0},"gridSize":{"w":2,"h":1}}
                    ]}
                    """;
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(noStats);

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
        }

        @Test
        @DisplayName("LLM size exceeds constraint (w=3 > 2) → validator rejects → fallback")
        void llmOversizedModule_fallback() {
            String oversized = """
                    {"modules":[
                      {"id":"stats_grid","type":"stats_grid","visible":true,
                       "gridPosition":{"x":0,"y":0},"gridSize":{"w":3,"h":2}}
                    ]}
                    """;
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(oversized);

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("rule-based-fallback");
        }

        @Test
        @DisplayName("LLM JSON wrapped in markdown fences is still parsed (cleaned)")
        void llmJsonWithMarkdownFences_isParsed() {
            String fenced = "```json\n" + validLlmJson() + "\n```";
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(fenced);

            AILayoutResponse resp = service.generateLayoutWithAI(FACTORY_ID, req("a"));

            assertThat(resp.getModelUsed()).isEqualTo("qwen-flash");
            assertThat(resp.getLayout()).hasSize(3);
        }
    }

    @Nested
    @DisplayName("Request context")
    class RequestContext {

        @Test
        @DisplayName("currentLayout + stylePreference + currentTheme are sent into user prompt")
        void contextFieldsFlowIntoPrompt() {
            ArgumentCaptor<String> userPromptCaptor = ArgumentCaptor.forClass(String.class);
            when(pythonLLMClient.chatLowTemp(anyString(), userPromptCaptor.capture()))
                    .thenReturn(validLlmJson());

            HomeLayoutDTO.ModuleConfig existing = HomeLayoutDTO.ModuleConfig.builder()
                    .id("welcome").type("welcome").build();
            HomeLayoutDTO.ThemeConfig existingTheme = HomeLayoutDTO.ThemeConfig.builder()
                    .primaryColor("#000000").build();
            AILayoutRequest r = AILayoutRequest.builder()
                    .prompt("调整")
                    .currentLayout(List.of(existing))
                    .stylePreference("minimal")
                    .currentTheme(existingTheme)
                    .pageType("home")
                    .operationType("update_style")
                    .build();

            service.generateLayoutWithAI(FACTORY_ID, r);

            String userPrompt = userPromptCaptor.getValue();
            assertThat(userPrompt).contains("调整");
            assertThat(userPrompt).contains("minimal");
            assertThat(userPrompt).contains("home");
            assertThat(userPrompt).contains("update_style");
            assertThat(userPrompt).contains("\"id\":\"welcome\"");
            assertThat(userPrompt).contains("#000000");
        }

        @Test
        @DisplayName("System prompt lists all 5 module types + stats_grid required note")
        void systemPromptListsWhitelist() {
            ArgumentCaptor<String> systemPromptCaptor = ArgumentCaptor.forClass(String.class);
            when(pythonLLMClient.chatLowTemp(systemPromptCaptor.capture(), anyString()))
                    .thenReturn(validLlmJson());

            service.generateLayoutWithAI(FACTORY_ID, req("a"));

            String sys = systemPromptCaptor.getValue();
            assertThat(sys).contains("welcome", "ai_insight", "stats_grid", "quick_actions", "dev_tools");
            assertThat(sys).contains("stats_grid");
            assertThat(sys).contains("必须存在");
        }
    }

    @Nested
    @DisplayName("Persistence")
    class Persistence {

        @Test
        @DisplayName("Update existing FactoryHomeLayout row when one exists")
        void updatesExistingRow() {
            FactoryHomeLayout existing = FactoryHomeLayout.builder()
                    .factoryId(FACTORY_ID)
                    .modulesConfig("{}")
                    .themeConfig("{}")
                    .build();
            when(layoutRepository.findByFactoryId(FACTORY_ID)).thenReturn(Optional.of(existing));
            when(pythonLLMClient.chatLowTemp(anyString(), anyString())).thenReturn(validLlmJson());

            service.generateLayoutWithAI(FACTORY_ID, req("a"));

            ArgumentCaptor<FactoryHomeLayout> captor = ArgumentCaptor.forClass(FactoryHomeLayout.class);
            verify(layoutRepository).save(captor.capture());
            // 应保存的是原 row, 不是 new 一个
            assertThat(captor.getValue()).isSameAs(existing);
            assertThat(captor.getValue().getAiGenerated()).isEqualTo(1);
        }

        @Test
        @DisplayName("Save is called exactly once even when fallback fires")
        void singleSaveOnFallback() {
            when(pythonLLMClient.chatLowTemp(anyString(), anyString()))
                    .thenThrow(new RuntimeException("boom"));

            service.generateLayoutWithAI(FACTORY_ID, req("a"));

            verify(layoutRepository, times(1)).save(any(FactoryHomeLayout.class));
            verify(layoutRepository, never()).delete(any());
        }
    }
}
