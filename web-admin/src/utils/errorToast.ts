/**
 * 业务 catch 块统一错误处理辅助
 *
 * 背景 (Bug #8 R21 sweep 2026-04-16):
 * axios response interceptor (@/api/request.ts) 对任意 4xx/5xx 已调 showMessage
 * 显示后端 friendly message. 业务代码 catch 再 ElMessage.error 会叠加第 2 个 toast
 * (e.g. G1 409 时用户看到 "请检查网络" + "INV-xxx 已待处理" 两条, 前者误导).
 *
 * 约定: catch 块用 handleCatchError(e, fallbackMsg) 替代直接 ElMessage.error,
 * 只在真网络错误 (err.status 未设) 时显示 fallback.
 */
import { ElMessage } from 'element-plus';
import { ApiError } from '@/types/api';

/**
 * catch 块统一处理 — 有 status 说明 interceptor 已显示服务端消息, 不重复 toast.
 * 仅在 ApiError.status 缺失 (纯网络错) 时显示 fallback.
 *
 * @param e catch 块捕获的 error
 * @param fallbackMsg 真网络错误时显示的消息
 */
export function handleCatchError(e: unknown, fallbackMsg: string): void {
  const err = e as ApiError | { status?: number };
  if (!err?.status) {
    ElMessage.error(fallbackMsg);
  }
  // 否则 interceptor 已显示 err.message, 不再 toast
}

/**
 * Extract error message from unknown catch value (Tier 3 vue-tsc cleanup 2026-05-10).
 *
 * Replaces the common `error?.message` pattern in `catch (error: unknown)` blocks
 * which fails TS2339 (`Property 'message' does not exist on type 'unknown'`).
 *
 * @param e catch 块捕获的 error
 * @param fallback fallback message when error has no .message
 * @returns the error message or fallback
 */
export function getErrorMessage(e: unknown, fallback = '未知错误'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}
