# SmartBI Keyboard Shortcuts Integration Example

This file demonstrates how to integrate the keyboard shortcuts system into SmartBIAnalysis.vue.

## Step 1: Import the composable and component

```typescript
import { useSmartBIShortcuts } from '@/composables/useSmartBIShortcuts';
import ShortcutsHelpOverlay from '@/components/smartbi/ShortcutsHelpOverlay.vue';
```

## Step 2: Set up the composable in `<script setup>`

```typescript
// Ref to track if dialogs/drawers are open (optional)
const shortcutsEnabled = ref(true);

// Set up keyboard shortcuts
const { showHelp, shortcuts } = useSmartBIShortcuts({
  onPrevSheet: () => {
    // Navigate to previous sheet tab
    if (activeSheetIndex.value > 0) {
      activeSheetIndex.value--;
    }
  },
  onNextSheet: () => {
    // Navigate to next sheet tab
    if (activeSheetIndex.value < sheets.length - 1) {
      activeSheetIndex.value++;
    }
  },
  onRefresh: () => {
    // Reload current analysis
    loadSheetData(activeSheetIndex.value);
  },
  onExport: () => {
    // Export to Excel
    handleExportExcel();
  },
  onExportPDF: () => {
    // Export to PDF
    handleExportPDF();
  },
  onShare: () => {
    // Open share dialog
    shareDialogVisible.value = true;
  },
  onUpload: () => {
    // Open upload dialog
    uploadDialogVisible.value = true;
  },
  onToggleLayout: () => {
    // Toggle between layout edit mode and standard mode
    layoutEditMode.value = !layoutEditMode.value;
  },
  onHelp: () => {
    // The composable handles toggling showHelp automatically
  },
  onFullscreen: () => {
    // Toggle fullscreen
    toggleFullscreen();
  },
  enabled: shortcutsEnabled, // Optional: disable shortcuts when dialogs are open
});

// Optional: Disable shortcuts when dialogs are open
watch([drillDownVisible, crossSheetDialogVisible], ([drill, cross]) => {
  shortcutsEnabled.value = !drill && !cross;
});
```

## Step 3: Add the overlay component to template

```vue
<template>
  <div class="smartbi-analysis">
    <!-- Your existing SmartBI content -->

    <!-- ... -->

    <!-- Shortcuts help overlay -->
    <ShortcutsHelpOverlay
      :visible="showHelp"
      :shortcuts="shortcuts"
      @close="showHelp = false"
    />
  </div>
</template>
```

## Step 4: (Optional) Add a help button to trigger the overlay

```vue
<el-button
  @click="showHelp = true"
  icon="el-icon-question"
  circle
  title="键盘快捷键 (Alt+H 或 ?)"
/>
```

## Available Shortcuts

All shortcuts are automatically handled by the composable:

- **Alt+←** / **Alt+→** - Navigate between sheet tabs
- **Alt+R** - Refresh current analysis
- **Alt+E** - Export to Excel
- **Alt+P** - Export to PDF
- **Alt+S** - Open share dialog
- **Alt+U** - Open upload dialog
- **Alt+L** - Toggle layout/standard mode
- **Alt+H** / **?** - Show/hide shortcuts help
- **Alt+F** / **F11** - Toggle fullscreen
- **Esc** - Close shortcuts help overlay

## Notes

- Shortcuts are automatically disabled when user is typing in input fields
- The composable properly cleans up event listeners on unmount
- The `enabled` ref allows you to disable shortcuts when dialogs are open
- No external dependencies (@vueuse) required - uses standard DOM APIs
