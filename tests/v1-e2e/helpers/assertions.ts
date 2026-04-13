import { Page, expect, Locator } from '@playwright/test';
import { S } from './selectors';

/**
 * 等 toast 出现并包含某个文字, 默认 5s
 */
export async function expectToast(
  page: Page,
  text: string | RegExp,
  opts: { type?: 'success' | 'error' | 'warning'; timeout?: number } = {}
): Promise<void> {
  const type = opts.type || 'success';
  const selector =
    type === 'success' ? S.message.success :
    type === 'error' ? S.message.error :
    S.message.warning;
  const toast = page.locator(selector).filter({ hasText: text });
  await expect(toast, `期望 ${type} toast 包含 "${text}"`).toBeVisible({
    timeout: opts.timeout || 5000,
  });
}

/**
 * 确保 API 没报错 (没 error toast 出现)
 */
export async function expectNoErrors(page: Page, waitMs = 1000): Promise<void> {
  await page.waitForTimeout(waitMs);
  const errorCount = await page.locator(S.message.error).count();
  expect(errorCount, `页面出现 ${errorCount} 个 error toast`).toBe(0);
}

/**
 * 表格中某行包含指定文字
 */
export async function expectTableRow(
  page: Page,
  text: string,
  opts: { timeout?: number } = {}
): Promise<Locator> {
  const row = page.locator(S.table.rowByText(text)).first();
  await expect(row, `表格中找不到含 "${text}" 的行`).toBeVisible({
    timeout: opts.timeout || 5000,
  });
  return row;
}

/**
 * 获取 URL path (去 query string)
 */
export function pathFromUrl(url: string): string {
  return new URL(url).pathname;
}
