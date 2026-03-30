/**
 * 自动批量截图脚本 — 生成操作手册所需的全部截图
 * 运行: npx playwright test capture-guide-screenshots.ts --project=vue-web-admin
 */
import { test, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const RN = process.env.RN_BASE_URL || 'http://localhost:3010';
const DIR = 'docs/process-mode-guide/screenshots';

async function shot(page: Page, name: string) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: false });
}

async function shotFull(page: Page, name: string) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/${name}`, fullPage: true });
}

test.describe('Vue 操作手册截图', () => {
  test.setTimeout(300000);

  test('Vue 全流程截图', async ({ page }) => {
    // === 登录流程 ===
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'vue/01-login-empty.png');

    await page.getByRole('button', { name: '工厂总监' }).click();
    await page.waitForTimeout(500);
    await shot(page, 'vue/02-login-filled.png');

    await page.getByRole('button', { name: '登 录' }).click();
    await page.waitForTimeout(3000);
    await shot(page, 'vue/03-dashboard.png');

    // === 系统管理菜单展开 ===
    await page.getByRole('menuitem', { name: '系统管理' }).click();
    await page.waitForTimeout(500);
    await shot(page, 'vue/04-sidebar-system-menu.png');

    // === 工序管理 ===
    await page.getByRole('menuitem', { name: '工序管理' }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'vue/05-work-process-list.png');

    // 新增工序弹窗
    await page.locator('button').filter({ hasText: '新增工序' }).click();
    await page.waitForTimeout(1000);
    await shot(page, 'vue/06-add-process-dialog-empty.png');

    // 填写工序名称
    await page.getByRole('textbox', { name: '工序名称' }).fill('切片加工');
    await page.waitForTimeout(300);
    await shot(page, 'vue/07-add-process-name-filled.png');

    // 展开类别下拉
    const categorySelect = page.locator('.el-dialog .el-select').first();
    await categorySelect.click();
    await page.waitForTimeout(500);
    await shot(page, 'vue/08-add-process-category-dropdown.png');

    // 选择加工
    await page.locator('.el-select-dropdown__item').filter({ hasText: '加工' }).click();
    await page.waitForTimeout(300);

    // 修改单位
    const unitInput = page.locator('.el-dialog').getByRole('textbox', { name: '产出单位' });
    await unitInput.clear();
    await unitInput.fill('片');
    await page.waitForTimeout(300);
    await shot(page, 'vue/09-add-process-all-filled.png');

    // 取消（不实际创建，保持数据干净）
    await page.locator('.el-dialog__footer button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(500);

    // 编辑已有工序
    const editBtn = page.locator('.el-table').locator('button').filter({ hasText: '编辑' }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'vue/10-edit-process-dialog.png');
      await page.locator('.el-dialog__footer button').filter({ hasText: '取消' }).click();
      await page.waitForTimeout(500);
    }

    // 禁用/启用操作
    await shot(page, 'vue/11-process-list-with-actions.png');

    // === 产品-工序配置 ===
    await page.getByRole('menuitem', { name: '产品-工序配置' }).click();
    await page.waitForTimeout(2000);
    await shot(page, 'vue/12-product-process-initial.png');

    // 展开产品下拉
    const productCombo = page.locator('.el-select').first();
    await productCombo.click();
    await page.waitForTimeout(500);
    await shot(page, 'vue/13-product-dropdown-open.png');

    // 选择带鱼段
    const fishOption = page.getByRole('option', { name: '带鱼段' }).first();
    if (await fishOption.isVisible().catch(() => false)) {
      await fishOption.click();
    } else {
      // 选第一个有工序关联的产品
      await page.getByRole('option').nth(2).click();
    }
    await page.waitForTimeout(2000);
    await shot(page, 'vue/14-product-selected-with-processes.png');

    // 截取"生成工序任务"按钮区域
    await shot(page, 'vue/15-generate-task-button.png');

    // 点击"生成工序任务"
    const genBtn = page.locator('button').filter({ hasText: '生成工序任务' });
    if (await genBtn.isVisible().catch(() => false)) {
      await genBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'vue/16-generate-task-confirm-dialog.png');

      // 点确定
      const confirmBtn = page.locator('.el-message-box button').filter({ hasText: '确定' });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, 'vue/17-generate-task-success.png');
      }
    }

    // === 报工审批 ===
    await page.getByRole('menuitem', { name: '生产管理' }).click();
    await page.waitForTimeout(500);
    const approvalMenu = page.getByRole('menuitem', { name: '报工审批' });
    if (await approvalMenu.isVisible().catch(() => false)) {
      await approvalMenu.click();
    } else {
      await page.goto(BASE + '/production/approval', { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(3000);
    await shot(page, 'vue/18-approval-list.png');

    // 审批列表 - 全页
    await shotFull(page, 'vue/19-approval-list-full.png');

    // 如果有待审批，截通过和驳回操作
    const approveBtn = page.locator('.el-table button').filter({ hasText: '通过' }).first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await shot(page, 'vue/20-approval-with-actions.png');

      // 点驳回看弹窗
      const rejectBtn = page.locator('.el-table button').filter({ hasText: '驳回' }).first();
      if (await rejectBtn.isVisible().catch(() => false)) {
        await rejectBtn.click();
        await page.waitForTimeout(1000);
        await shot(page, 'vue/21-reject-dialog.png');

        // 填写原因
        const reasonInput = page.locator('.el-message-box__input input');
        if (await reasonInput.isVisible().catch(() => false)) {
          await reasonInput.fill('数量不准确，请重新核实');
          await page.waitForTimeout(300);
          await shot(page, 'vue/22-reject-reason-filled.png');
        }

        // 取消
        await page.locator('.el-message-box button').filter({ hasText: '取消' }).click();
        await page.waitForTimeout(500);
      }

      // 批量勾选
      const checkboxes = page.locator('.el-table .el-checkbox__input');
      const checkCount = await checkboxes.count();
      if (checkCount >= 3) {
        await checkboxes.nth(1).click();
        await page.waitForTimeout(200);
        await checkboxes.nth(2).click();
        await page.waitForTimeout(500);
        await shot(page, 'vue/23-batch-select.png');

        // 批量通过按钮
        const batchBtn = page.locator('button').filter({ hasText: '批量通过' });
        if (await batchBtn.isVisible().catch(() => false)) {
          await shot(page, 'vue/24-batch-approve-button.png');
        }
      }
    }

    // === 工作流画布 ===
    await page.goto(BASE + '/system/workflow-designer', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await shot(page, 'vue/25-workflow-designer.png');

    console.log('Vue 截图完成');
  });
});

test.describe('RN App 操作手册截图', () => {
  test.setTimeout(300000);

  test('RN 全流程截图', async ({ page }) => {
    // iPhone 14 尺寸 (390x844)
    await page.setViewportSize({ width: 390, height: 844 });

    // === 首页 ===
    await page.goto(RN, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    // 检查是否已登录
    try {
      await page.waitForSelector('[role="tab"]', { timeout: 10000 });
    } catch {
      // 需要登录
      const loginBtn = page.locator('[data-testid="landing-login-btn"]');
      if (await loginBtn.isVisible().catch(() => false)) {
        await shot(page, 'rn/01-landing.png');
        await loginBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, 'rn/02-login-form.png');

        await page.locator('[data-testid="login-username-input"]').fill('factory_admin1');
        await page.locator('[data-testid="login-password-input"]').fill('123456');
        await page.waitForTimeout(500);
        await shot(page, 'rn/03-login-filled.png');

        await page.locator('[data-testid="login-submit-btn"]').click();
        await page.waitForTimeout(8000);
      }
    }

    // 首页
    await shot(page, 'rn/04-home-overview.png');
    await shotFull(page, 'rn/05-home-full.png');

    // === 管理 Tab ===
    const mgmtTab = page.getByRole('tab', { name: '管理' });
    if (await mgmtTab.isVisible().catch(() => false)) {
      await mgmtTab.click();
      await page.waitForTimeout(3000);
      await shot(page, 'rn/06-management-tab.png');
      await shotFull(page, 'rn/07-management-full.png');

      // === 工序任务 ===
      const taskBtn = page.locator('[data-testid="fa-process-task-btn"]');
      const taskTextBtn = page.locator('text=工序任务').first();

      if (await taskBtn.isVisible().catch(() => false)) {
        await taskBtn.click();
      } else if (await taskTextBtn.isVisible().catch(() => false)) {
        await taskTextBtn.click();
      }
      await page.waitForTimeout(3000);
      await shot(page, 'rn/08-task-list-active.png');

      // 切到"已完成"
      const completedTab = page.locator('text=已完成').last();
      if (await completedTab.isVisible().catch(() => false)) {
        await completedTab.click();
        await page.waitForTimeout(2000);
        await shot(page, 'rn/09-task-list-completed.png');
      }

      // 切到"全部"
      const allTab = page.locator('text=全部').last();
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
        await page.waitForTimeout(2000);
        await shot(page, 'rn/10-task-list-all.png');
      }

      // 切回"进行中"
      const activeTab = page.locator('text=进行中').last();
      if (await activeTab.isVisible().catch(() => false)) {
        await activeTab.click();
        await page.waitForTimeout(2000);
      }

      // 全页截图看所有卡片
      await shotFull(page, 'rn/11-task-list-full.png');

      // 搜索框
      const search = page.locator('[data-testid="process-task-search"]');
      if (await search.isVisible().catch(() => false)) {
        await shot(page, 'rn/12-search-bar.png');
      }

      // === 点击报工按钮 ===
      const reportBtn = page.locator('[data-testid^="process-task-report-btn-"]').first();
      if (await reportBtn.isVisible().catch(() => false)) {
        await shot(page, 'rn/13-report-button-highlight.png');

        await reportBtn.click();
        await page.waitForTimeout(3000);
        await shot(page, 'rn/14-report-form-empty.png');

        // 截取表单各区域
        await shotFull(page, 'rn/15-report-form-full.png');

        // 输入数量
        const qtyInput = page.locator('[data-testid="report-quantity-input"]');
        if (await qtyInput.isVisible().catch(() => false)) {
          await qtyInput.click();
          await page.keyboard.type('50');
          await page.waitForTimeout(500);
          await shot(page, 'rn/16-report-quantity-filled.png');

          // 快捷填入按钮
          const quickFill = page.locator('[data-testid^="report-quick-fill-"]').first();
          if (await quickFill.isVisible().catch(() => false)) {
            await shot(page, 'rn/17-quick-fill-buttons.png');
          }

          // 提交按钮
          const submitBtn = page.locator('[data-testid="report-submit-btn"]');
          await shot(page, 'rn/18-submit-button.png');
        }

        // 返回
        const backBtn = page.locator('[data-testid="report-back"]');
        if (await backBtn.isVisible().catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(2000);
        } else {
          await page.goBack();
          await page.waitForTimeout(2000);
        }
      }

      // === 点击卡片进入详情 ===
      const firstCard = page.locator('[data-testid^="process-task-card-"]').first();
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.click();
        await page.waitForTimeout(3000);
        await shot(page, 'rn/19-task-detail.png');
        await shotFull(page, 'rn/20-task-detail-full.png');

        // 报工按钮区域
        const detailReportBtn = page.locator('[data-testid="task-detail-report-btn"]');
        if (await detailReportBtn.isVisible().catch(() => false)) {
          await shot(page, 'rn/21-detail-report-button.png');
        }

        // 查看生产单按钮
        const runBtn = page.locator('[data-testid="task-detail-run-btn"]');
        if (await runBtn.isVisible().catch(() => false)) {
          await shot(page, 'rn/22-detail-run-button.png');
        }

        // 返回
        const detailBack = page.locator('[data-testid="task-detail-back"]');
        if (await detailBack.isVisible().catch(() => false)) {
          await detailBack.click();
          await page.waitForTimeout(2000);
        }
      }

      // === 历史记录 ===
      const historyBtn = page.locator('[data-testid="process-task-history-btn"]');
      if (await historyBtn.isVisible().catch(() => false)) {
        await historyBtn.click();
        await page.waitForTimeout(3000);
        await shot(page, 'rn/23-history.png');
        await shotFull(page, 'rn/24-history-full.png');

        // 切换筛选
        const closedFilter = page.locator('text=已关闭');
        if (await closedFilter.isVisible().catch(() => false)) {
          await closedFilter.click();
          await page.waitForTimeout(2000);
          await shot(page, 'rn/25-history-closed.png');
        }

        // 返回
        const histBack = page.locator('[data-testid="task-history-back"]');
        if (await histBack.isVisible().catch(() => false)) {
          await histBack.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // === 回首页看工序任务卡片 ===
    const homeTab = page.getByRole('tab', { name: '首页' });
    if (await homeTab.isVisible().catch(() => false)) {
      await homeTab.click();
      await page.waitForTimeout(3000);
      await shot(page, 'rn/26-home-with-task-card.png');
    }

    // === 我的 Tab ===
    const profileTab = page.getByRole('tab', { name: '我的' });
    if (await profileTab.isVisible().catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(2000);
      await shot(page, 'rn/27-profile.png');
    }

    console.log('RN 截图完成');
  });
});
