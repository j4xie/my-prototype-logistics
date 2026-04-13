package com.cretas.aims.service.config.impl;

import com.cretas.aims.entity.config.FactoryConfiguration;
import com.cretas.aims.entity.config.FactoryModuleConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.ConfigChangeLogRepository;
import com.cretas.aims.repository.config.FactoryConfigurationRepository;
import com.cretas.aims.repository.config.FactoryModuleConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FactoryConfigServiceImplReorderTest {

    @Mock private FactoryConfigurationRepository factoryConfigurationRepository;
    @Mock private FactoryModuleConfigRepository factoryModuleConfigRepository;
    @Mock private ConfigChangeLogRepository configChangeLogRepository;

    @InjectMocks
    private FactoryConfigServiceImpl service;

    private FactoryConfiguration draft;
    private FactoryModuleConfig moduleConfig;

    @BeforeEach
    void setUp() {
        draft = new FactoryConfiguration();
        draft.setFactoryId("F001");
        draft.setConfigVersion(1);
        draft.setStatus("DRAFT");
        draft.setRowVersion(5L);

        moduleConfig = new FactoryModuleConfig();
        moduleConfig.setFactoryId("F001");
        moduleConfig.setModuleCode("sales_order");
        moduleConfig.setConfigVersion(1);

        Map<String, Object> fields = new HashMap<>();
        Map<String, Object> fieldA = new HashMap<>();
        fieldA.put("sortOrder", 10);
        Map<String, Object> fieldB = new HashMap<>();
        fieldB.put("sortOrder", 20);
        fields.put("field_a", fieldA);
        fields.put("field_b", fieldB);
        Map<String, Object> fc = new HashMap<>();
        fc.put("fields", fields);
        moduleConfig.setFieldConfig(fc);
    }

    @Test
    void reorderFields_succeeds_whenVersionMatches() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.of(draft));
        when(factoryModuleConfigRepository.findByFactoryIdAndModuleCodeAndConfigVersion(
                "F001", "sales_order", 1)).thenReturn(Optional.of(moduleConfig));
        when(factoryModuleConfigRepository.save(any())).thenReturn(moduleConfig);

        Map<String, Object> result = service.reorderFields(
                "F001", "sales_order", List.of("field_b", "field_a"), 5L, 1L);

        assertNotNull(result);
        assertEquals(2, result.get("reorderedCount"));
        verify(factoryModuleConfigRepository).save(any(FactoryModuleConfig.class));
        verify(configChangeLogRepository).save(any());
    }

    @Test
    void reorderFields_throws_whenVersionMismatch() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.of(draft));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.reorderFields("F001", "sales_order", List.of("field_a"), 99L, 1L));

        assertTrue(ex.getMessage().contains("版本"), "expected version mismatch message");
        verify(factoryModuleConfigRepository, never()).save(any());
    }

    @Test
    void reorderFields_throws_whenNoDraft() {
        when(factoryConfigurationRepository.findDraft("F001")).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.reorderFields("F001", "sales_order", List.of("field_a"), 5L, 1L));

        assertTrue(ex.getMessage().contains("DRAFT"), "expected missing-draft message");
    }
}
