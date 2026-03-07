/**
 * 统一日期格式化工具
 */

/** Date 对象 → "YYYY-MM-DD" */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO 字符串 → "YYYY-MM-DD HH:mm:ss" (去掉T和毫秒) */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  } catch {
    return dateStr || '-';
  }
}

/** ISO 字符串 / Date → "HH:mm" */
export function formatTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return typeof dateStr === 'string' ? dateStr : '-';
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${mi}`;
  } catch {
    return typeof dateStr === 'string' ? dateStr : '-';
  }
}

/** ISO 字符串 → "YYYY-MM-DD" */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return toDateString(date);
  } catch {
    return dateStr || '-';
  }
}
