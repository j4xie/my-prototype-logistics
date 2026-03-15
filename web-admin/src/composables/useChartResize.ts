import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import echarts from '@/utils/echarts'

/**
 * Observes a container element for size changes via ResizeObserver and
 * automatically resizes all ECharts instances found within it.
 *
 * Falls back to window resize for browsers without ResizeObserver.
 *
 * If a custom `onResize` callback is provided, it is called instead of
 * the default DOM-scanning behaviour — useful when chart instances are
 * already tracked in a Map or ref.
 *
 * Usage:
 *   const containerRef = ref<HTMLElement>()
 *   useChartResize(containerRef)                     // auto-scan DOM
 *   useChartResize(containerRef, myResizeFunction)   // custom callback
 */
export function useChartResize(
  containerRef: Ref<HTMLElement | null | undefined>,
  onResize?: () => void,
) {
  let ro: ResizeObserver | null = null
  let rafId = 0

  function resizeAllCharts() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0

      if (onResize) {
        onResize()
        return
      }

      // Default: scan container for all ECharts instances by [id^="chart-"]
      // and any element that echarts.getInstanceByDom recognises.
      const root = containerRef.value
      if (!root) return

      const candidates = root.querySelectorAll<HTMLElement>(
        '[_echarts_instance_], [id^="chart-"]',
      )
      candidates.forEach((el) => {
        const instance = echarts.getInstanceByDom(el)
        if (instance && !instance.isDisposed?.()) {
          instance.resize()
        }
      })
    })
  }

  onMounted(() => {
    if (containerRef.value && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resizeAllCharts)
      ro.observe(containerRef.value)
    }
    // Keep window resize as fallback
    window.addEventListener('resize', resizeAllCharts)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
    window.removeEventListener('resize', resizeAllCharts)
    if (rafId) cancelAnimationFrame(rafId)

    // Dispose all ECharts instances within the container to prevent memory leaks
    const root = containerRef.value
    if (root) {
      const candidates = root.querySelectorAll<HTMLElement>(
        '[_echarts_instance_], [id^="chart-"]',
      )
      candidates.forEach((el) => {
        const instance = echarts.getInstanceByDom(el)
        if (instance && !instance.isDisposed?.()) {
          instance.dispose()
        }
      })
    }
  })

  return { resizeAllCharts }
}
