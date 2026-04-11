package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.dto.python.PythonRestaurantSectionResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class AbstractRestaurantDiagnosticToolTest {

    private PythonSmartBIClient mockClient;
    private TestableDiagnosticTool tool;

    @BeforeEach
    void setup() {
        mockClient = Mockito.mock(PythonSmartBIClient.class);
        tool = new TestableDiagnosticTool(mockClient);
    }

    @Test
    void delegatesToPythonSectionAndWrapsResult() throws Exception {
        PythonRestaurantSectionResponse fakeResponse = new PythonRestaurantSectionResponse();
        fakeResponse.setSuccess(true);
        fakeResponse.setStatus("ok");
        fakeResponse.setSectionName("cost_rigidity");
        fakeResponse.setData(Map.of("costRigidity", 0.561, "severity", "critical"));
        fakeResponse.setWarnings(List.of());

        when(mockClient.callRestaurantSection(eq("cost_rigidity"), any()))
            .thenReturn(Optional.of(fakeResponse));

        Map<String, Object> result = tool.doExecute(
            "F-DINGXIAN-YIWU",
            Map.of("sub_sector", "火锅"),
            Map.of("financial_data", Map.of("current", Map.of("revenue", 731048)))
        );

        assertThat(result).containsEntry("success", true);
        assertThat(result).containsKey("section");
        assertThat(result).containsKey("data");
        assertThat(((Map<?, ?>) result.get("data")).get("costRigidity")).isEqualTo(0.561);
    }

    @Test
    void returnsErrorWhenPythonUnavailable() throws Exception {
        when(mockClient.callRestaurantSection(any(), any())).thenReturn(Optional.empty());

        Map<String, Object> result = tool.doExecute(
            "F001",
            Map.of("sub_sector", "火锅"),
            Map.of()
        );

        assertThat(result).containsEntry("success", false);
        assertThat((String) result.get("message")).containsIgnoringCase("python");
    }

    @Test
    void returnsErrorWhenPythonReturnsSkipped() throws Exception {
        PythonRestaurantSectionResponse skipResponse = new PythonRestaurantSectionResponse();
        skipResponse.setSuccess(false);
        skipResponse.setStatus("skipped");
        skipResponse.setSectionName("cost_rigidity");
        skipResponse.setWarnings(List.of("未提供 financial_data.previous (需要环比数据)"));

        when(mockClient.callRestaurantSection(eq("cost_rigidity"), any()))
            .thenReturn(Optional.of(skipResponse));

        Map<String, Object> result = tool.doExecute(
            "F001",
            Map.of("sub_sector", "火锅"),
            Map.of()
        );

        assertThat(result).containsEntry("success", false);
        assertThat((String) result.get("message")).contains("cost_rigidity");
        assertThat((String) result.get("message")).contains("previous");
    }

    /** Test double that hardcodes the section name. */
    static class TestableDiagnosticTool extends AbstractRestaurantDiagnosticTool {
        TestableDiagnosticTool(PythonSmartBIClient client) {
            this.pythonClient = client;
        }
        @Override public String getToolName() { return "restaurant_test_diagnostic"; }
        @Override public String getDescription() { return "测试用"; }
        @Override protected String getSectionName() { return "cost_rigidity"; }
    }
}
