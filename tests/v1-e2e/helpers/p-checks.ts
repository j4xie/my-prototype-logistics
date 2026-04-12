import { Page, expect, Request } from '@playwright/test';

/**
 * P-2: Verify a mutating button doesn't allow double-submit.
 * Clicks the button, immediately clicks again, asserts only 1 matching POST/PUT fired.
 */
export async function verifyNoDoubleSubmit(
  page: Page,
  buttonLocator: string,
  urlPattern: string | RegExp
): Promise<void> {
  const requests: Request[] = [];
  page.on('request', (req) => {
    if ((req.method() === 'POST' || req.method() === 'PUT') &&
        (typeof urlPattern === 'string' ? req.url().includes(urlPattern) : urlPattern.test(req.url()))) {
      requests.push(req);
    }
  });

  const btn = page.locator(buttonLocator).first();
  await btn.click();
  await btn.click({ force: true }).catch(() => {});

  await page.waitForTimeout(2000);

  expect(requests.length, `P-2 DOUBLE_SUBMIT: expected ≤1 request to ${urlPattern}, got ${requests.length}`).toBeLessThanOrEqual(1);
}

/**
 * P-3: Verify dirty form shows navigation guard when leaving.
 */
export async function verifyDirtyFormGuard(
  page: Page,
  inputSelector: string,
  editValue: string
): Promise<{ hasGuard: boolean }> {
  const input = page.locator(inputSelector).first();
  await input.fill(editValue);
  await page.waitForTimeout(500);

  let dialogFired = false;
  page.on('dialog', async (dialog) => {
    dialogFired = true;
    await dialog.dismiss();
  });

  await page.goBack().catch(() => {});
  await page.waitForTimeout(1000);

  return { hasGuard: dialogFired };
}

/**
 * P-5: Verify an action produces a visible effect (not silently swallowed).
 */
export async function verifySilentFailure(
  page: Page,
  actionFn: () => Promise<void>,
  effectSelector: string,
  description: string
): Promise<void> {
  await actionFn();
  await page.waitForTimeout(1000);
  const effect = page.locator(effectSelector).first();
  const visible = await effect.isVisible({ timeout: 5000 }).catch(() => false);
  expect(visible, `P-5 SILENT_FAIL: "${description}" — expected ${effectSelector} to appear`).toBe(true);
}

/**
 * Hard Rule 5: Get required field labels from a form (elements with .is-required class).
 */
export async function getRequiredFieldLabels(page: Page, scope?: string): Promise<string[]> {
  const container = scope ? page.locator(scope) : page;
  return container.locator('.el-form-item.is-required .el-form-item__label').allTextContents();
}
