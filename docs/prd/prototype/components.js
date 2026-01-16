/**
 * 白垩纪食品溯源系统 - 原型组件库
 * Cretas Food Traceability System - Prototype Components
 *
 * 此文件提供原型图所需的可复用组件和图标
 */

// ==================== SVG Icons ====================
const Icons = {
  // Navigation Icons
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,

  // Action Icons
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  moreVertical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,

  // Business Icons
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  package: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  clipboardCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>`,
  tool: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  xCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,

  // Role-specific Icons
  factory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l5 3V8l5 3V4h5v16"/></svg>`,
  shoppingCart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
  activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,

  // AI Icon
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`,

  // File/Document Icons
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,

  // Misc
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  mapPin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  trendingUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  trendingDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
};

// ==================== Component Renderers ====================

/**
 * 渲染顶部导航栏
 * @param {string} title - 标题
 * @param {string} subtitle - 副标题(可选)
 * @param {boolean} showBack - 是否显示返回按钮
 * @param {string} rightAction - 右侧操作图标名
 */
function renderHeader(title, subtitle = '', showBack = false, rightAction = '') {
  let leftContent = '';
  if (showBack) {
    leftContent = `<div class="header-action">${Icons.chevronLeft}</div>`;
  } else {
    leftContent = `<div style="width:32px"></div>`;
  }

  let rightContent = '';
  if (rightAction && Icons[rightAction]) {
    rightContent = `<div class="header-action">${Icons[rightAction]}</div>`;
  } else {
    rightContent = `<div style="width:32px"></div>`;
  }

  return `
    <div class="header">
      ${leftContent}
      <div style="text-align:center">
        <div class="header-title">${title}</div>
        ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ''}
      </div>
      ${rightContent}
    </div>
  `;
}

/**
 * 渲染底部导航栏
 * @param {Array} tabs - 标签页配置 [{icon, label, active}]
 */
function renderTabBar(tabs) {
  const tabItems = tabs.map(tab => `
    <div class="tab-item ${tab.active ? 'active' : ''}">
      <div class="tab-icon">${Icons[tab.icon] || ''}</div>
      <div class="tab-label">${tab.label}</div>
    </div>
  `).join('');

  return `<div class="tab-bar">${tabItems}</div>`;
}

/**
 * 渲染统计卡片 (基础版)
 * @param {string} value - 数值
 * @param {string} label - 标签
 * @param {string} type - 颜色类型 (success, warning, error, primary)
 * @param {string} trend - 趋势 (up, down, 或空)
 * @param {string} trendValue - 趋势值
 */
function renderStatCard(value, label, type = '', trend = '', trendValue = '') {
  let trendHtml = '';
  if (trend) {
    const trendIcon = trend === 'up' ? Icons.trendingUp : Icons.trendingDown;
    trendHtml = `
      <div class="stat-trend ${trend}">
        <span style="width:12px;height:12px">${trendIcon}</span>
        ${trendValue}
      </div>
    `;
  }

  return `
    <div class="stat-card">
      <div class="stat-value ${type}">${value}</div>
      <div class="stat-label">${label}</div>
      ${trendHtml}
    </div>
  `;
}

/**
 * 渲染增强统计卡片 (带图标和动画)
 * @param {Object} options - 配置选项
 * @param {string} options.value - 数值
 * @param {string} options.label - 标签
 * @param {string} options.icon - 图标名称
 * @param {string} options.type - 颜色类型 (success, warning, error, primary, info)
 * @param {string} options.trend - 趋势 (up, down)
 * @param {string} options.trendValue - 趋势值 (如 "+5.2%")
 * @param {string} options.subtext - 次要文本
 * @param {boolean} options.animated - 是否启用动画
 */
function renderStatCardEnhanced(options) {
  const {
    value,
    label,
    icon = '',
    type = 'primary',
    trend = '',
    trendValue = '',
    subtext = '',
    animated = true
  } = options;

  const iconHtml = icon && Icons[icon] ? `
    <div class="stat-card-icon ${type}">
      ${Icons[icon]}
    </div>
  ` : '';

  let trendHtml = '';
  if (trend && trendValue) {
    const trendIcon = trend === 'up' ? Icons.trendingUp : Icons.trendingDown;
    trendHtml = `
      <div class="stat-card-trend ${trend}">
        <span class="stat-card-trend-icon">${trendIcon}</span>
        <span>${trendValue}</span>
      </div>
    `;
  }

  const subtextHtml = subtext ? `<div class="stat-card-subtext">${subtext}</div>` : '';

  return `
    <div class="stat-card-enhanced ${type} ${animated ? 'animate-on-hover' : ''}">
      ${iconHtml}
      <div class="stat-card-content">
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
        ${subtextHtml}
      </div>
      ${trendHtml}
    </div>
  `;
}

/**
 * 渲染进度条
 * @param {number} value - 进度值(0-100)
 * @param {string} type - 颜色类型
 */
function renderProgressBar(value, type = '') {
  return `
    <div class="progress-bar">
      <div class="progress-fill ${type}" style="width:${value}%"></div>
    </div>
  `;
}

/**
 * 渲染列表项
 * @param {string} icon - 图标名
 * @param {string} title - 标题
 * @param {string} desc - 描述
 * @param {boolean} showArrow - 是否显示箭头
 * @param {string} rightContent - 右侧内容HTML
 */
function renderListItem(icon, title, desc = '', showArrow = true, rightContent = '') {
  return `
    <div class="list-item">
      <div class="list-item-icon">${Icons[icon] || ''}</div>
      <div class="list-item-content">
        <div class="list-item-title">${title}</div>
        ${desc ? `<div class="list-item-desc">${desc}</div>` : ''}
      </div>
      ${rightContent}
      ${showArrow ? `<div class="list-item-arrow">${Icons.chevronRight}</div>` : ''}
    </div>
  `;
}

/**
 * 渲染标签
 * @param {string} text - 标签文本
 * @param {string} type - 类型 (success, warning, error, info, default)
 */
function renderTag(text, type = 'default') {
  return `<span class="tag ${type}">${text}</span>`;
}

/**
 * 渲染告警卡片
 * @param {string} type - 类型 (error, warning, info, success)
 * @param {string} title - 标题
 * @param {string} desc - 描述
 * @param {string} time - 时间
 */
function renderAlertCard(type, title, desc, time = '') {
  const iconMap = {
    error: Icons.xCircle,
    warning: Icons.alertTriangle,
    info: Icons.alertCircle,
    success: Icons.checkCircle
  };

  return `
    <div class="alert-card ${type}">
      <div class="alert-icon" style="color:var(--${type}-color)">${iconMap[type]}</div>
      <div class="alert-content">
        <div class="alert-title">${title}</div>
        <div class="alert-desc">${desc}</div>
      </div>
      ${time ? `<div class="alert-time">${time}</div>` : ''}
    </div>
  `;
}

/**
 * 渲染批次卡片
 * @param {Object} batch - 批次数据
 */
function renderBatchCard(batch) {
  return `
    <div class="batch-card">
      <div class="batch-header">
        <div class="batch-number">${batch.number}</div>
        ${renderTag(batch.status, batch.statusType)}
      </div>
      <div class="batch-info">
        <div class="batch-info-item">
          <div class="batch-info-label">产品类型</div>
          <div class="batch-info-value">${batch.product}</div>
        </div>
        <div class="batch-info-item">
          <div class="batch-info-label">目标产量</div>
          <div class="batch-info-value">${batch.target} kg</div>
        </div>
        <div class="batch-info-item">
          <div class="batch-info-label">已完成</div>
          <div class="batch-info-value">${batch.completed} kg</div>
        </div>
        <div class="batch-info-item">
          <div class="batch-info-label">客户</div>
          <div class="batch-info-value">${batch.customer}</div>
        </div>
      </div>
      <div class="batch-progress">
        <div class="batch-progress-header">
          <span class="batch-progress-label">完成进度</span>
          <span class="batch-progress-value">${batch.progress}%</span>
        </div>
        ${renderProgressBar(batch.progress)}
      </div>
    </div>
  `;
}

/**
 * 渲染增强任务卡片
 * @param {Object} options - 配置选项
 * @param {string} options.id - 任务ID
 * @param {string} options.title - 标题
 * @param {string} options.subtitle - 副标题/描述
 * @param {string} options.status - 状态 (pending, in_progress, completed, urgent, paused)
 * @param {string} options.statusLabel - 状态标签文本
 * @param {number} options.progress - 进度百分比 (0-100)
 * @param {Array} options.actions - 操作按钮 [{label, type, icon}]
 * @param {Array} options.meta - 元信息列表 [{label, value}]
 * @param {string} options.time - 时间信息
 * @param {boolean} options.animated - 是否启用动画
 */
function renderTaskCard(options) {
  const {
    id = '',
    title,
    subtitle = '',
    status = 'pending',
    statusLabel = '',
    progress,
    actions = [],
    meta = [],
    time = '',
    animated = true
  } = options;

  // 状态映射
  const statusConfig = {
    pending: { class: 'warning', label: '待开始' },
    in_progress: { class: 'primary', label: '进行中' },
    completed: { class: 'success', label: '已完成' },
    urgent: { class: 'error', label: '紧急' },
    paused: { class: 'default', label: '已暂停' }
  };

  const statusInfo = statusConfig[status] || statusConfig.pending;
  const displayLabel = statusLabel || statusInfo.label;

  // 构建头部
  const headerHtml = `
    <div class="task-card-header task-card-header--${statusInfo.class}">
      <div class="task-card-title-section">
        <div class="task-card-title">${title}</div>
        ${id ? `<div class="task-card-id">${id}</div>` : ''}
      </div>
      <span class="tag ${statusInfo.class}">${displayLabel}</span>
    </div>
  `;

  // 构建副标题
  const subtitleHtml = subtitle ? `<div class="task-card-subtitle">${subtitle}</div>` : '';

  // 构建元信息
  let metaHtml = '';
  if (meta.length > 0) {
    const metaItems = meta.map(item => `
      <div class="task-card-meta-item">
        <span class="task-card-meta-label">${item.label}</span>
        <span class="task-card-meta-value">${item.value}</span>
      </div>
    `).join('');
    metaHtml = `<div class="task-card-meta">${metaItems}</div>`;
  }

  // 构建进度条
  let progressHtml = '';
  if (typeof progress === 'number') {
    progressHtml = `
      <div class="task-card-progress">
        <div class="task-card-progress-header">
          <span class="task-card-progress-label">完成进度</span>
          <span class="task-card-progress-value">${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${statusInfo.class}" style="width:${progress}%"></div>
        </div>
      </div>
    `;
  }

  // 构建操作按钮
  let actionsHtml = '';
  if (actions.length > 0) {
    const actionItems = actions.map(action => {
      const iconHtml = action.icon && Icons[action.icon] ?
        `<span class="task-card-action-icon">${Icons[action.icon]}</span>` : '';
      return `
        <button class="btn btn--${action.type || 'default'} btn--sm">
          ${iconHtml}
          ${action.label}
        </button>
      `;
    }).join('');
    actionsHtml = `<div class="task-card-actions">${actionItems}</div>`;
  }

  // 构建时间
  const timeHtml = time ? `<div class="task-card-time">${time}</div>` : '';

  return `
    <div class="task-card-enhanced ${animated ? 'animate-on-hover' : ''}" data-status="${status}">
      ${headerHtml}
      <div class="task-card-body">
        ${subtitleHtml}
        ${metaHtml}
        ${progressHtml}
        ${timeHtml}
      </div>
      ${actionsHtml}
    </div>
  `;
}

/**
 * 渲染快捷操作
 * @param {Array} actions - 操作配置 [{icon, label, color}]
 */
function renderQuickActions(actions) {
  const items = actions.map(action => `
    <div class="quick-action">
      <div class="quick-action-icon ${action.color}">
        ${Icons[action.icon] || ''}
      </div>
      <div class="quick-action-label">${action.label}</div>
    </div>
  `).join('');

  return `<div class="quick-actions">${items}</div>`;
}

/**
 * 渲染AI分析卡片(仅管理员可见)
 * @param {string} insight - AI洞察文本
 */
function renderAICard(insight) {
  return `
    <div class="ai-card">
      <div class="ai-card-header">
        <div class="ai-icon">${Icons.brain}</div>
        <div>
          <div class="ai-title">AI 智能分析</div>
          <div class="ai-subtitle">基于AI大模型</div>
        </div>
      </div>
      <div class="ai-content">
        <div class="ai-insight">${insight}</div>
        <div class="ai-actions">
          <button class="ai-btn">查看详细分析</button>
          <button class="ai-btn">对话咨询</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染打卡组件
 * @param {string} time - 当前时间
 * @param {string} date - 当前日期
 * @param {boolean} isClockedIn - 是否已上班打卡
 * @param {string} clockInTime - 上班打卡时间
 */
function renderClockWidget(time, date, isClockedIn = false, clockInTime = '') {
  return `
    <div class="clock-widget">
      <div class="clock-time">${time}</div>
      <div class="clock-date">${date}</div>
      <button class="clock-btn ${isClockedIn ? 'clocked-in' : ''}">
        ${isClockedIn ? '下班打卡' : '上班打卡'}
      </button>
      ${isClockedIn ? `<div class="clock-status">上班时间: ${clockInTime}</div>` : ''}
    </div>
  `;
}

/**
 * 渲染空状态 (基础版)
 * @param {string} icon - 图标名
 * @param {string} title - 标题
 * @param {string} desc - 描述
 */
function renderEmptyState(icon, title, desc = '') {
  return `
    <div class="empty-state">
      <div class="empty-icon">${Icons[icon] || Icons.box}</div>
      <div class="empty-title">${title}</div>
      ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
    </div>
  `;
}

/**
 * 渲染增强空状态 (带动画和操作按钮)
 * @param {Object} options - 配置选项
 * @param {string} options.icon - 图标名 (使用 Icons 图标)
 * @param {string} options.emoji - 表情符号 (优先于 icon)
 * @param {string} options.title - 标题
 * @param {string} options.description - 描述文本
 * @param {string} options.actionLabel - 操作按钮文本
 * @param {string} options.actionType - 按钮类型 (primary, default)
 * @param {string} options.actionIcon - 按钮图标
 * @param {string} options.secondaryLabel - 次要操作文本
 * @param {boolean} options.animated - 是否启用动画
 */
function renderEmptyStateEnhanced(options) {
  const {
    icon = 'box',
    emoji = '',
    title,
    description = '',
    actionLabel = '',
    actionType = 'primary',
    actionIcon = '',
    secondaryLabel = '',
    animated = true
  } = options;

  // 图标或表情
  let iconHtml = '';
  if (emoji) {
    iconHtml = `<div class="empty-state-emoji">${emoji}</div>`;
  } else if (Icons[icon]) {
    iconHtml = `<div class="empty-state-icon">${Icons[icon]}</div>`;
  } else {
    iconHtml = `<div class="empty-state-icon">${Icons.box}</div>`;
  }

  // 主操作按钮
  let actionHtml = '';
  if (actionLabel) {
    const btnIcon = actionIcon && Icons[actionIcon] ?
      `<span class="btn-icon">${Icons[actionIcon]}</span>` : '';
    actionHtml = `
      <button class="btn btn--${actionType}">
        ${btnIcon}
        ${actionLabel}
      </button>
    `;
  }

  // 次要操作
  const secondaryHtml = secondaryLabel ?
    `<button class="btn btn--text">${secondaryLabel}</button>` : '';

  // 操作区域
  let actionsHtml = '';
  if (actionLabel || secondaryLabel) {
    actionsHtml = `
      <div class="empty-state-actions">
        ${actionHtml}
        ${secondaryHtml}
      </div>
    `;
  }

  return `
    <div class="empty-state-enhanced ${animated ? 'animated' : ''}">
      ${iconHtml}
      <div class="empty-state-title">${title}</div>
      ${description ? `<div class="empty-state-description">${description}</div>` : ''}
      ${actionsHtml}
    </div>
  `;
}

/**
 * 骨架屏组件
 * 用于在数据加载时显示占位内容
 */
const Skeleton = {
  /**
   * 渲染骨架文本行
   * @param {string} width - 宽度 (short, medium, full, 或具体值)
   */
  text: function(width = 'full') {
    const widthMap = {
      short: '40%',
      medium: '70%',
      full: '100%'
    };
    const widthValue = widthMap[width] || width;
    return `<div class="skeleton skeleton-text" style="width: ${widthValue}"></div>`;
  },

  /**
   * 渲染骨架圆形/头像
   * @param {number} size - 大小 (默认 40)
   */
  circle: function(size = 40) {
    return `<div class="skeleton skeleton-circle" style="width: ${size}px; height: ${size}px"></div>`;
  },

  /**
   * 渲染骨架矩形
   * @param {string|number} width - 宽度
   * @param {string|number} height - 高度
   * @param {number} borderRadius - 圆角
   */
  rect: function(width = '100%', height = '100px', borderRadius = 8) {
    const w = typeof width === 'number' ? `${width}px` : width;
    const h = typeof height === 'number' ? `${height}px` : height;
    return `<div class="skeleton skeleton-rect" style="width: ${w}; height: ${h}; border-radius: ${borderRadius}px"></div>`;
  },

  /**
   * 渲染骨架卡片
   * @param {Object} options - 配置选项
   */
  card: function(options = {}) {
    const { showImage = false, lines = 3, showFooter = false } = options;

    let content = '';

    // 图片区域
    if (showImage) {
      content += `<div class="skeleton skeleton-image"></div>`;
    }

    // 内容区域
    content += `<div class="skeleton-card-content">`;
    content += Skeleton.text('medium');
    for (let i = 0; i < lines - 1; i++) {
      content += Skeleton.text(i === lines - 2 ? 'short' : 'full');
    }
    content += `</div>`;

    // 底部区域
    if (showFooter) {
      content += `
        <div class="skeleton-card-footer">
          ${Skeleton.text('short')}
          ${Skeleton.rect(60, 24, 4)}
        </div>
      `;
    }

    return `<div class="skeleton-card">${content}</div>`;
  },

  /**
   * 渲染骨架列表项
   * @param {boolean} showAvatar - 是否显示头像
   * @param {boolean} showAction - 是否显示右侧操作
   */
  listItem: function(showAvatar = true, showAction = false) {
    let content = '';

    if (showAvatar) {
      content += Skeleton.circle(40);
    }

    content += `
      <div class="skeleton-list-content">
        ${Skeleton.text('medium')}
        ${Skeleton.text('short')}
      </div>
    `;

    if (showAction) {
      content += Skeleton.rect(60, 32, 4);
    }

    return `<div class="skeleton-list-item">${content}</div>`;
  },

  /**
   * 渲染骨架列表
   * @param {number} count - 列表项数量
   * @param {boolean} showAvatar - 是否显示头像
   */
  list: function(count = 3, showAvatar = true) {
    let items = '';
    for (let i = 0; i < count; i++) {
      items += Skeleton.listItem(showAvatar, false);
    }
    return `<div class="skeleton-list">${items}</div>`;
  },

  /**
   * 渲染骨架统计卡片
   */
  statCard: function() {
    return `
      <div class="skeleton-stat-card">
        ${Skeleton.circle(32)}
        <div class="skeleton-stat-content">
          ${Skeleton.rect('60%', 28, 4)}
          ${Skeleton.text('short')}
        </div>
      </div>
    `;
  },

  /**
   * 渲染骨架统计网格
   * @param {number} count - 卡片数量
   */
  statGrid: function(count = 4) {
    let cards = '';
    for (let i = 0; i < count; i++) {
      cards += Skeleton.statCard();
    }
    return `<div class="skeleton-stat-grid">${cards}</div>`;
  },

  /**
   * 渲染完整页面骨架
   * @param {string} type - 页面类型 (dashboard, list, detail)
   */
  page: function(type = 'dashboard') {
    switch (type) {
      case 'dashboard':
        return `
          <div class="skeleton-page">
            ${Skeleton.statGrid(4)}
            <div class="skeleton-section">
              ${Skeleton.text('medium')}
              ${Skeleton.list(3, false)}
            </div>
          </div>
        `;
      case 'list':
        return `
          <div class="skeleton-page">
            <div class="skeleton-search">
              ${Skeleton.rect('100%', 44, 8)}
            </div>
            ${Skeleton.list(5, true)}
          </div>
        `;
      case 'detail':
        return `
          <div class="skeleton-page">
            ${Skeleton.card({ showImage: true, lines: 4, showFooter: true })}
            <div class="skeleton-section">
              ${Skeleton.text('medium')}
              ${Skeleton.text('full')}
              ${Skeleton.text('full')}
              ${Skeleton.text('short')}
            </div>
          </div>
        `;
      default:
        return Skeleton.list(5);
    }
  }
};

/**
 * 渲染加载状态
 * @param {string} type - 类型 (spinner, dots, skeleton)
 * @param {string} text - 加载文本
 */
function renderLoadingState(type = 'spinner', text = '加载中...') {
  switch (type) {
    case 'spinner':
      return `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          ${text ? `<div class="loading-text">${text}</div>` : ''}
        </div>
      `;
    case 'dots':
      return `
        <div class="loading-container">
          <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
          ${text ? `<div class="loading-text">${text}</div>` : ''}
        </div>
      `;
    case 'skeleton':
      return Skeleton.page('dashboard');
    default:
      return `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          ${text ? `<div class="loading-text">${text}</div>` : ''}
        </div>
      `;
  }
}

/**
 * 渲染区域标题
 * @param {string} title - 标题
 * @param {string} action - 操作文本
 */
function renderSectionHeader(title, action = '') {
  return `
    <div class="section-header">
      <div class="section-title">${title}</div>
      ${action ? `<div class="section-action">${action}</div>` : ''}
    </div>
  `;
}

// ==================== Role Configuration ====================

const RoleConfig = {
  'factory_super_admin': {
    name: '工厂管理员',
    icon: 'factory',
    letter: '厂',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    desc: '拥有工厂全局管理权限，可查看所有数据和AI分析',
    features: ['全局Dashboard', 'AI智能分析', '数据报表', '系统配置'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'chart', label: '报表' },
      { icon: 'brain', label: 'AI分析' },
      { icon: 'settings', label: '管理' },
      { icon: 'user', label: '我的' },
    ]
  },
  'hr_admin': {
    name: 'HR管理员',
    icon: 'users',
    letter: '人',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    desc: '管理人员信息、白名单和部门组织架构',
    features: ['人员管理', '考勤统计', '白名单', '部门管理'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'users', label: '人员' },
      { icon: 'clock', label: '考勤' },
      { icon: 'clipboardCheck', label: '白名单' },
      { icon: 'user', label: '我的' },
    ]
  },
  'procurement': {
    name: '采购员',
    icon: 'shoppingCart',
    letter: '采',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    desc: '管理供应商和原材料入库',
    features: ['供应商管理', '原料入库', '库存查询', '采购报表'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'download', label: '入库' },
      { icon: 'briefcase', label: '供应商' },
      { icon: 'database', label: '库存' },
      { icon: 'user', label: '我的' },
    ]
  },
  'sales': {
    name: '销售员',
    icon: 'briefcase',
    letter: '销',
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    desc: '管理客户信息和订单跟进',
    features: ['客户管理', '订单跟进', '溯源查询', '销售报表'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'users', label: '客户' },
      { icon: 'fileText', label: '订单' },
      { icon: 'search', label: '溯源' },
      { icon: 'user', label: '我的' },
    ]
  },
  'dispatcher': {
    name: '调度员',
    icon: 'clipboard',
    letter: '调',
    color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    desc: '负责生产调度和任务分配',
    features: ['生产计划', '任务分配', '人员调动', '进度监控'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'calendar', label: '计划' },
      { icon: 'clipboard', label: '分配' },
      { icon: 'users', label: '人员' },
      { icon: 'user', label: '我的' },
    ]
  },
  'workshop_supervisor': {
    name: '车间主任',
    icon: 'tool',
    letter: '间',
    color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    desc: '负责车间生产执行和质量自检',
    features: ['生产执行', '消耗录入', '自检管理', '设备查看'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'box', label: '生产' },
      { icon: 'clipboardCheck', label: '自检' },
      { icon: 'clock', label: '考勤' },
      { icon: 'user', label: '我的' },
    ]
  },
  'operator': {
    name: '操作员',
    icon: 'settings',
    letter: '操',
    color: 'linear-gradient(135deg, #c3cfe2 0%, #c3cfe2 100%)',
    desc: '执行生产任务和数据录入',
    features: ['任务执行', '数据录入', '考勤打卡'],
    tabs: [
      { icon: 'home', label: '任务', active: true },
      { icon: 'edit', label: '录入' },
      { icon: 'clock', label: '考勤' },
      { icon: 'user', label: '我的' },
    ]
  },
  'warehouse': {
    name: '仓储/物流',
    icon: 'package',
    letter: '仓',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    desc: '管理出货和物流追踪',
    features: ['入库确认', '出货管理', '库存查询', '物流追踪'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'download', label: '入库' },
      { icon: 'truck', label: '出货' },
      { icon: 'database', label: '库存' },
      { icon: 'user', label: '我的' },
    ]
  },
  'quality_inspector': {
    name: '质检员',
    icon: 'search',
    letter: '检',
    color: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    desc: '负责产品质量检验',
    features: ['质检录入', '抽检管理', '质检统计', '不合格处理'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'clipboardCheck', label: '质检' },
      { icon: 'fileText', label: '记录' },
      { icon: 'clock', label: '考勤' },
      { icon: 'user', label: '我的' },
    ]
  },
  'equipment_admin': {
    name: '设备管理员',
    icon: 'cpu',
    letter: '设',
    color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    desc: '管理设备维护和告警处理',
    features: ['设备管理', '告警处理', '维护记录', '设备统计'],
    tabs: [
      { icon: 'home', label: '首页', active: true },
      { icon: 'cpu', label: '设备' },
      { icon: 'alertTriangle', label: '告警' },
      { icon: 'tool', label: '维护' },
      { icon: 'user', label: '我的' },
    ]
  }
};

// ==================== Mock Data ====================

const MockData = {
  // 批次数据
  batches: [
    {
      number: 'PB-20251226-001',
      status: '进行中',
      statusType: 'info',
      product: '带鱼片',
      target: 80,
      completed: 45,
      customer: '鲜食超市',
      progress: 56
    },
    {
      number: 'PB-20251226-002',
      status: '待开始',
      statusType: 'default',
      product: '鲈鱼柳',
      target: 120,
      completed: 0,
      customer: '盒马鲜生',
      progress: 0
    },
    {
      number: 'PB-20251225-003',
      status: '已完成',
      statusType: 'success',
      product: '虾仁',
      target: 50,
      completed: 52,
      customer: '永辉超市',
      progress: 100
    }
  ],

  // 告警数据
  alerts: [
    { type: 'error', title: '冷库温度异常', desc: '3号冷库温度超过设定阈值', time: '10分钟前' },
    { type: 'warning', title: '原料即将过期', desc: '带鱼批次MB-001将于3天后过期', time: '30分钟前' },
    { type: 'info', title: '设备维护提醒', desc: '切片机A计划明天进行保养', time: '1小时前' }
  ],

  // 统计数据
  stats: {
    todayOutput: 245,
    completedBatches: 3,
    ongoingBatches: 2,
    equipmentOnline: 8,
    staffOnDuty: 24,
    qualityRate: 98.5
  }
};

// 导出到全局
window.Icons = Icons;
window.RoleConfig = RoleConfig;
window.MockData = MockData;

// 基础组件
window.renderHeader = renderHeader;
window.renderTabBar = renderTabBar;
window.renderStatCard = renderStatCard;
window.renderProgressBar = renderProgressBar;
window.renderListItem = renderListItem;
window.renderTag = renderTag;
window.renderAlertCard = renderAlertCard;
window.renderBatchCard = renderBatchCard;
window.renderQuickActions = renderQuickActions;
window.renderAICard = renderAICard;
window.renderClockWidget = renderClockWidget;
window.renderEmptyState = renderEmptyState;
window.renderSectionHeader = renderSectionHeader;

// 增强组件 (新增)
window.renderStatCardEnhanced = renderStatCardEnhanced;
window.renderTaskCard = renderTaskCard;
window.renderEmptyStateEnhanced = renderEmptyStateEnhanced;
window.renderLoadingState = renderLoadingState;
window.Skeleton = Skeleton;

// 组件快捷方式 (便于使用)
window.Components = {
  // 基础组件
  header: renderHeader,
  tabBar: renderTabBar,
  statCard: renderStatCard,
  progressBar: renderProgressBar,
  listItem: renderListItem,
  tag: renderTag,
  alertCard: renderAlertCard,
  batchCard: renderBatchCard,
  quickActions: renderQuickActions,
  aiCard: renderAICard,
  clockWidget: renderClockWidget,
  emptyState: renderEmptyState,
  sectionHeader: renderSectionHeader,

  // 增强组件
  statCardEnhanced: renderStatCardEnhanced,
  taskCard: renderTaskCard,
  emptyStateEnhanced: renderEmptyStateEnhanced,
  loadingState: renderLoadingState,
  skeleton: Skeleton
};
