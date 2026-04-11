package com.cretas.aims.service.skill;

import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.repository.smartbi.SmartBiSkillRepository;
import com.cretas.aims.service.skill.impl.SkillRegistryImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit test for 2 new restaurant skills added in P2.7.
 *
 * Constructs {@link SkillRegistryImpl} directly with mocked dependencies
 * and invokes the private {@code initializeDefaultSkills()} via reflection.
 * Avoids {@code @SpringBootTest} to keep the test fast and independent of
 * Spring context, database, or classpath scanning.
 */
class RestaurantSkillsRegistrationTest {

    private SkillRegistryImpl registry;

    @BeforeEach
    void setUp() throws Exception {
        SmartBiSkillRepository mockRepo = mock(SmartBiSkillRepository.class);
        when(mockRepo.findAll()).thenReturn(Collections.emptyList());

        ObjectMapper mapper = new ObjectMapper();
        registry = new SkillRegistryImpl(mockRepo, mapper);

        // loadDefaults is @Value-injected and defaults to false for tests.
        // Set it true via reflection so initializeDefaultSkills() is reachable
        // via the public loadSkills() → initializeDefaultSkills() path.
        Field loadDefaultsField = SkillRegistryImpl.class.getDeclaredField("loadDefaults");
        loadDefaultsField.setAccessible(true);
        loadDefaultsField.setBoolean(registry, true);

        // Invoke initializeDefaultSkills() directly (private method) to isolate
        // the test from classpath and database loading steps.
        Method initMethod = SkillRegistryImpl.class.getDeclaredMethod("initializeDefaultSkills");
        initMethod.setAccessible(true);
        initMethod.invoke(registry);
    }

    @Test
    void restaurantDiagnosticsSkillRegistered() {
        Optional<SkillDefinition> skill = registry.getSkill("restaurant-diagnostics");
        assertThat(skill).isPresent();

        SkillDefinition def = skill.get();
        assertThat(def.getDisplayName()).isEqualTo("餐饮经营深度诊断");
        assertThat(def.getTriggers()).contains("经营诊断", "深度分析", "为什么亏损", "刚性", "对标");
        assertThat(def.getTools()).contains(
                "restaurant_cost_rigidity_analysis",
                "restaurant_benchmark_alert",
                "restaurant_channel_margin",
                "restaurant_dining_heatmap",
                "restaurant_long_tail_sku",
                "restaurant_menu_normalization",
                "restaurant_review_analysis",
                "restaurant_member_rfm",
                "restaurant_stored_value",
                "restaurant_store_pnl_one_pager",
                "restaurant_bom_layer_status",
                "restaurant_menu_engineering"
        );
        assertThat(def.getContextNeeded()).contains("factoryId");
        assertThat(def.isEnabled()).isTrue();
    }

    @Test
    void restaurantChainAnalysisSkillRegistered() {
        Optional<SkillDefinition> skill = registry.getSkill("restaurant-chain-analysis");
        assertThat(skill).isPresent();

        SkillDefinition def = skill.get();
        assertThat(def.getDisplayName()).isEqualTo("餐饮连锁分析");
        assertThat(def.getTriggers()).contains("连锁", "多店对比", "门店排名", "同店同比");
        assertThat(def.getTools()).containsExactlyInAnyOrder(
                "restaurant_multi_store_comparison",
                "restaurant_calibration_history",
                "restaurant_temporal_comparison"
        );
        assertThat(def.getContextNeeded()).contains("factoryId");
        assertThat(def.isEnabled()).isTrue();
    }

    @Test
    void existingRestaurantOperationsSkillStillRegistered() {
        // Regression: adding new skills must not break existing ones.
        Optional<SkillDefinition> opsSkill = registry.getSkill("restaurant-operations");
        assertThat(opsSkill).isPresent();

        Optional<SkillDefinition> wastageSkill = registry.getSkill("restaurant-wastage");
        assertThat(wastageSkill).isPresent();
    }
}
