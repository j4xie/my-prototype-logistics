<template>
  <Transition name="fade">
    <div v-if="visible" class="shortcuts-overlay" @click="handleOverlayClick">
      <div class="shortcuts-panel" @click.stop>
        <div class="shortcuts-header">
          <h3>键盘快捷键</h3>
          <button class="close-btn" @click="$emit('close')" title="关闭 (Esc)">
            <i class="el-icon-close"></i>
          </button>
        </div>

        <div class="shortcuts-content">
          <div class="shortcuts-grid">
            <div
              v-for="shortcut in shortcuts"
              :key="shortcut.key + shortcut.action"
              class="shortcut-item"
            >
              <div class="shortcut-keys">
                <kbd
                  v-for="(keyPart, index) in parseShortcutKey(shortcut.key)"
                  :key="index"
                  class="shortcut-key"
                >
                  {{ keyPart }}
                </kbd>
              </div>
              <div class="shortcut-info">
                <div class="shortcut-label">{{ shortcut.label }}</div>
                <div v-if="shortcut.description" class="shortcut-description">
                  {{ shortcut.description }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="shortcuts-footer">
          <p class="hint-text">
            <i class="el-icon-info"></i>
            按 <kbd class="shortcut-key">Esc</kbd> 或点击外部区域关闭此窗口
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { type ShortcutDefinition } from '@/composables/useSmartBIShortcuts';

interface Props {
  visible: boolean;
  shortcuts: ShortcutDefinition[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleOverlayClick = () => {
  emit('close');
};

// Parse shortcut key into individual parts (e.g., "Alt+R" -> ["Alt", "+", "R"])
const parseShortcutKey = (key: string): string[] => {
  // Special handling for arrow keys
  if (key.includes('←')) return key.split('+').flatMap((k, i) => i > 0 ? ['+', k] : [k]);
  if (key.includes('→')) return key.split('+').flatMap((k, i) => i > 0 ? ['+', k] : [k]);

  // Split by + and insert + between parts
  const parts = key.split('+');
  const result: string[] = [];
  parts.forEach((part, index) => {
    if (index > 0) result.push('+');
    result.push(part);
  });
  return result;
};
</script>

<style scoped>
.shortcuts-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.shortcuts-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.shortcuts-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.shortcuts-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.shortcut-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.shortcut-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.shortcut-key {
  display: inline-block;
  padding: 4px 10px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-bottom-width: 2px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 28px;
  text-align: center;
  color: #374151;
  line-height: 1.2;
}

.shortcut-info {
  flex: 1;
  min-width: 0;
}

.shortcut-label {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
  margin-bottom: 4px;
}

.shortcut-description {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.shortcuts-footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  background: #f9fafb;
}

.hint-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-text i {
  color: #667eea;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .shortcuts-panel {
    max-width: 100%;
    margin: 0 10px;
  }

  .shortcut-item {
    flex-direction: column;
    gap: 8px;
  }

  .shortcut-keys {
    justify-content: flex-start;
  }
}

/* Scrollbar styling */
.shortcuts-content::-webkit-scrollbar {
  width: 8px;
}

.shortcuts-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.shortcuts-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.shortcuts-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
