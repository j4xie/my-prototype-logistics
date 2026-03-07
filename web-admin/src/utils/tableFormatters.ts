import { formatDate as _formatDate, formatDateTime as _formatDateTime } from './dateFormat'

/**
 * 日期格式化 — el-table-column :formatter — "YYYY-MM-DD"
 * null / undefined / '' 显示为 '-'
 */
export function formatDateCell(_row: any, _column: any, cellValue: any): string {
  return _formatDate(cellValue)
}

/**
 * 日期时间格式化 — el-table-column :formatter — "YYYY-MM-DD HH:mm:ss"
 * null / undefined / '' 显示为 '-'
 */
export function formatDateTimeCell(_row: any, _column: any, cellValue: any): string {
  return _formatDateTime(cellValue)
}

/**
 * 表格空单元格格式化器 — 配合 el-table-column 的 :formatter 属性使用
 * null / undefined / '' 显示为 '-'，保留 0 等有效值
 */
export function emptyCell(_row: any, _column: any, cellValue: any): string {
  return cellValue != null && cellValue !== '' ? String(cellValue) : '-'
}

/**
 * 金额格式化 — ¥ 前缀 + 千分位 + 2 位小数
 */
export function formatAmount(val: number | null | undefined): string {
  if (val == null) return '-'
  return `¥${Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * 数量格式化 — 千分位（整数）；null/undefined 显示 '-'
 * 配合 el-table-column 的 :formatter 属性使用
 */
export function formatQty(_row: any, _column: any, cellValue: any): string {
  if (cellValue == null || cellValue === '') return '-'
  return Number(cellValue).toLocaleString('zh-CN')
}

/**
 * 数量格式化（纯值版）— 用于 template 插值和导出
 */
export function fmtQty(val: number | null | undefined): string {
  if (val == null) return '-'
  return Number(val).toLocaleString('zh-CN')
}

/** el-tag :type 联合类型 — 消除 as any */
export type TagType = '' | 'success' | 'warning' | 'danger' | 'info'

/**
 * 客户端表格导出为 Excel — 动态加载 xlsx 库
 * @param data 表格数据数组
 * @param columns 列定义 { field, label, formatter? }
 * @param filename 文件名（不含扩展名）
 */
export async function exportTableToExcel(
  data: any[],
  columns: { field: string; label: string; formatter?: (val: any, row: any) => string }[],
  filename: string
) {
  const XLSX = await import('xlsx')
  const header = columns.map(c => c.label)
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.field]
      if (c.formatter) return c.formatter(val, row)
      return val != null && val !== '' ? val : '-'
    })
  )
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  // 自动列宽
  ws['!cols'] = columns.map((_, i) => {
    const maxLen = Math.max(
      header[i].length * 2,
      ...rows.map(r => String(r[i] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxLen, 8), 40) }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
