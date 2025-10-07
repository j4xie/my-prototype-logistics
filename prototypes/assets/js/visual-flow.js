/**
 * 可视化流程标注系统 - 自动在页面上绘制Figma风格的箭头和连线
 */

// 页面加载完成后自动显示流程标注
document.addEventListener('DOMContentLoaded', function() {
    // 自动为所有带data-flow-to属性的元素添加可视化标注
    addVisualFlowAnnotations();
});

/**
 * 添加可视化流程标注
 */
function addVisualFlowAnnotations() {
    // 查找所有带flow标注的元素
    const annotatedElements = document.querySelectorAll('[data-flow-to]');

    annotatedElements.forEach((element, index) => {
        const flowTarget = element.getAttribute('data-flow-to');

        // 添加脉冲动画边框
        element.style.position = 'relative';

        // 创建标注气泡
        const bubble = document.createElement('div');
        bubble.className = 'flow-bubble';
        bubble.innerHTML = `
            <div class="flow-bubble-content">
                <span class="flow-icon">→</span>
                <span class="flow-text">${flowTarget}</span>
            </div>
        `;

        // 设置气泡位置
        bubble.style.position = 'absolute';
        bubble.style.top = '-40px';
        bubble.style.left = '50%';
        bubble.style.transform = 'translateX(-50%)';
        bubble.style.zIndex = '1000';

        element.appendChild(bubble);

        // 延迟显示，产生动画效果
        setTimeout(() => {
            bubble.classList.add('visible');
        }, 300 + index * 100);
    });
}

// 样式注入
const style = document.createElement('style');
style.textContent = `
    /* 流程气泡样式 */
    .flow-bubble {
        position: absolute;
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
    }

    .flow-bubble.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }

    .flow-bubble-content {
        background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3);
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .flow-bubble-content::after {
        content: '';
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid #73d13d;
    }

    .flow-icon {
        font-size: 12px;
        animation: bounce 1s ease-in-out infinite;
    }

    @keyframes bounce {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(3px); }
    }

    .flow-text {
        font-size: 11px;
    }

    /* 为带标注的元素添加脉冲效果 */
    [data-flow-to] {
        position: relative;
    }

    [data-flow-to]::before {
        content: '';
        position: absolute;
        inset: -2px;
        border: 2px solid #52c41a;
        border-radius: inherit;
        opacity: 0;
        animation: pulse-border 2s ease-in-out infinite;
    }

    @keyframes pulse-border {
        0%, 100% {
            opacity: 0;
            transform: scale(1);
        }
        50% {
            opacity: 0.6;
            transform: scale(1.02);
        }
    }
`;
document.head.appendChild(style);
