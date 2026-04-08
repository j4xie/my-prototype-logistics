/**
 * Canvas 配置状态管理
 * 缓存 EffectiveModuleConfig 避免重复请求
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EffectiveModuleConfig, ModuleSummary } from '@/types/config'
import { getEffectiveConfig, getModules } from '@/api/configApi'

export const useConfigStore = defineStore('config', () => {
  // 缓存: key = "factoryId:moduleCode"
  const cache = ref<Map<string, EffectiveModuleConfig>>(new Map())
  const modulesCache = ref<Map<string, ModuleSummary[]>>(new Map())
  const loading = ref(false)

  /**
   * 获取有效配置 (带缓存)
   */
  async function loadEffectiveConfig(
    factoryId: string,
    moduleCode: string,
    forceRefresh = false,
  ): Promise<EffectiveModuleConfig | null> {
    const key = `${factoryId}:${moduleCode}`

    if (!forceRefresh && cache.value.has(key)) {
      return cache.value.get(key)!
    }

    loading.value = true
    try {
      const res = await getEffectiveConfig(factoryId, moduleCode)
      if (res.success && res.data) {
        cache.value.set(key, res.data)
        return res.data
      }
      return null
    } catch (e) {
      console.error(`加载配置失败: ${moduleCode}`, e)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取所有模块摘要 (带缓存)
   */
  async function loadModules(
    factoryId: string,
    forceRefresh = false,
  ): Promise<ModuleSummary[]> {
    if (!forceRefresh && modulesCache.value.has(factoryId)) {
      return modulesCache.value.get(factoryId)!
    }

    try {
      const res = await getModules(factoryId)
      if (res.success && res.data) {
        modulesCache.value.set(factoryId, res.data)
        return res.data
      }
      return []
    } catch (e) {
      console.error('加载模块列表失败', e)
      return []
    }
  }

  /**
   * 检查模块是否启用动态渲染
   */
  function isDynamicRenderingEnabled(factoryId: string, moduleCode: string): boolean {
    const key = `${factoryId}:${moduleCode}`
    const config = cache.value.get(key)
    if (!config) return false
    return config.renderingMode === 'DYNAMIC' || config.renderingMode === 'DUAL'
  }

  /**
   * 清除指定模块缓存 (配置更新后调用)
   */
  function invalidateCache(factoryId: string, moduleCode?: string) {
    if (moduleCode) {
      cache.value.delete(`${factoryId}:${moduleCode}`)
    } else {
      // 清除该工厂所有缓存
      for (const key of cache.value.keys()) {
        if (key.startsWith(`${factoryId}:`)) {
          cache.value.delete(key)
        }
      }
      modulesCache.value.delete(factoryId)
    }
  }

  /**
   * 清除全部缓存
   */
  function clearAll() {
    cache.value.clear()
    modulesCache.value.clear()
  }

  return {
    cache,
    loading,
    loadEffectiveConfig,
    loadModules,
    isDynamicRenderingEnabled,
    invalidateCache,
    clearAll,
  }
})
