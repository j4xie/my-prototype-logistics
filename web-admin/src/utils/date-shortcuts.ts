/**
 * Shared date range shortcuts for el-date-picker components.
 * Used by FinanceAnalysis.vue, SalesAnalysis.vue, and other SmartBI pages.
 */

export const dateShortcuts = [
  {
    text: '最近7天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    }
  },
  {
    text: '最近30天',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    }
  },
  {
    text: '本月',
    value: () => {
      const end = new Date()
      const start = new Date(end.getFullYear(), end.getMonth(), 1)
      return [start, end]
    }
  },
  {
    text: '本季度',
    value: () => {
      const end = new Date()
      const quarter = Math.floor(end.getMonth() / 3)
      const start = new Date(end.getFullYear(), quarter * 3, 1)
      return [start, end]
    }
  },
  {
    text: '本年',
    value: () => {
      const end = new Date()
      const start = new Date(end.getFullYear(), 0, 1)
      return [start, end]
    }
  }
]
