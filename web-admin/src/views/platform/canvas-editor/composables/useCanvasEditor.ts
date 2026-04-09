// useCanvasEditor.ts — shared editor state across all canvas components
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { getConfigVersion } from '@/api/canvasApi'
import type { ConfigStatus, ConfigVersion } from '@/types/canvas'

// Singleton state (shared across components)
const selectedModule = ref('')
const activeTab = ref('workflow') // default: flow design first
const configVersion = ref<ConfigVersion | null>(null)
const dirtyCount = ref(0)
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const isOnboarding = ref(false)

// Restore collapse state from localStorage
const savedState = localStorage.getItem('canvas-editor-state')
if (savedState) {
  try {
    const s = JSON.parse(savedState)
    leftCollapsed.value = s.leftCollapsed ?? false
    rightCollapsed.value = s.rightCollapsed ?? false
  } catch { /* ignore */ }
}

export function useCanvasEditor() {
  const authStore = useAuthStore()
  const factoryId = computed(() => authStore.factoryId || '')

  const status = computed<ConfigStatus>(() => configVersion.value?.status || 'DRAFT')
  const isReadOnly = computed(() => status.value !== 'DRAFT')
  const canSubmitReview = computed(() => status.value === 'DRAFT' && dirtyCount.value === 0)
  const canApprove = computed(() => status.value === 'PENDING_REVIEW')
  const canPublishNow = computed(() => status.value === 'APPROVED')
  const versionLabel = computed(() => {
    const v = configVersion.value
    if (!v) return ''
    const icons: Record<ConfigStatus, string> = {
      DRAFT: '📝', PENDING_REVIEW: '🔍', APPROVED: '⏰', PUBLISHED: '✅', REJECTED: '❌'
    }
    const labels: Record<ConfigStatus, string> = {
      DRAFT: '草稿', PENDING_REVIEW: '待审核', APPROVED: '已审核', PUBLISHED: '已发布', REJECTED: '已驳回'
    }
    return `${icons[v.status]} ${labels[v.status]} v${v.configVersion}`
  })

  async function loadVersion() {
    if (!factoryId.value) return
    try {
      const res = await getConfigVersion(factoryId.value)
      if (res.data) configVersion.value = res.data
    } catch { /* first time, no version yet */ }
  }

  function markDirty() { dirtyCount.value++ }
  function clearDirty() { dirtyCount.value = 0 }

  function toggleLeft() {
    leftCollapsed.value = !leftCollapsed.value
    persistState()
  }

  function toggleRight() {
    rightCollapsed.value = !rightCollapsed.value
    persistState()
  }

  function enterFocusMode() {
    leftCollapsed.value = true
    rightCollapsed.value = true
    persistState()
  }

  function exitFocusMode() {
    leftCollapsed.value = false
    rightCollapsed.value = false
    persistState()
  }

  function persistState() {
    localStorage.setItem('canvas-editor-state', JSON.stringify({
      leftCollapsed: leftCollapsed.value,
      rightCollapsed: rightCollapsed.value,
    }))
  }

  // Responsive defaults
  function applyResponsive() {
    const w = window.innerWidth
    if (w < 1024) {
      // Not supported — handled in template
    } else if (w < 1200) {
      leftCollapsed.value = true
      rightCollapsed.value = true
    } else if (w < 1440) {
      rightCollapsed.value = true
    }
  }

  return {
    factoryId, selectedModule, activeTab, configVersion, dirtyCount,
    leftCollapsed, rightCollapsed, isOnboarding,
    status, isReadOnly, canSubmitReview, canApprove, canPublishNow, versionLabel,
    loadVersion, markDirty, clearDirty,
    toggleLeft, toggleRight, enterFocusMode, exitFocusMode, applyResponsive,
  }
}
