package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.ForecastPoint;
import com.cretas.aims.dto.smartbi.ForecastResult;
import com.cretas.aims.dto.smartbi.PythonForecastResponse;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForecastServiceImplTest {

    @Mock private SmartBiSalesDataRepository salesDataRepository;
    @Mock private PythonSmartBIClient pythonClient;
    @Mock private PythonSmartBIConfig pythonConfig;

    @InjectMocks
    private ForecastServiceImpl service;

    @BeforeEach
    void setUp() {
        lenient().when(pythonConfig.isEnabled()).thenReturn(true);
        lenient().when(pythonClient.isAvailable()).thenReturn(true);
    }

    @Test
    void forecastSales_emptyTrend_returnsEmptyWithoutCallingPython() throws IOException {
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any()))
                .thenReturn(List.of());

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 28), 7);

        assertNotNull(result);
        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
        verify(pythonClient, never()).forecastWithData(any(), anyInt(), anyString());
    }

    @Test
    void forecastSales_fewerThan3Points_returnsEmptyWithoutCallingPython() throws IOException {
        List<Object[]> trend = List.of(
                new Object[]{LocalDate.of(2025, 2, 1), new BigDecimal("100.00"), new BigDecimal("10")},
                new Object[]{LocalDate.of(2025, 2, 2), new BigDecimal("120.00"), new BigDecimal("12")}
        );
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 2), 7);

        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
        verify(pythonClient, never()).forecastWithData(any(), anyInt(), anyString());
    }

    @Test
    void forecastSales_happyPath_mapsResponseToForecastPoints() throws IOException {
        LocalDate start = LocalDate.of(2025, 2, 1);
        LocalDate end = LocalDate.of(2025, 2, 28);

        List<Object[]> trend = java.util.stream.IntStream.range(0, 28)
                .<Object[]>mapToObj(i -> new Object[]{
                        start.plusDays(i),
                        new BigDecimal("100.0").add(new BigDecimal(i)),
                        new BigDecimal("10")
                })
                .toList();
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);

        PythonForecastResponse mockResp = new PythonForecastResponse();
        mockResp.setSuccess(true);
        mockResp.setAlgorithm("moving_average");
        mockResp.setPredictions(List.of(130.0, 131.0, 132.0));
        mockResp.setLowerBound(List.of(120.0, 121.0, 122.0));
        mockResp.setUpperBound(List.of(140.0, 141.0, 142.0));
        when(pythonClient.forecastWithData(anyList(), eq(3), anyString())).thenReturn(mockResp);

        ForecastResult result = service.forecastSales("F001", start, end, 3);

        assertNotNull(result.getForecastPoints());
        assertEquals(3, result.getForecastPoints().size());
        ForecastPoint p0 = result.getForecastPoints().get(0);
        assertEquals(LocalDate.of(2025, 3, 1), p0.getDate());
        assertEquals(0, p0.getValue().compareTo(new BigDecimal("130.00")));
        assertEquals(0, p0.getLowerBound().compareTo(new BigDecimal("120.00")));
        assertEquals(0, p0.getUpperBound().compareTo(new BigDecimal("140.00")));
        assertEquals(LocalDate.of(2025, 3, 2), result.getForecastPoints().get(1).getDate());
        assertEquals(LocalDate.of(2025, 3, 3), result.getForecastPoints().get(2).getDate());
    }

    @Test
    void forecastSales_pythonIOException_returnsEmptyNotThrows() throws IOException {
        List<Object[]> trend = java.util.stream.IntStream.range(0, 5)
                .<Object[]>mapToObj(i -> new Object[]{
                        LocalDate.of(2025, 2, 1).plusDays(i),
                        new BigDecimal("100.00"),
                        new BigDecimal("10")
                })
                .toList();
        when(salesDataRepository.findDailySalesTrend(anyString(), any(), any())).thenReturn(trend);
        when(pythonClient.forecastWithData(anyList(), anyInt(), anyString()))
                .thenThrow(new IOException("simulated network failure"));

        ForecastResult result = service.forecastSales("F001",
                LocalDate.of(2025, 2, 1), LocalDate.of(2025, 2, 5), 3);

        assertTrue(result.getForecastPoints() == null || result.getForecastPoints().isEmpty());
    }
}
