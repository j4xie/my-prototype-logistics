/**
 * Element Plus locator templates — S.* registry
 * Centralised here so that component-library upgrades only need one-place fixes.
 */

export const S = {
  login: {
    // el-input renders a native <input> inside .el-input__inner
    usernameInput: '.el-form-item:first-child input',
    passwordInput: 'input[type="password"]',
    submitButton: 'button.login-button',
  },

  sidebar: {
    menuItem: (title: string) => `.el-menu-item:has-text("${title}")`,
    subMenu: (title: string) => `.el-sub-menu__title:has-text("${title}")`,
  },

  form: {
    input: (label: string) =>
      `.el-form-item:has(.el-form-item__label:text-is("${label}")) input`,
    textarea: (label: string) =>
      `.el-form-item:has(.el-form-item__label:text-is("${label}")) textarea`,
    select: (label: string) =>
      `.el-form-item:has(.el-form-item__label:text-is("${label}")) .el-select`,
    selectOption: (text: string) =>
      `.el-select-dropdown__item:has-text("${text}")`,
  },

  button: (text: string) => `button:has-text("${text}")`,

  message: {
    success: '.el-message--success',
    error: '.el-message--error',
    warning: '.el-message--warning',
    toast: (text: string) => `.el-message:has-text("${text}")`,
  },

  table: {
    root: '.el-table',
    row: '.el-table__row',
    rowByText: (text: string) => `.el-table__row:has-text("${text}")`,
    cell: (col: string) => `[class*="el-table_"][class*="_column_${col}"]`,
  },

  dialog: {
    root: '.el-dialog',
    title: '.el-dialog__title',
    confirmButton:
      '.el-dialog__footer button:has-text("确认"), .el-dialog__footer button:has-text("确定")',
    cancelButton: '.el-dialog__footer button:has-text("取消")',
  },

  upload: {
    input: '.el-upload input[type="file"]',
  },

  tab: (name: string) => `.el-tabs__item:has-text("${name}")`,
  tag: (text: string) => `.el-tag:has-text("${text}")`,

  // AppHeader user-info dropdown → logout
  header: {
    userDropdown: '.user-info',
    logoutItem: '.el-dropdown-menu .el-dropdown-item:has-text("退出登录")',
  },
};
