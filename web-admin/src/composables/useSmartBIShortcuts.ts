import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export interface ShortcutConfig {
  onPrevSheet?: () => void;    // Alt+← or Alt+ArrowLeft
  onNextSheet?: () => void;    // Alt+→ or Alt+ArrowRight
  onRefresh?: () => void;      // Alt+R
  onExport?: () => void;       // Alt+E (export current view)
  onExportPDF?: () => void;    // Alt+P (export PDF)
  onShare?: () => void;        // Alt+S
  onUpload?: () => void;       // Alt+U
  onToggleLayout?: () => void; // Alt+L (toggle layout/standard mode)
  onHelp?: () => void;         // Alt+H or ? (show shortcuts help)
  onFullscreen?: () => void;   // Alt+F or F11
  enabled?: Ref<boolean>;      // disable when dialog/drawer open
}

export interface ShortcutDefinition {
  key: string;
  label: string;
  action: keyof ShortcutConfig;
  description?: string;
}

const SHORTCUTS: ShortcutDefinition[] = [
  { key: 'Alt+←', label: '上一个表', action: 'onPrevSheet', description: '切换到上一个Sheet标签页' },
  { key: 'Alt+→', label: '下一个表', action: 'onNextSheet', description: '切换到下一个Sheet标签页' },
  { key: 'Alt+R', label: '刷新分析', action: 'onRefresh', description: '重新加载当前分析' },
  { key: 'Alt+E', label: '导出Excel', action: 'onExport', description: '导出当前视图为Excel文件' },
  { key: 'Alt+P', label: '导出PDF', action: 'onExportPDF', description: '导出当前视图为PDF文件' },
  { key: 'Alt+S', label: '分享链接', action: 'onShare', description: '生成分享链接' },
  { key: 'Alt+U', label: '上传文件', action: 'onUpload', description: '打开文件上传对话框' },
  { key: 'Alt+L', label: '切换编排模式', action: 'onToggleLayout', description: '在标准模式和编排模式之间切换' },
  { key: 'Alt+H', label: '快捷键帮助', action: 'onHelp', description: '显示此帮助界面' },
  { key: '?', label: '快捷键帮助', action: 'onHelp', description: '显示此帮助界面' },
  { key: 'Alt+F', label: '全屏模式', action: 'onFullscreen', description: '切换全屏显示' },
  { key: 'F11', label: '全屏模式', action: 'onFullscreen', description: '切换全屏显示' },
];

export function useSmartBIShortcuts(config: ShortcutConfig) {
  const showHelp = ref(false);
  const shortcuts = SHORTCUTS;

  // Check if user is typing in an input field
  const isInputActive = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return ['input', 'textarea', 'select'].includes(tagName) ||
           target.isContentEditable;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Check if shortcuts are disabled
    if (config.enabled && !config.enabled.value) return;

    // Ignore if user is typing
    if (isInputActive(event.target)) return;

    const key = event.key;
    const isAlt = event.altKey;
    const isCtrl = event.ctrlKey;
    const isShift = event.shiftKey;
    const isMeta = event.metaKey;

    // Only handle Alt+ combinations or specific keys
    if (!isAlt && key !== '?' && key !== 'F11') return;

    // Prevent handling if Ctrl/Shift/Meta are also pressed (except for specific combos)
    if ((isCtrl || isShift || isMeta) && key !== 'F11') return;

    let handled = false;

    // Alt+Arrow keys (navigation)
    if (isAlt && (key === 'ArrowLeft' || key === 'Left')) {
      config.onPrevSheet?.();
      handled = true;
    } else if (isAlt && (key === 'ArrowRight' || key === 'Right')) {
      config.onNextSheet?.();
      handled = true;
    }
    // Alt+Letter shortcuts
    else if (isAlt) {
      const keyLower = key.toLowerCase();
      switch (keyLower) {
        case 'r':
          config.onRefresh?.();
          handled = true;
          break;
        case 'e':
          config.onExport?.();
          handled = true;
          break;
        case 'p':
          config.onExportPDF?.();
          handled = true;
          break;
        case 's':
          config.onShare?.();
          handled = true;
          break;
        case 'u':
          config.onUpload?.();
          handled = true;
          break;
        case 'l':
          config.onToggleLayout?.();
          handled = true;
          break;
        case 'h':
          showHelp.value = !showHelp.value;
          handled = true;
          break;
        case 'f':
          config.onFullscreen?.();
          handled = true;
          break;
      }
    }
    // Special keys
    else if (key === '?') {
      showHelp.value = !showHelp.value;
      handled = true;
    } else if (key === 'F11') {
      config.onFullscreen?.();
      handled = true;
    }
    // Escape to close help
    else if (key === 'Escape' && showHelp.value) {
      showHelp.value = false;
      handled = true;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    showHelp,
    shortcuts,
  };
}
