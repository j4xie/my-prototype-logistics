/**
 * Type validation test for useSmartBIShortcuts composable
 * This file ensures TypeScript types are correct and exports work as expected
 */

import { ref } from 'vue';
import {
  useSmartBIShortcuts,
  type ShortcutConfig,
  type ShortcutDefinition,
} from '../useSmartBIShortcuts';

// Test 1: Basic usage with all callbacks
function test1() {
  const config: ShortcutConfig = {
    onPrevSheet: () => console.log('prev'),
    onNextSheet: () => console.log('next'),
    onRefresh: () => console.log('refresh'),
    onExport: () => console.log('export'),
    onExportPDF: () => console.log('pdf'),
    onShare: () => console.log('share'),
    onUpload: () => console.log('upload'),
    onToggleLayout: () => console.log('toggle'),
    onHelp: () => console.log('help'),
    onFullscreen: () => console.log('fullscreen'),
  };

  const { showHelp, shortcuts } = useSmartBIShortcuts(config);

  // Type checks
  const _help: boolean = showHelp.value;
  const _shortcuts: ShortcutDefinition[] = shortcuts;

  console.log(_help, _shortcuts);
}

// Test 2: Partial config (all callbacks are optional)
function test2() {
  const config: ShortcutConfig = {
    onRefresh: () => console.log('refresh only'),
  };

  const { showHelp, shortcuts } = useSmartBIShortcuts(config);
  console.log(showHelp.value, shortcuts.length);
}

// Test 3: With enabled ref
function test3() {
  const enabled = ref(true);

  const config: ShortcutConfig = {
    onRefresh: () => console.log('refresh'),
    enabled,
  };

  const { showHelp } = useSmartBIShortcuts(config);

  // Disable shortcuts
  enabled.value = false;

  console.log(showHelp.value);
}

// Test 4: Empty config (valid)
function test4() {
  const config: ShortcutConfig = {};
  const { showHelp, shortcuts } = useSmartBIShortcuts(config);
  console.log(showHelp.value, shortcuts);
}

// Test 5: ShortcutDefinition type
function test5() {
  const shortcut: ShortcutDefinition = {
    key: 'Alt+R',
    label: '刷新',
    action: 'onRefresh',
    description: '重新加载',
  };

  console.log(shortcut.key, shortcut.label);
}

// Export tests to prevent "unused" errors
export { test1, test2, test3, test4, test5 };

// This file is for type checking only, not for runtime execution
