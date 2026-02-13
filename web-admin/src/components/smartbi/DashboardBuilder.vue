<script setup lang="ts">
/**
 * SmartBI DashboardBuilder - Drag-and-Drop Dashboard Layout Builder
 * Features: 12-column CSS grid, drag-and-drop repositioning, resize handles,
 * chart sidebar, save/reset/preview toolbar, card configuration
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  Setting,
  Delete,
  View,
  Edit,
  Refresh,
  DocumentCopy,
  Plus,
  Rank,
  Grid
} from '@element-plus/icons-vue';

// Types
export interface DashboardLayout {
  id: string;
  name: string;
  cards: DashboardCard[];
}

export interface DashboardCard {
  id: string;
  chartType: string;
  title: string;
  x: number;  // column position (0-11)
  y: number;  // row position
  w: number;  // width in columns (1-12)
  h: number;  // height in rows (1-6)
  config?: Record<string, any>;
}

export interface ChartDefinition {
  type: string;
  name: string;
  icon?: string;
  description?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface Props {
  layout: DashboardLayout;
  availableCharts: ChartDefinition[];
  editable?: boolean;
  columns?: number;
  rowHeight?: number;
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  columns: 12,
  rowHeight: 100
});

const emit = defineEmits<{
  (e: 'layout-change', layout: DashboardLayout): void;
  (e: 'save', layout: DashboardLayout): void;
  (e: 'card-configure', card: DashboardCard): void;
  (e: 'mode-change', mode: 'standard' | 'layout'): void;
}>();

// State
const internalLayout = ref<DashboardLayout>({ ...props.layout, cards: [...props.layout.cards] });
const previewMode = ref(false);
const sidebarCollapsed = ref(false);
const draggingCard = ref<DashboardCard | null>(null);
const draggingFromSidebar = ref<ChartDefinition | null>(null);
const resizingCard = ref<DashboardCard | null>(null);
const resizeStartPos = ref({ x: 0, y: 0, w: 0, h: 0 });
const dropTarget = ref<{ x: number; y: number } | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const showGridOverlay = ref(true);
const showAlignmentGuides = ref(false);
const alignmentGuides = ref<{ type: 'h' | 'v'; position: number }[]>([]);

// Computed
const isEditable = computed(() => props.editable && !previewMode.value);

// Base unit for vertical snapping (pixels)
const ROW_SNAP_UNIT = 60;

const gridRows = computed(() => {
  if (internalLayout.value.cards.length === 0) return 4;
  const maxY = Math.max(...internalLayout.value.cards.map(c => c.y + c.h));
  return Math.max(maxY + 1, 4);
});

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
  gridTemplateRows: `repeat(${gridRows.value}, ${props.rowHeight}px)`,
  gap: '12px',
  padding: '12px',
  minHeight: `${gridRows.value * props.rowHeight + (gridRows.value - 1) * 12 + 24}px`
}));

// Chart type info map
const chartTypeMap = computed(() => {
  const map = new Map<string, ChartDefinition>();
  props.availableCharts.forEach(chart => {
    map.set(chart.type, chart);
  });
  return map;
});

// Get chart type display name
function getChartTypeName(type: string): string {
  return chartTypeMap.value.get(type)?.name || type;
}

// Generate unique card ID
function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get card style for grid positioning
function getCardStyle(card: DashboardCard) {
  return {
    gridColumn: `${card.x + 1} / span ${card.w}`,
    gridRow: `${card.y + 1} / span ${card.h}`,
    minHeight: `${card.h * props.rowHeight + (card.h - 1) * 12}px`
  };
}

// Check if position is valid (no overlap)
function isPositionValid(x: number, y: number, w: number, h: number, excludeId?: string): boolean {
  // Check bounds
  if (x < 0 || y < 0 || x + w > props.columns) return false;

  // Check overlap with existing cards
  for (const card of internalLayout.value.cards) {
    if (card.id === excludeId) continue;

    const overlapX = x < card.x + card.w && x + w > card.x;
    const overlapY = y < card.y + card.h && y + h > card.y;

    if (overlapX && overlapY) return false;
  }

  return true;
}

// Find next available position
function findAvailablePosition(w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x <= props.columns - w; x++) {
      if (isPositionValid(x, y, w, h)) {
        return { x, y };
      }
    }
  }
  return null;
}

// Get grid position from mouse event
function getGridPositionFromEvent(e: MouseEvent | DragEvent): { x: number; y: number } | null {
  if (!gridRef.value) return null;

  const rect = gridRef.value.getBoundingClientRect();
  const cellWidth = (rect.width - 12 * 2 - 12 * (props.columns - 1)) / props.columns;
  const cellHeight = props.rowHeight;

  const relX = e.clientX - rect.left - 12;
  const relY = e.clientY - rect.top - 12;

  const x = Math.floor(relX / (cellWidth + 12));
  const y = Math.floor(relY / (cellHeight + 12));

  return {
    x: Math.max(0, Math.min(props.columns - 1, x)),
    y: Math.max(0, y)
  };
}

// Drag handlers for sidebar items
function handleSidebarDragStart(e: DragEvent, chart: ChartDefinition) {
  if (!isEditable.value) return;

  draggingFromSidebar.value = chart;
  e.dataTransfer?.setData('text/plain', chart.type);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy';
  }
}

function handleSidebarDragEnd() {
  draggingFromSidebar.value = null;
  dropTarget.value = null;
}

// Drag handlers for existing cards
function handleCardDragStart(e: DragEvent, card: DashboardCard) {
  if (!isEditable.value) return;

  draggingCard.value = card;
  e.dataTransfer?.setData('text/plain', card.id);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }

  // Add visual feedback
  const target = e.target as HTMLElement;
  target.classList.add('dragging');
}

function handleCardDragEnd(e: DragEvent) {
  draggingCard.value = null;
  dropTarget.value = null;

  const target = e.target as HTMLElement;
  target.classList.remove('dragging');
}

// Grid drop handlers
function handleGridDragOver(e: DragEvent) {
  if (!isEditable.value) return;

  e.preventDefault();
  e.dataTransfer!.dropEffect = draggingFromSidebar.value ? 'copy' : 'move';

  const pos = getGridPositionFromEvent(e);
  if (pos) {
    dropTarget.value = pos;
  }
}

function handleGridDragLeave() {
  dropTarget.value = null;
}

function handleGridDrop(e: DragEvent) {
  if (!isEditable.value) return;

  e.preventDefault();
  const pos = getGridPositionFromEvent(e);

  if (!pos) {
    dropTarget.value = null;
    return;
  }

  if (draggingFromSidebar.value) {
    // Add new card from sidebar
    const chart = draggingFromSidebar.value;
    const w = chart.defaultWidth || 4;
    const h = chart.defaultHeight || 2;

    // Adjust position if it would go out of bounds
    const adjustedX = Math.min(pos.x, props.columns - w);

    if (isPositionValid(adjustedX, pos.y, w, h)) {
      const newCard: DashboardCard = {
        id: generateCardId(),
        chartType: chart.type,
        title: chart.name,
        x: adjustedX,
        y: pos.y,
        w,
        h
      };

      internalLayout.value.cards.push(newCard);
      emitLayoutChange();
    }
  } else if (draggingCard.value) {
    // Move existing card
    const card = draggingCard.value;
    const w = card.w;
    const h = card.h;

    // Adjust position if it would go out of bounds
    const adjustedX = Math.min(pos.x, props.columns - w);

    if (isPositionValid(adjustedX, pos.y, w, h, card.id)) {
      card.x = adjustedX;
      card.y = pos.y;
      emitLayoutChange();
    }
  }

  draggingFromSidebar.value = null;
  draggingCard.value = null;
  dropTarget.value = null;
}

// Resize handlers
function handleResizeStart(e: MouseEvent, card: DashboardCard, direction: string) {
  if (!isEditable.value) return;

  e.preventDefault();
  e.stopPropagation();

  resizingCard.value = card;
  resizeStartPos.value = {
    x: e.clientX,
    y: e.clientY,
    w: card.w,
    h: card.h
  };

  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
}

function handleResizeMove(e: MouseEvent) {
  if (!resizingCard.value || !gridRef.value) return;

  const rect = gridRef.value.getBoundingClientRect();
  const cellWidth = (rect.width - 12 * 2 - 12 * (props.columns - 1)) / props.columns;
  const cellHeight = props.rowHeight;

  const deltaX = e.clientX - resizeStartPos.value.x;
  const deltaY = e.clientY - resizeStartPos.value.y;

  const deltaW = Math.round(deltaX / (cellWidth + 12));
  const deltaH = Math.round(deltaY / (cellHeight + 12));

  const card = resizingCard.value;
  const chartDef = chartTypeMap.value.get(card.chartType);

  const minW = chartDef?.minWidth || 2;
  const minH = chartDef?.minHeight || 1;
  const maxW = Math.min(chartDef?.maxWidth || props.columns, props.columns - card.x);
  const maxH = chartDef?.maxHeight || 6;

  let newW = Math.max(minW, Math.min(maxW, resizeStartPos.value.w + deltaW));
  let newH = Math.max(minH, Math.min(maxH, resizeStartPos.value.h + deltaH));

  // Snap height to ROW_SNAP_UNIT multiples
  const pixelHeight = newH * props.rowHeight + (newH - 1) * 12;
  const snappedPixelHeight = Math.round(pixelHeight / ROW_SNAP_UNIT) * ROW_SNAP_UNIT;
  newH = Math.max(minH, Math.round(snappedPixelHeight / (props.rowHeight + 12)));

  // Show alignment guides
  showAlignmentGuides.value = true;
  updateAlignmentGuides(card, newW, newH);

  if (isPositionValid(card.x, card.y, newW, newH, card.id)) {
    card.w = newW;
    card.h = newH;
  }
}

// Update alignment guides based on card position/size
function updateAlignmentGuides(card: DashboardCard, w: number, h: number) {
  const guides: { type: 'h' | 'v'; position: number }[] = [];

  // Find other cards at same Y positions (horizontal alignment)
  internalLayout.value.cards.forEach(other => {
    if (other.id === card.id) return;

    // Top edge alignment
    if (Math.abs(card.y - other.y) < 0.5) {
      guides.push({ type: 'h', position: card.y });
    }

    // Bottom edge alignment
    if (Math.abs((card.y + h) - (other.y + other.h)) < 0.5) {
      guides.push({ type: 'h', position: card.y + h });
    }
  });

  alignmentGuides.value = guides;
}

function handleResizeEnd() {
  if (resizingCard.value) {
    emitLayoutChange();
  }

  resizingCard.value = null;
  showAlignmentGuides.value = false;
  alignmentGuides.value = [];
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
}

// Card actions
function deleteCard(card: DashboardCard) {
  const index = internalLayout.value.cards.findIndex(c => c.id === card.id);
  if (index !== -1) {
    internalLayout.value.cards.splice(index, 1);
    emitLayoutChange();
  }
}

function configureCard(card: DashboardCard) {
  emit('card-configure', card);
}

function duplicateCard(card: DashboardCard) {
  const pos = findAvailablePosition(card.w, card.h);
  if (pos) {
    const newCard: DashboardCard = {
      ...card,
      id: generateCardId(),
      x: pos.x,
      y: pos.y,
      title: `${card.title} (Copy)`
    };
    internalLayout.value.cards.push(newCard);
    emitLayoutChange();
  }
}

// Toolbar actions
function togglePreviewMode() {
  previewMode.value = !previewMode.value;

  // Emit mode change event
  emit('mode-change', previewMode.value ? 'standard' : 'layout');

  // If switching to standard mode, resize all ECharts instances after DOM update
  if (previewMode.value) {
    nextTick(() => {
      setTimeout(() => {
        resizeAllCharts();
      }, 100);
    });
  }
}

// Resize all ECharts instances
function resizeAllCharts() {
  if (typeof window === 'undefined' || !(window as any).echarts) return;

  const echarts = (window as any).echarts;
  const containers = document.querySelectorAll('.card-content [_echarts_instance_]');

  containers.forEach((container) => {
    const instance = echarts.getInstanceByDom(container);
    if (instance) {
      instance.resize();
    }
  });
}

function resetLayout() {
  internalLayout.value = { ...props.layout, cards: [...props.layout.cards.map(c => ({ ...c }))] };
  emitLayoutChange();
}

function saveLayout() {
  emit('save', { ...internalLayout.value, cards: internalLayout.value.cards.map(c => ({ ...c })) });
}

// Emit layout change
function emitLayoutChange() {
  emit('layout-change', { ...internalLayout.value, cards: internalLayout.value.cards.map(c => ({ ...c })) });
}

// Add card from sidebar by click (when drag not supported)
function addChartToLayout(chart: ChartDefinition) {
  if (!isEditable.value) return;

  const w = chart.defaultWidth || 4;
  const h = chart.defaultHeight || 2;
  const pos = findAvailablePosition(w, h);

  if (pos) {
    const newCard: DashboardCard = {
      id: generateCardId(),
      chartType: chart.type,
      title: chart.name,
      x: pos.x,
      y: pos.y,
      w,
      h
    };

    internalLayout.value.cards.push(newCard);
    emitLayoutChange();
  }
}

// Template presets
interface LayoutPreset {
  name: string;
  description: string;
  apply: () => void;
}

const layoutPresets: LayoutPreset[] = [
  {
    name: '2x2 均等',
    description: '4个图表均等分布',
    apply: () => applyPreset2x2()
  },
  {
    name: '1大+3小',
    description: '1个大图表+3个小图表',
    apply: () => applyPresetLargeSmall()
  },
  {
    name: '仪表板',
    description: 'KPI卡片+图表',
    apply: () => applyPresetDashboard()
  },
  {
    name: '全宽堆叠',
    description: '所有图表全宽垂直堆叠',
    apply: () => applyPresetFullWidth()
  }
];

function applyPreset2x2() {
  const cards = internalLayout.value.cards.slice(0, 4);
  if (cards.length === 0) return;

  const positions = [
    { x: 0, y: 0, w: 6, h: 2 },
    { x: 6, y: 0, w: 6, h: 2 },
    { x: 0, y: 2, w: 6, h: 2 },
    { x: 6, y: 2, w: 6, h: 2 }
  ];

  cards.forEach((card, i) => {
    Object.assign(card, positions[i]);
  });

  emitLayoutChange();
}

function applyPresetLargeSmall() {
  const cards = internalLayout.value.cards.slice(0, 4);
  if (cards.length === 0) return;

  const positions = [
    { x: 0, y: 0, w: 8, h: 3 },
    { x: 8, y: 0, w: 4, h: 1 },
    { x: 8, y: 1, w: 4, h: 1 },
    { x: 8, y: 2, w: 4, h: 1 }
  ];

  cards.forEach((card, i) => {
    Object.assign(card, positions[i]);
  });

  emitLayoutChange();
}

function applyPresetDashboard() {
  const cards = internalLayout.value.cards.slice(0, 6);
  if (cards.length === 0) return;

  const positions = [
    { x: 0, y: 0, w: 3, h: 1 }, // KPI 1
    { x: 3, y: 0, w: 3, h: 1 }, // KPI 2
    { x: 6, y: 0, w: 3, h: 1 }, // KPI 3
    { x: 9, y: 0, w: 3, h: 1 }, // KPI 4
    { x: 0, y: 1, w: 6, h: 2 }, // Chart 1
    { x: 6, y: 1, w: 6, h: 2 }  // Chart 2
  ];

  cards.forEach((card, i) => {
    Object.assign(card, positions[i]);
  });

  emitLayoutChange();
}

function applyPresetFullWidth() {
  const cards = internalLayout.value.cards;
  if (cards.length === 0) return;

  cards.forEach((card, i) => {
    card.x = 0;
    card.y = i * 2;
    card.w = 12;
    card.h = 2;
  });

  emitLayoutChange();
}

function applyLayoutPreset(preset: LayoutPreset) {
  preset.apply();
}

// Watch for external layout changes
watch(() => props.layout, (newLayout) => {
  internalLayout.value = { ...newLayout, cards: [...newLayout.cards.map(c => ({ ...c }))] };
}, { deep: true });

// Watch for preview mode changes to handle ECharts resize
watch(() => previewMode.value, (isPreview) => {
  if (isPreview) {
    // Switching to standard mode - resize charts after DOM update
    nextTick(() => {
      setTimeout(() => {
        resizeAllCharts();
      }, 100);
    });
  }
});

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
});

// Expose for parent access
defineExpose({
  getLayout: () => ({ ...internalLayout.value, cards: internalLayout.value.cards.map(c => ({ ...c })) }),
  setPreviewMode: (mode: boolean) => { previewMode.value = mode; },
  reset: resetLayout
});
</script>

<template>
  <div class="dashboard-builder" :class="{ 'preview-mode': previewMode }">
    <!-- Sidebar: Available Charts -->
    <aside
      class="chart-sidebar"
      :class="{ collapsed: sidebarCollapsed }"
      v-if="isEditable"
    >
      <div class="sidebar-header">
        <span v-if="!sidebarCollapsed" class="sidebar-title">
          <el-icon><Grid /></el-icon>
          Available Charts
        </span>
        <el-button
          :icon="sidebarCollapsed ? Rank : Rank"
          size="small"
          text
          @click="sidebarCollapsed = !sidebarCollapsed"
          :title="sidebarCollapsed ? 'Expand' : 'Collapse'"
        />
      </div>

      <div v-if="!sidebarCollapsed" class="chart-list">
        <div
          v-for="chart in availableCharts"
          :key="chart.type"
          class="chart-item"
          draggable="true"
          @dragstart="handleSidebarDragStart($event, chart)"
          @dragend="handleSidebarDragEnd"
          @click="addChartToLayout(chart)"
          :title="chart.description || chart.name"
        >
          <div class="chart-item-icon">
            <el-icon v-if="chart.icon"><component :is="chart.icon" /></el-icon>
            <el-icon v-else><Rank /></el-icon>
          </div>
          <div class="chart-item-info">
            <span class="chart-item-name">{{ chart.name }}</span>
            <span v-if="chart.description" class="chart-item-desc">
              {{ chart.description }}
            </span>
          </div>
          <el-icon class="drag-handle"><Plus /></el-icon>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="builder-main">
      <!-- Toolbar -->
      <div class="builder-toolbar">
        <div class="toolbar-left">
          <span class="layout-name">{{ internalLayout.name }}</span>
          <el-tag size="small" type="info">
            {{ internalLayout.cards.length }} cards
          </el-tag>
        </div>

        <div class="toolbar-right">
          <el-dropdown
            v-if="editable && !previewMode && internalLayout.cards.length > 0"
            trigger="click"
            @command="applyLayoutPreset"
          >
            <el-button :icon="Grid" size="small">
              模板
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="preset in layoutPresets"
                  :key="preset.name"
                  :command="preset"
                >
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: 600;">{{ preset.name }}</span>
                    <span style="font-size: 11px; color: #909399;">{{ preset.description }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-button
            :type="previewMode ? 'primary' : 'default'"
            :icon="previewMode ? Edit : View"
            size="small"
            @click="togglePreviewMode"
          >
            {{ previewMode ? 'Edit Mode' : 'Preview' }}
          </el-button>

          <el-button
            v-if="editable && !previewMode"
            :icon="Refresh"
            size="small"
            @click="resetLayout"
          >
            Reset
          </el-button>

          <el-button
            v-if="editable && !previewMode"
            type="primary"
            size="small"
            @click="saveLayout"
          >
            Save Layout
          </el-button>
        </div>
      </div>

      <!-- Grid Area -->
      <div
        ref="gridRef"
        class="dashboard-grid"
        :class="{ 'show-grid-overlay': showGridOverlay && isEditable }"
        :style="gridStyle"
        @dragover="handleGridDragOver"
        @dragleave="handleGridDragLeave"
        @drop="handleGridDrop"
      >
        <!-- Grid overlay for visual snapping -->
        <div v-if="showGridOverlay && isEditable" class="grid-overlay">
          <div
            v-for="row in gridRows"
            :key="`row-${row}`"
            class="grid-line-h"
            :style="{ top: `${row * (props.rowHeight + 12)}px` }"
          />
        </div>

        <!-- Alignment guides -->
        <div
          v-for="(guide, idx) in alignmentGuides"
          :key="`guide-${idx}`"
          class="alignment-guide"
          :class="`guide-${guide.type}`"
          :style="
            guide.type === 'h'
              ? { top: `${guide.position * (props.rowHeight + 12) + 12}px` }
              : { left: `${guide.position * ((100 - 24 - 132) / 12 + 12)}px` }
          "
        />

        <!-- Drop indicator -->
        <div
          v-if="dropTarget && isEditable"
          class="drop-indicator"
          :style="{
            gridColumn: `${dropTarget.x + 1} / span ${draggingFromSidebar?.defaultWidth || draggingCard?.w || 4}`,
            gridRow: `${dropTarget.y + 1} / span ${draggingFromSidebar?.defaultHeight || draggingCard?.h || 2}`
          }"
        />

        <!-- Cards -->
        <div
          v-for="card in internalLayout.cards"
          :key="card.id"
          class="dashboard-card"
          :class="{ 'is-resizing': resizingCard?.id === card.id }"
          :style="getCardStyle(card)"
          :draggable="isEditable"
          @dragstart="handleCardDragStart($event, card)"
          @dragend="handleCardDragEnd"
        >
          <!-- Card Header -->
          <div class="card-header">
            <span class="card-title">{{ card.title }}</span>
            <span class="card-type">{{ getChartTypeName(card.chartType) }}</span>

            <div v-if="isEditable" class="card-actions">
              <el-button
                :icon="Setting"
                size="small"
                text
                @click.stop="configureCard(card)"
                title="Configure"
              />
              <el-button
                :icon="DocumentCopy"
                size="small"
                text
                @click.stop="duplicateCard(card)"
                title="Duplicate"
              />
              <el-button
                :icon="Delete"
                size="small"
                text
                type="danger"
                @click.stop="deleteCard(card)"
                title="Delete"
              />
            </div>
          </div>

          <!-- Card Content: slot or placeholder -->
          <div class="card-content">
            <slot name="card-content" :card="card" :index="internalLayout.cards.indexOf(card)">
              <div class="chart-placeholder">
                <el-icon :size="48"><Rank /></el-icon>
                <span>{{ getChartTypeName(card.chartType) }}</span>
                <span class="size-info">{{ card.w }} x {{ card.h }}</span>
              </div>
            </slot>
          </div>

          <!-- Resize Handle -->
          <div
            v-if="isEditable"
            class="resize-handle resize-se"
            :class="{ 'is-active': resizingCard?.id === card.id }"
            @mousedown.prevent.stop="handleResizeStart($event, card, 'se')"
            title="拖动调整大小"
          />
        </div>

        <!-- Empty State -->
        <div v-if="internalLayout.cards.length === 0" class="empty-state">
          <el-icon :size="64"><Grid /></el-icon>
          <p>Drag charts from the sidebar to build your dashboard</p>
          <p class="hint">Or click on a chart to add it automatically</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-builder {
  display: flex;
  height: 100%;
  min-height: 600px;
  background: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;

  &.preview-mode {
    .chart-sidebar {
      display: none;
    }
  }
}

// Sidebar
.chart-sidebar {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;

  &.collapsed {
    width: 48px;

    .sidebar-header {
      justify-content: center;
      padding: 12px 8px;
    }
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;

  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #303133;

    .el-icon {
      color: #409eff;
    }
  }
}

.chart-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chart-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: grab;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    background: #ecf5ff;
    border-color: #409eff;

    .drag-handle {
      opacity: 1;
    }
  }

  &:active {
    cursor: grabbing;
  }
}

.chart-item-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #ebeef5;

  .el-icon {
    font-size: 18px;
    color: #409eff;
  }
}

.chart-item-info {
  flex: 1;
  min-width: 0;

  .chart-item-name {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chart-item-desc {
    display: block;
    font-size: 11px;
    color: #909399;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }
}

.drag-handle {
  opacity: 0;
  color: #409eff;
  transition: opacity 0.2s ease;
}

// Main Content
.builder-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.builder-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .layout-name {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

// Grid
.dashboard-grid {
  flex: 1;
  position: relative;
  overflow: auto;
  background: #f5f7fa;

  &.show-grid-overlay {
    background:
      linear-gradient(90deg, #ebeef5 1px, transparent 1px),
      linear-gradient(#ebeef5 1px, transparent 1px);
    background-size: calc((100% - 24px - 132px) / 12 + 12px) calc(100px + 12px);
    background-position: 12px 12px;
  }
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;

  .grid-line-h {
    position: absolute;
    left: 12px;
    right: 12px;
    height: 1px;
    background: rgba(64, 158, 255, 0.15);
  }
}

.alignment-guide {
  position: absolute;
  background: #409eff;
  pointer-events: none;
  z-index: 10;

  &.guide-h {
    left: 12px;
    right: 12px;
    height: 2px;
  }

  &.guide-v {
    top: 12px;
    bottom: 12px;
    width: 2px;
  }
}

.drop-indicator {
  background: rgba(64, 158, 255, 0.15);
  border: 2px dashed #409eff;
  border-radius: 8px;
  pointer-events: none;
  z-index: 5;
}

.dashboard-card {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.1s ease;
  overflow: hidden;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

    .card-actions {
      opacity: 1;
    }

    .resize-handle {
      opacity: 1;
    }
  }

  &.dragging {
    opacity: 0.5;
    transform: scale(1.02);
  }

  &.is-resizing {
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
    border: 2px solid #409eff;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  cursor: grab;

  .card-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-type {
    font-size: 11px;
    color: #909399;
    background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 3px;
  }
}

.card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;

  .el-button {
    padding: 4px;
  }
}

.card-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 80px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  gap: 8px;

  .el-icon {
    opacity: 0.5;
  }

  span {
    font-size: 13px;
  }

  .size-info {
    font-size: 11px;
    color: #909399;
    background: #f5f7fa;
    padding: 2px 8px;
    border-radius: 3px;
  }
}

.resize-handle {
  position: absolute;
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;

  &.resize-se {
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    cursor: se-resize;
    border-radius: 0 0 8px 0;

    &::before {
      content: '';
      position: absolute;
      bottom: 6px;
      right: 6px;
      width: 12px;
      height: 12px;
      border-right: 3px solid #c0c4cc;
      border-bottom: 3px solid #c0c4cc;
      transition: border-color 0.2s ease;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: 0;
      width: 24px;
      height: 24px;
      background: transparent;
      transition: background-color 0.2s ease;
      border-radius: 0 0 8px 0;
    }
  }

  &:hover {
    &::before {
      border-color: #409eff;
    }

    &::after {
      background: rgba(64, 158, 255, 0.1);
    }
  }

  &.is-active {
    opacity: 1 !important;

    &::before {
      border-color: #409eff;
    }

    &::after {
      background: rgba(64, 158, 255, 0.2);
    }
  }
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #c0c4cc;
  text-align: center;

  .el-icon {
    opacity: 0.4;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #909399;

    &.hint {
      font-size: 12px;
      color: #c0c4cc;
    }
  }
}

// Responsive
@media (max-width: 768px) {
  .dashboard-builder {
    flex-direction: column;
  }

  .chart-sidebar {
    width: 100%;
    height: auto;
    max-height: 200px;
    border-right: none;
    border-bottom: 1px solid #ebeef5;

    &.collapsed {
      width: 100%;
      max-height: 48px;
    }
  }

  .chart-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chart-item {
    flex: 0 0 calc(50% - 4px);
    margin-bottom: 0;
  }

  .builder-toolbar {
    flex-wrap: wrap;
    gap: 8px;

    .toolbar-left,
    .toolbar-right {
      flex: 0 0 100%;
      justify-content: center;
    }
  }
}
</style>
