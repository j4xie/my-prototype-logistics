/**
 * 应用状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAppStore = defineStore('app', () => {
  // State
  const sidebarCollapsed = ref(false);
  const sidebarWidth = ref(220);
  const theme = ref<'light' | 'dark'>('light');
  const locale = ref('zh-CN');
  const pageLoading = ref(false);

  // 从 localStorage 恢复设置
  const storedCollapsed = localStorage.getItem('sidebar_collapsed');
  if (storedCollapsed) {
    sidebarCollapsed.value = storedCollapsed === 'true';
  }

  const storedTheme = localStorage.getItem('theme');
  if (storedTheme === 'dark' || storedTheme === 'light') {
    theme.value = storedTheme;
  }

  // Getters
  const currentSidebarWidth = computed(() =>
    sidebarCollapsed.value ? 64 : sidebarWidth.value
  );

  // Actions
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed.value));
  }

  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed;
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme;
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  function toggleTheme() {
    setTheme(theme.value === 'light' ? 'dark' : 'light');
  }

  function setLocale(newLocale: string) {
    locale.value = newLocale;
    localStorage.setItem('locale', newLocale);
  }

  function setPageLoading(loading: boolean) {
    pageLoading.value = loading;
  }

  return {
    // State
    sidebarCollapsed,
    sidebarWidth,
    theme,
    locale,
    pageLoading,

    // Getters
    currentSidebarWidth,

    // Actions
    toggleSidebar,
    setSidebarCollapsed,
    setTheme,
    toggleTheme,
    setLocale,
    setPageLoading
  };
});
