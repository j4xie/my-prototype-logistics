package com.cretas.aims.service.impl;

import com.cretas.aims.engine.DynamicFieldService;
import com.cretas.aims.engine.ValidationRuleEvaluator;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.repository.ProductionAlertRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Round 10 Task 4 — verifies Canvas Integration Template wiring in
 * QualityInspectionServiceImpl.createInspection:
 * <ol>
 *   <li>dynamicFieldService.setDynamicFields is called with module "quality_inspection"
 *       when customFields is populated</li>
 *   <li>setDynamicFields is skipped when customFields is empty (no wasted DB call)</li>
 * </ol>
 *
 * <p>A refactor that removes the dynamic-field hook would regress customer-configured
 * fields to "silently dropped" — this test catches that at build time.</p>
 */
@ExtendWith(MockitoExtension.class)
class QualityInspectionServiceImplTemplateTest {

    @Mock private QualityInspectionRepository qualityInspectionRepository;
    @Mock private ProductionAlertRepository productionAlertRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ValidationRuleEvaluator validationRuleEvaluator;
    @Mock private DynamicFieldService dynamicFieldService;

    @InjectMocks
    private QualityInspectionServiceImpl service;

    @BeforeEach
    void setUp() {
        // @InjectMocks handles constructor-injected final fields; the two optional
        // @Autowired fields (validationRuleEvaluator, dynamicFieldService) are set
        // via reflection because Mockito does not populate field-level @Autowired.
        ReflectionTestUtils.setField(service, "validationRuleEvaluator", validationRuleEvaluator);
        ReflectionTestUtils.setField(service, "dynamicFieldService", dynamicFieldService);
    }

    @Test
    void createInspection_withCustomFields_invokesSetDynamicFields() {
        QualityInspection input = new QualityInspection();
        input.setId("qi-1");
        input.setProductionBatchId(42L);
        input.setResult("PASS");
        input.setPassRate(new BigDecimal("99.0"));
        Map<String, Object> cf = new HashMap<>();
        cf.put("reinspectResult", "PASS");
        cf.put("temperatureDeviation", new BigDecimal("0.5"));
        input.setCustomFields(cf);

        when(qualityInspectionRepository.save(any(QualityInspection.class))).thenAnswer(inv -> inv.getArgument(0));

        QualityInspection saved = service.createInspection("F001", input);

        assertEquals("qi-1", saved.getId());
        verify(dynamicFieldService, times(1))
                .setDynamicFields(eq("F001"), eq("quality_inspection"), eq("qi-1"), eq(cf));
    }

    @Test
    void createInspection_withoutCustomFields_skipsSetDynamicFields() {
        QualityInspection input = new QualityInspection();
        input.setId("qi-2");
        input.setProductionBatchId(43L);
        input.setResult("PASS");
        input.setPassRate(new BigDecimal("98.0"));
        input.setCustomFields(new HashMap<>());

        when(qualityInspectionRepository.save(any(QualityInspection.class))).thenAnswer(inv -> inv.getArgument(0));

        service.createInspection("F001", input);

        verify(dynamicFieldService, never())
                .setDynamicFields(any(), any(), any(), any());
    }
}
