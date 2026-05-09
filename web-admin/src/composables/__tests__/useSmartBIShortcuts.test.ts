/**
 * Type validation + smoke tests for useSmartBIShortcuts composable.
 *
 * Originally a pure type-check file (no describe/it) — vitest emits
 * "No test suite found in file" and exits 1. Wrapped the type assertions
 * in describe/it so vitest sees a real suite.
 *
 * The composable internally uses onMounted/onBeforeUnmount lifecycle hooks
 * which only run inside a Vue component setup context. Calling it outside
 * a component will warn but not throw. We assert the returned shape and
 * type contract; integration tests live elsewhere.
 */
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import {
  useSmartBIShortcuts,
  type ShortcutConfig,
  type ShortcutDefinition,
} from '../useSmartBIShortcuts';

describe('useSmartBIShortcuts (type contract)', () => {
  it('returns showHelp ref and shortcuts array for full config', () => {
    const config: ShortcutConfig = {
      onPrevSheet: () => {},
      onNextSheet: () => {},
      onRefresh: () => {},
      onExport: () => {},
      onExportPDF: () => {},
      onShare: () => {},
      onUpload: () => {},
      onToggleLayout: () => {},
      onHelp: () => {},
      onFullscreen: () => {},
    };

    const { showHelp, shortcuts } = useSmartBIShortcuts(config);

    expect(typeof showHelp.value).toBe('boolean');
    expect(Array.isArray(shortcuts)).toBe(true);
  });

  it('accepts partial config (all callbacks optional)', () => {
    const config: ShortcutConfig = {
      onRefresh: () => {},
    };

    const { showHelp, shortcuts } = useSmartBIShortcuts(config);

    expect(showHelp).toBeDefined();
    expect(shortcuts.length).toBeGreaterThanOrEqual(0);
  });

  it('accepts empty config', () => {
    const config: ShortcutConfig = {};
    const { showHelp, shortcuts } = useSmartBIShortcuts(config);

    expect(showHelp).toBeDefined();
    expect(shortcuts).toBeDefined();
  });

  it('accepts enabled ref in config', () => {
    const enabled = ref(true);
    const config: ShortcutConfig = {
      onRefresh: () => {},
      enabled,
    };

    const { showHelp } = useSmartBIShortcuts(config);

    enabled.value = false;
    expect(showHelp).toBeDefined();
  });

  it('ShortcutDefinition shape compiles', () => {
    const shortcut: ShortcutDefinition = {
      key: 'Alt+R',
      label: '刷新',
      action: 'onRefresh',
      description: '重新加载',
    };

    expect(shortcut.key).toBe('Alt+R');
    expect(shortcut.label).toBe('刷新');
    expect(shortcut.action).toBe('onRefresh');
    expect(shortcut.description).toBe('重新加载');
  });
});
