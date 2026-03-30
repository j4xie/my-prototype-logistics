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
    colors: ['#2D8B57', '#2B98D1', '#5BC0EB', '#9AD4E8', '#2E86AB', '#A23B72', '#F18F01', '#C73E1D'],
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
  function applyTheme(option: Record<string, unknown>): Record<string, unknown> {
    const overrides = getEChartsThemeOverrides();
    const mergeAxis = (ax: Record<string, unknown>) => {
      const axisLine = (ax?.axisLine || {}) as Record<string, unknown>;
      const lineStyle = (axisLine?.lineStyle || {}) as Record<string, unknown>;
      const axisLabel = (ax?.axisLabel || {}) as Record<string, unknown>;
      const splitLine = (ax?.splitLine || {}) as Record<string, unknown>;
      const splitLineStyle = (splitLine?.lineStyle || {}) as Record<string, unknown>;
      return {
        ...ax,
        axisLine: { ...axisLine, lineStyle: { ...lineStyle, color: overrides.xAxis.axisLine.lineStyle.color } },
        axisLabel: { ...axisLabel, color: overrides.xAxis.axisLabel.color },
        splitLine: { ...splitLine, lineStyle: { ...splitLineStyle, color: overrides.xAxis.splitLine.lineStyle.color } },
      };
    };
    const optTitle = (option.title || {}) as Record<string, unknown>;
    const optLegend = (option.legend || {}) as Record<string, unknown>;
    return {
      ...option,
      color: overrides.color,
      backgroundColor: overrides.backgroundColor,
      textStyle: { ...((option.textStyle || {}) as Record<string, unknown>), ...overrides.textStyle },
      title: { ...optTitle, textStyle: { ...((optTitle.textStyle || {}) as Record<string, unknown>), ...overrides.title.textStyle } },
      legend: { ...optLegend, textStyle: { ...((optLegend.textStyle || {}) as Record<string, unknown>), ...overrides.legend.textStyle } },
      xAxis: Array.isArray(option.xAxis)
        ? option.xAxis.map((x: Record<string, unknown>) => mergeAxis(x))
        : option.xAxis ? mergeAxis(option.xAxis as Record<string, unknown>) : undefined,
      yAxis: Array.isArray(option.yAxis)
        ? option.yAxis.map((y: Record<string, unknown>) => mergeAxis(y))
        : option.yAxis ? mergeAxis(option.yAxis as Record<string, unknown>) : undefined
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
