import { ref, computed } from 'vue';

export type ThemeName = 'business' | 'tech' | 'warm' | 'minimal';

interface ThemeConfig {
  name: ThemeName;
  label: string;
  colors: string[];
  backgroundColor: string;
  textColor: string;
  axisColor: string;
  splitLineColor: string;
}

const THEMES: Record<ThemeName, ThemeConfig> = {
  business: {
    name: 'business',
    label: '商务蓝',
    colors: ['#1B65A8', '#2B98D1', '#5BC0EB', '#9AD4E8', '#2E86AB', '#A23B72', '#F18F01', '#C73E1D'],
    backgroundColor: '#ffffff',
    textColor: '#303133',
    axisColor: '#909399',
    splitLineColor: '#E4E7ED'
  },
  tech: {
    name: 'tech',
    label: '科技感',
    colors: ['#00D4FF', '#7B68EE', '#FF6B9D', '#C084FC', '#34D399', '#FBBF24', '#F87171', '#60A5FA'],
    backgroundColor: '#0f172a',
    textColor: '#e2e8f0',
    axisColor: '#64748b',
    splitLineColor: '#1e293b'
  },
  warm: {
    name: 'warm',
    label: '暖色调',
    colors: ['#E8553A', '#F4A261', '#E9C46A', '#2A9D8F', '#264653', '#E76F51', '#F4A261', '#287271'],
    backgroundColor: '#fffbf5',
    textColor: '#3d3d3d',
    axisColor: '#8a8a8a',
    splitLineColor: '#f0e6d8'
  },
  minimal: {
    name: 'minimal',
    label: '简约灰',
    colors: ['#4A4A4A', '#7B7B7B', '#A0A0A0', '#C8C8C8', '#333333', '#666666', '#999999', '#BFBFBF'],
    backgroundColor: '#fafafa',
    textColor: '#333333',
    axisColor: '#999999',
    splitLineColor: '#ececec'
  }
};

const currentTheme = ref<ThemeName>('business');

export function useChartTheme() {
  const theme = computed(() => THEMES[currentTheme.value]);
  const themeList = Object.values(THEMES);

  function setTheme(name: ThemeName) {
    currentTheme.value = name;
    localStorage.setItem('smartbi-chart-theme', name);
  }

  function getEChartsThemeOverrides() {
    const t = theme.value;
    return {
      color: t.colors,
      backgroundColor: t.backgroundColor,
      textStyle: { color: t.textColor },
      title: { textStyle: { color: t.textColor } },
      legend: { textStyle: { color: t.textColor } },
      xAxis: {
        axisLine: { lineStyle: { color: t.axisColor } },
        axisLabel: { color: t.axisColor },
        splitLine: { lineStyle: { color: t.splitLineColor } }
      },
      yAxis: {
        axisLine: { lineStyle: { color: t.axisColor } },
        axisLabel: { color: t.axisColor },
        splitLine: { lineStyle: { color: t.splitLineColor } }
      }
    };
  }

  // Merge theme overrides into any ECharts option
  function applyTheme(option: Record<string, any>): Record<string, any> {
    const overrides = getEChartsThemeOverrides();
    return {
      ...option,
      color: overrides.color,
      backgroundColor: overrides.backgroundColor,
      textStyle: { ...(option.textStyle || {}), ...overrides.textStyle },
      title: { ...(option.title || {}), textStyle: { ...(option.title?.textStyle || {}), ...overrides.title.textStyle } },
      legend: { ...(option.legend || {}), textStyle: { ...(option.legend?.textStyle || {}), ...overrides.legend.textStyle } },
      xAxis: Array.isArray(option.xAxis)
        ? option.xAxis.map((x: any) => ({ ...x, axisLine: { ...x?.axisLine, lineStyle: { ...x?.axisLine?.lineStyle, color: overrides.xAxis.axisLine.lineStyle.color } }, axisLabel: { ...x?.axisLabel, color: overrides.xAxis.axisLabel.color }, splitLine: { ...x?.splitLine, lineStyle: { ...x?.splitLine?.lineStyle, color: overrides.xAxis.splitLine.lineStyle.color } } }))
        : option.xAxis ? { ...option.xAxis, axisLine: { ...option.xAxis?.axisLine, lineStyle: { ...option.xAxis?.axisLine?.lineStyle, color: overrides.xAxis.axisLine.lineStyle.color } }, axisLabel: { ...option.xAxis?.axisLabel, color: overrides.xAxis.axisLabel.color }, splitLine: { ...option.xAxis?.splitLine, lineStyle: { ...option.xAxis?.splitLine?.lineStyle, color: overrides.xAxis.splitLine.lineStyle.color } } } : undefined,
      yAxis: Array.isArray(option.yAxis)
        ? option.yAxis.map((y: any) => ({ ...y, axisLine: { ...y?.axisLine, lineStyle: { ...y?.axisLine?.lineStyle, color: overrides.yAxis.axisLine.lineStyle.color } }, axisLabel: { ...y?.axisLabel, color: overrides.yAxis.axisLabel.color }, splitLine: { ...y?.splitLine, lineStyle: { ...y?.splitLine?.lineStyle, color: overrides.yAxis.splitLine.lineStyle.color } } }))
        : option.yAxis ? { ...option.yAxis, axisLine: { ...option.yAxis?.axisLine, lineStyle: { ...option.yAxis?.axisLine?.lineStyle, color: overrides.yAxis.axisLine.lineStyle.color } }, axisLabel: { ...option.yAxis?.axisLabel, color: overrides.yAxis.axisLabel.color }, splitLine: { ...option.yAxis?.splitLine, lineStyle: { ...option.yAxis?.splitLine?.lineStyle, color: overrides.yAxis.splitLine.lineStyle.color } } } : undefined
    };
  }

  // Init from localStorage
  const saved = localStorage.getItem('smartbi-chart-theme');
  if (saved && saved in THEMES) {
    currentTheme.value = saved as ThemeName;
  }

  return {
    theme,
    themeList,
    currentTheme,
    setTheme,
    applyTheme,
    getEChartsThemeOverrides
  };
}
