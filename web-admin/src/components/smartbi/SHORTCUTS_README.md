# SmartBI Keyboard Shortcuts System

## Overview

A complete keyboard shortcuts system for SmartBI power users, featuring:
- 12 customizable shortcuts covering all major actions
- Visual help overlay with keyboard-style key badges
- Auto-disable when typing in input fields
- Clean event listener management
- Zero external dependencies (no @vueuse)

---

## Files Created

### 1. `src/composables/useSmartBIShortcuts.ts`
**Purpose**: Vue 3 composable that handles keyboard event listening and shortcut routing

**Exports**:
- `useSmartBIShortcuts(config)` - Main composable function
- `ShortcutConfig` - TypeScript interface for configuration
- `ShortcutDefinition` - TypeScript interface for shortcut metadata

**Returns**:
- `showHelp` - Ref<boolean> for toggling help overlay
- `shortcuts` - Array of shortcut definitions for rendering

**Features**:
- Detects Alt+Key combinations and special keys (?, F11)
- Ignores shortcuts when user is typing in input/textarea/select
- Respects `enabled` ref to disable shortcuts when dialogs are open
- Proper cleanup on component unmount
- Prevents default browser behavior for handled shortcuts

### 2. `src/components/smartbi/ShortcutsHelpOverlay.vue`
**Purpose**: Visual overlay component that displays all available shortcuts

**Props**:
- `visible: boolean` - Controls overlay visibility
- `shortcuts: ShortcutDefinition[]` - List of shortcuts to display

**Emits**:
- `close` - Emitted when user closes the overlay

**Features**:
- Semi-transparent dark overlay with backdrop blur
- Keyboard-style key badges with shadows and borders
- 2-column responsive grid layout
- Smooth fade transition
- Closes on Escape key or click outside
- Purple gradient header matching SmartBI theme
- Custom scrollbar styling
- Mobile-responsive (single column on small screens)

### 3. `SHORTCUTS_INTEGRATION_EXAMPLE.md`
Step-by-step integration guide for SmartBIAnalysis.vue (handled by another agent)

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt+←` | 上一个表 | Navigate to previous sheet tab |
| `Alt+→` | 下一个表 | Navigate to next sheet tab |
| `Alt+R` | 刷新分析 | Reload current analysis |
| `Alt+E` | 导出Excel | Export current view to Excel |
| `Alt+P` | 导出PDF | Export current view to PDF |
| `Alt+S` | 分享链接 | Generate share link |
| `Alt+U` | 上传文件 | Open file upload dialog |
| `Alt+L` | 切换编排模式 | Toggle between layout and standard mode |
| `Alt+H` | 快捷键帮助 | Show/hide shortcuts help overlay |
| `?` | 快捷键帮助 | Show/hide shortcuts help overlay |
| `Alt+F` | 全屏模式 | Toggle fullscreen |
| `F11` | 全屏模式 | Toggle fullscreen |
| `Esc` | 关闭帮助 | Close shortcuts help overlay |

---

## Usage Example

```typescript
import { useSmartBIShortcuts } from '@/composables/useSmartBIShortcuts';
import ShortcutsHelpOverlay from '@/components/smartbi/ShortcutsHelpOverlay.vue';

// In <script setup>
const { showHelp, shortcuts } = useSmartBIShortcuts({
  onPrevSheet: () => { /* navigate to previous sheet */ },
  onNextSheet: () => { /* navigate to next sheet */ },
  onRefresh: () => { /* reload analysis */ },
  onExport: () => { /* export Excel */ },
  onExportPDF: () => { /* export PDF */ },
  onShare: () => { /* open share dialog */ },
  onUpload: () => { /* open upload dialog */ },
  onToggleLayout: () => { /* toggle layout mode */ },
  onFullscreen: () => { /* toggle fullscreen */ },
  enabled: shortcutsEnabled, // optional
});

// In <template>
<ShortcutsHelpOverlay
  :visible="showHelp"
  :shortcuts="shortcuts"
  @close="showHelp = false"
/>
```

---

## Design Decisions

1. **No @vueuse dependency**: Uses standard `window.addEventListener` for maximum compatibility
2. **Alt key prefix**: Avoids conflicts with browser/system shortcuts (Ctrl+S, Cmd+R, etc.)
3. **Input field detection**: Automatically disables shortcuts when user is typing
4. **Optional enabled control**: Allows parent component to disable shortcuts when dialogs are open
5. **Proper cleanup**: Removes event listeners on unmount to prevent memory leaks
6. **Keyboard-style UI**: Uses `<kbd>` tags and custom CSS to mimic physical keyboard keys
7. **Responsive design**: 2-column grid on desktop, single column on mobile
8. **Accessibility**: Escape key to close, click outside to dismiss, clear visual feedback

---

## TypeScript Types

```typescript
interface ShortcutConfig {
  onPrevSheet?: () => void;
  onNextSheet?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onExportPDF?: () => void;
  onShare?: () => void;
  onUpload?: () => void;
  onToggleLayout?: () => void;
  onHelp?: () => void;
  onFullscreen?: () => void;
  enabled?: Ref<boolean>;
}

interface ShortcutDefinition {
  key: string;           // e.g., "Alt+R"
  label: string;         // e.g., "刷新分析"
  action: keyof ShortcutConfig;
  description?: string;  // e.g., "重新加载当前分析"
}
```

---

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (Alt = Option key on macOS)
- **IE11**: ❌ Not supported (uses Vue 3)

---

## Future Enhancements

Potential improvements for future versions:
- User-customizable key bindings (stored in localStorage)
- Shortcut recording interface
- Global search/command palette (Cmd+K style)
- Shortcuts for specific chart types
- Keyboard navigation within charts
- Shortcut conflict detection
