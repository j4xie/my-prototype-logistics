/**
 * 页面流程可视化标注系统
 * 类似Figma的交互原型标注
 */

// 流程标注模式状态
let flowModeActive = false;

/**
 * 切换流程标注模式
 */
function toggleFlowMode() {
    flowModeActive = !flowModeActive;
    document.body.classList.toggle('flow-mode', flowModeActive);

    const toggleBtn = document.querySelector('.flow-annotations-toggle');
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', flowModeActive);
        toggleBtn.innerHTML = flowModeActive
            ? '✓ 关闭流程标注'
            : '🔍 显示流程标注';
    }
}

/**
 * 添加可点击热区标注
 * @param {string} selector - CSS选择器
 * @param {string} targetPage - 目标页面
 * @param {string} description - 描述
 */
function addClickableHotspot(selector, targetPage, description) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.classList.add('clickable-hotspot');
    element.setAttribute('data-flow-to', description);

    // 添加点击事件（如果还没有）
    if (!element.onclick && !element.href) {
        element.onclick = () => navigateToPage(targetPage);
    }
}

/**
 * 添加交互标签
 * @param {string} parentSelector - 父元素选择器
 * @param {string} label - 标签文字
 * @param {object} position - 位置 {top, left, right, bottom}
 */
function addInteractionLabel(parentSelector, label, position = {}) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'interaction-label';
    labelDiv.textContent = label;

    // 设置位置
    Object.assign(labelDiv.style, position);

    parent.style.position = 'relative';
    parent.appendChild(labelDiv);
}

/**
 * 添加流程卡片
 * @param {string} parentSelector - 父元素选择器
 * @param {object} config - 配置 {title, items, position}
 */
function addFlowCard(parentSelector, config) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    const card = document.createElement('div');
    card.className = 'flow-card';

    let html = `<div class="flow-card-title">${config.title}</div>`;
    html += '<div class="flow-card-items">';

    config.items.forEach(item => {
        html += `
            <div class="flow-card-item" onclick="navigateToPage('${item.page}')">
                ${item.label}
            </div>
        `;
    });

    html += '</div>';
    card.innerHTML = html;

    // 设置位置
    if (config.position) {
        Object.assign(card.style, config.position);
    }

    parent.style.position = 'relative';
    parent.appendChild(card);
}

/**
 * 绘制SVG连线
 * @param {string} fromSelector - 起点元素
 * @param {string} toSelector - 终点元素
 * @param {string} label - 连线标签
 */
function drawFlowLine(fromSelector, toSelector, label = '') {
    const fromEl = document.querySelector(fromSelector);
    const toEl = document.querySelector(toSelector);

    if (!fromEl || !toEl) return;

    // 创建SVG容器
    let svg = document.querySelector('.flow-connections');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('flow-connections');
        svg.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10; display: none;';
        document.body.appendChild(svg);
    }

    // 计算位置
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.bottom;
    const endX = toRect.left + toRect.width / 2;
    const endY = toRect.top;

    // 计算控制点（贝塞尔曲线）
    const controlY = (startY + endY) / 2;

    // 创建路径
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${startX} ${startY} Q ${startX} ${controlY}, ${endX} ${endY}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'flow-line');

    // 添加箭头标记
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    marker.innerHTML = `
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#1890ff" />
        </marker>
    `;
    path.setAttribute('marker-end', 'url(#arrowhead)');

    svg.appendChild(marker);
    svg.appendChild(path);

    // 添加标签
    if (label) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (startX + endX) / 2);
        text.setAttribute('y', (startY + endY) / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#1890ff');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '600');
        text.textContent = label;
        svg.appendChild(text);
    }
}

/**
 * 初始化流程标注系统
 */
function initFlowAnnotations() {
    // 添加流程标注开关按钮
    if (!document.querySelector('.flow-annotations-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'flow-annotations-toggle';
        toggleBtn.innerHTML = '🔍 显示流程标注';
        toggleBtn.onclick = toggleFlowMode;
        document.body.appendChild(toggleBtn);
    }

    // 添加遮罩层
    if (!document.querySelector('.flow-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'flow-overlay';
        overlay.onclick = () => {
            if (flowModeActive) {
                toggleFlowMode();
            }
        };
        document.body.insertBefore(overlay, document.body.firstChild);
    }
}

/**
 * 页面跳转
 */
function navigateToPage(relativePath) {
    window.location.href = relativePath;
}

// 页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlowAnnotations);
} else {
    initFlowAnnotations();
}

// 导出全局函数
window.toggleFlowMode = toggleFlowMode;
window.addClickableHotspot = addClickableHotspot;
window.addInteractionLabel = addInteractionLabel;
window.addFlowCard = addFlowCard;
window.drawFlowLine = drawFlowLine;
