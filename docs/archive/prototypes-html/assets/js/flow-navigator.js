/**
 * 白垩纪食品溯源系统 - 页面流程导航器
 * 类似Figma的Prototype流程标注功能
 */

// ==================== 页面流程数据库 ====================
const PAGE_FLOWS = {
    // 主导航
    'index.html': {
        current: '主导航页',
        module: '系统入口',
        next: [
            { page: 'pages/auth/login.html', label: '登录页', condition: '点击"登录"或任意模块' },
            { page: 'flow-map.html', label: '完整流程图', condition: '点击"查看完整流程图"按钮' }
        ]
    },

    // ========== 认证模块 ==========
    'pages/auth/login.html': {
        current: '统一登录页',
        module: '认证模块',
        prev: [
            { page: '../../index.html', label: '返回主导航' }
        ],
        next: [
            { page: '../dashboard/overview.html', label: '生产概览', condition: '登录成功（管理员）' },
            { page: '../employee/clock.html', label: '员工打卡', condition: '登录成功（操作员）' },
            { page: 'register-phase1.html', label: '注册第一步', condition: '点击"立即注册"' }
        ]
    },

    'pages/auth/register-phase1.html': {
        current: '注册 - 手机验证',
        module: '认证模块',
        prev: [
            { page: 'login.html', label: '返回登录' }
        ],
        next: [
            { page: 'register-phase2.html', label: '注册第二步', condition: '验证码通过+白名单检查' }
        ]
    },

    'pages/auth/register-phase2.html': {
        current: '注册 - 完善信息',
        module: '认证模块',
        prev: [
            { page: 'register-phase1.html', label: '返回上一步' }
        ],
        next: [
            { page: 'activation.html', label: '设备激活', condition: '注册成功' }
        ]
    },

    'pages/auth/activation.html': {
        current: '设备激活',
        module: '认证模块',
        prev: [
            { page: 'register-phase2.html', label: '返回注册' }
        ],
        next: [
            { page: '../dashboard/overview.html', label: '生产概览', condition: '激活成功' }
        ]
    },

    // ========== 批次管理模块 ==========
    'pages/batch/list.html': {
        current: '批次列表页',
        module: '批次管理',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: 'detail.html', label: '批次详情', condition: '点击批次卡片' },
            { page: 'create.html', label: '创建批次', condition: '点击"+"FAB按钮' }
        ]
    },

    'pages/batch/detail.html': {
        current: '批次详情页',
        module: '批次管理',
        prev: [
            { page: 'list.html', label: '批次列表' }
        ],
        next: [
            { page: 'timeline.html', label: '批次时间线', condition: '点击"查看时间线"' },
            { page: '../cost/batch-detail.html', label: '成本详情', condition: '点击"成本分析"' },
            { page: '../quality/create.html', label: '创建质检', condition: '点击"创建质检"' },
            { page: 'edit.html', label: '编辑批次', condition: '点击"编辑"（仅planning状态）' }
        ]
    },

    'pages/batch/create.html': {
        current: '创建批次页',
        module: '批次管理',
        prev: [
            { page: 'list.html', label: '批次列表' }
        ],
        next: [
            { page: 'list.html', label: '批次列表', condition: '创建成功' },
            { page: 'detail.html', label: '批次详情', condition: '创建成功并查看详情' }
        ]
    },

    'pages/batch/edit.html': {
        current: '编辑批次页',
        module: '批次管理',
        prev: [
            { page: 'detail.html', label: '批次详情' }
        ],
        next: [
            { page: 'detail.html', label: '批次详情', condition: '保存成功' }
        ]
    },

    'pages/batch/timeline.html': {
        current: '批次时间线',
        module: '批次管理',
        prev: [
            { page: 'detail.html', label: '批次详情' }
        ],
        next: []
    },

    // ========== 质检管理模块 ==========
    'pages/quality/list.html': {
        current: '质检记录列表',
        module: '质检管理',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: 'detail.html', label: '质检详情', condition: '点击质检记录' },
            { page: 'create.html', label: '创建质检', condition: '点击"创建质检"' },
            { page: 'statistics.html', label: '质检统计', condition: '点击"统计分析"' }
        ]
    },

    'pages/quality/create.html': {
        current: '创建质检记录',
        module: '质检管理',
        prev: [
            { page: 'list.html', label: '质检列表' },
            { page: '../batch/detail.html', label: '批次详情' }
        ],
        next: [
            { page: 'detail.html', label: '质检详情', condition: '提交成功' },
            { page: 'list.html', label: '质检列表', condition: '返回列表' }
        ]
    },

    'pages/quality/detail.html': {
        current: '质检详情页',
        module: '质检管理',
        prev: [
            { page: 'list.html', label: '质检列表' }
        ],
        next: [
            { page: '../batch/detail.html', label: '关联批次详情', condition: '点击批次号' }
        ]
    },

    'pages/quality/statistics.html': {
        current: '质检统计分析',
        module: '质检管理',
        prev: [
            { page: 'list.html', label: '质检列表' }
        ],
        next: []
    },

    // ========== 员工管理模块 ==========
    'pages/employee/clock.html': {
        current: '员工打卡页',
        module: '员工管理',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: 'history.html', label: '打卡历史', condition: '点击"查看历史"' },
            { page: 'statistics.html', label: '工时统计', condition: '点击"工时统计"' }
        ]
    },

    'pages/employee/history.html': {
        current: '打卡历史记录',
        module: '员工管理',
        prev: [
            { page: 'clock.html', label: '员工打卡' }
        ],
        next: [
            { page: 'statistics.html', label: '工时统计', condition: '点击"统计分析"' }
        ]
    },

    'pages/employee/statistics.html': {
        current: '工时统计页',
        module: '员工管理',
        prev: [
            { page: 'clock.html', label: '员工打卡' },
            { page: 'history.html', label: '打卡历史' }
        ],
        next: [
            { page: 'work-record.html', label: '工作记录', condition: '点击"工作记录"' }
        ]
    },

    'pages/employee/work-record.html': {
        current: '工作记录页',
        module: '员工管理',
        prev: [
            { page: 'statistics.html', label: '工时统计' }
        ],
        next: [
            { page: '../batch/detail.html', label: '关联批次详情', condition: '点击批次号' }
        ]
    },

    // ========== 设备监控模块 ==========
    'pages/equipment/list.html': {
        current: '设备列表页',
        module: '设备监控',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: 'detail.html', label: '设备详情', condition: '点击设备卡片' },
            { page: 'monitoring.html', label: '实时监控', condition: '点击"实时监控"' },
            { page: 'alerts.html', label: '设备告警', condition: '点击"查看告警"' }
        ]
    },

    'pages/equipment/monitoring.html': {
        current: '设备实时监控',
        module: '设备监控',
        prev: [
            { page: 'list.html', label: '设备列表' }
        ],
        next: [
            { page: 'detail.html', label: '设备详情', condition: '点击设备' },
            { page: 'alerts.html', label: '设备告警', condition: '点击告警提示' }
        ]
    },

    'pages/equipment/detail.html': {
        current: '设备详情页',
        module: '设备监控',
        prev: [
            { page: 'list.html', label: '设备列表' },
            { page: 'monitoring.html', label: '实时监控' }
        ],
        next: [
            { page: 'alerts.html', label: '设备告警', condition: '点击"告警记录"' }
        ]
    },

    'pages/equipment/alerts.html': {
        current: '设备告警页',
        module: '设备监控',
        prev: [
            { page: 'list.html', label: '设备列表' },
            { page: 'monitoring.html', label: '实时监控' }
        ],
        next: [
            { page: 'detail.html', label: '设备详情', condition: '点击设备名称' }
        ]
    },

    // ========== 成本分析模块 ==========
    'pages/cost/dashboard.html': {
        current: '成本仪表板',
        module: '成本分析',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: 'batch-detail.html', label: '批次成本详情', condition: '点击批次' },
            { page: 'trend.html', label: '成本趋势', condition: '点击"趋势分析"' }
        ]
    },

    'pages/cost/batch-detail.html': {
        current: '批次成本详情',
        module: '成本分析',
        prev: [
            { page: 'dashboard.html', label: '成本仪表板' },
            { page: '../batch/detail.html', label: '批次详情' }
        ],
        next: [
            { page: 'ai-analysis.html', label: 'AI成本分析', condition: '点击"AI分析"' },
            { page: 'trend.html', label: '成本趋势', condition: '点击"查看趋势"' }
        ]
    },

    'pages/cost/trend.html': {
        current: '成本趋势分析',
        module: '成本分析',
        prev: [
            { page: 'dashboard.html', label: '成本仪表板' }
        ],
        next: [
            { page: 'batch-detail.html', label: '批次成本详情', condition: '点击批次' }
        ]
    },

    'pages/cost/ai-analysis.html': {
        current: 'AI成本分析',
        module: '成本分析',
        prev: [
            { page: 'batch-detail.html', label: '批次成本详情' }
        ],
        next: []
    },

    // ========== 生产仪表板 ==========
    'pages/dashboard/overview.html': {
        current: '生产概览',
        module: '生产仪表板',
        prev: [
            { page: '../../index.html', label: '主导航' },
            { page: '../auth/login.html', label: '登录页' }
        ],
        next: [
            { page: '../batch/list.html', label: '批次管理', condition: '点击"批次管理"' },
            { page: '../quality/list.html', label: '质检管理', condition: '点击"质检管理"' },
            { page: '../equipment/monitoring.html', label: '设备监控', condition: '点击"设备监控"' },
            { page: '../cost/dashboard.html', label: '成本分析', condition: '点击"成本分析"' },
            { page: 'production.html', label: '生产统计', condition: '点击"生产统计"' }
        ]
    },

    'pages/dashboard/production.html': {
        current: '生产统计页',
        module: '生产仪表板',
        prev: [
            { page: 'overview.html', label: '生产概览' }
        ],
        next: [
            { page: '../batch/list.html', label: '批次列表', condition: '点击批次' }
        ]
    },

    'pages/dashboard/quality.html': {
        current: '质量统计页',
        module: '生产仪表板',
        prev: [
            { page: 'overview.html', label: '生产概览' }
        ],
        next: [
            { page: '../quality/list.html', label: '质检列表', condition: '点击质检记录' }
        ]
    },

    'pages/dashboard/alerts.html': {
        current: '告警中心',
        module: '生产仪表板',
        prev: [
            { page: 'overview.html', label: '生产概览' }
        ],
        next: [
            { page: '../equipment/detail.html', label: '设备详情', condition: '点击设备告警' },
            { page: '../batch/detail.html', label: '批次详情', condition: '点击批次告警' }
        ]
    },

    // ========== 溯源查询模块 ==========
    'pages/trace/consumer.html': {
        current: '消费者溯源查询',
        module: '溯源查询',
        prev: [
            { page: '../../index.html', label: '主导航' }
        ],
        next: []
    },

    'pages/trace/enterprise.html': {
        current: '企业端详细追溯',
        module: '溯源查询',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: '../batch/detail.html', label: '批次详情', condition: '点击批次' }
        ]
    },

    'pages/trace/regulator.html': {
        current: '监管端追溯查询',
        module: '溯源查询',
        prev: [
            { page: '../dashboard/overview.html', label: '生产概览' }
        ],
        next: [
            { page: '../batch/detail.html', label: '批次详情', condition: '点击批次' }
        ]
    },

    'pages/trace/qr-generate.html': {
        current: '溯源码生成',
        module: '溯源查询',
        prev: [
            { page: '../batch/detail.html', label: '批次详情' }
        ],
        next: []
    }
};

// ==================== 工具函数 ====================

/**
 * 获取当前页面的路径（相对于prototypes目录）
 */
function getCurrentPagePath() {
    const fullPath = window.location.pathname;
    const prototypesIndex = fullPath.indexOf('prototypes/');

    if (prototypesIndex !== -1) {
        return fullPath.substring(prototypesIndex + 'prototypes/'.length);
    }

    // 如果直接打开文件，从文件名判断
    const fileName = fullPath.split('/').pop();
    if (fileName === 'index.html') {
        return 'index.html';
    }

    // 尝试从路径推断
    for (const path in PAGE_FLOWS) {
        if (fullPath.includes(path.replace('pages/', ''))) {
            return path;
        }
    }

    return null;
}

/**
 * 获取当前页面的流程信息
 */
function getCurrentFlow() {
    const currentPath = getCurrentPagePath();
    return PAGE_FLOWS[currentPath] || null;
}

/**
 * 显示流程图模态框
 */
function showFlowMap() {
    const flow = getCurrentFlow();

    if (!flow) {
        alert('当前页面流程信息未定义');
        return;
    }

    const modal = document.getElementById('flowModal');
    if (!modal) {
        console.error('流程图模态框未找到');
        return;
    }

    modal.classList.add('active');
    renderFlowContent(flow);
}

/**
 * 关闭流程图模态框
 */
function closeFlowMap() {
    const modal = document.getElementById('flowModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * 渲染流程图内容
 */
function renderFlowContent(flow) {
    const body = document.querySelector('.flow-modal-body');
    if (!body) return;

    let html = '';

    // 面包屑
    html += `
        <div class="breadcrumb">
            <span class="breadcrumb-item">${flow.module}</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item active">${flow.current}</span>
        </div>
    `;

    // 上一步页面
    if (flow.prev && flow.prev.length > 0) {
        html += '<h3 style="margin: 20px 0 12px 0; color: #666; font-size: 14px;">⬅️ 上一步</h3>';
        flow.prev.forEach(prev => {
            html += `
                <div class="flow-next-page" onclick="navigateToPage('${prev.page}')">
                    <div class="flow-next-page-title">${prev.label}</div>
                </div>
            `;
        });
    }

    // 当前页面
    html += '<h3 style="margin: 20px 0 12px 0; color: #666; font-size: 14px;">📍 当前位置</h3>';
    html += `
        <div class="flow-node current">
            <div class="flow-node-title">
                ${flow.current}
                <span class="flow-node-badge">当前</span>
            </div>
        </div>
    `;

    // 下一步页面
    if (flow.next && flow.next.length > 0) {
        html += '<h3 style="margin: 20px 0 12px 0; color: #667eea; font-size: 14px;">⬇️ 下一步可能的操作</h3>';

        flow.next.forEach((next, index) => {
            if (index > 0) {
                html += '<div class="flow-arrow">或</div>';
            }

            html += `
                <div class="flow-next-page" onclick="navigateToPage('${next.page}')">
                    <div class="flow-next-page-title">${next.label}</div>
                    <div class="flow-next-page-condition">触发条件: ${next.condition}</div>
                </div>
            `;
        });
    } else {
        html += `
            <div style="text-align: center; padding: 40px 20px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 12px;">🏁</div>
                <div>流程结束</div>
            </div>
        `;
    }

    body.innerHTML = html;
}

/**
 * 跳转到指定页面
 */
function navigateToPage(relativePath) {
    // 计算正确的相对路径
    const currentPath = window.location.pathname;
    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));

    // 相对于当前页面的路径
    window.location.href = relativePath;
}

/**
 * 初始化流程导航器
 */
function initFlowNavigator() {
    // 添加流程图模态框到页面
    if (!document.getElementById('flowModal')) {
        const modalHTML = `
            <div id="flowModal" class="flow-modal">
                <div class="flow-modal-header">
                    <div class="flow-modal-title">📍 页面流程图</div>
                    <button class="flow-modal-close" onclick="closeFlowMap()">×</button>
                </div>
                <div class="flow-modal-body"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 添加流程导航按钮到页面
    if (!document.querySelector('.flow-nav-btn')) {
        const btnHTML = `
            <button class="flow-nav-btn" onclick="showFlowMap()" title="查看页面流程">
                🗺️
            </button>
        `;
        document.body.insertAdjacentHTML('beforeend', btnHTML);
    }
}

// ==================== 页面加载时初始化 ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlowNavigator);
} else {
    initFlowNavigator();
}

// ==================== 导出给全局使用 ====================
window.showFlowMap = showFlowMap;
window.closeFlowMap = closeFlowMap;
window.navigateToPage = navigateToPage;
window.PAGE_FLOWS = PAGE_FLOWS;
