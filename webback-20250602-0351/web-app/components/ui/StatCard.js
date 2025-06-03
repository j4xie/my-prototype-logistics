/**
 * StatCard 组件
 * 统计数据卡片，用于展示关键指标
 * @param {Object} config - 配置对象
 * @param {string} config.label - 指标名称
 * @param {string|number} config.value - 指标值
 * @param {string} config.unit - 单位
 * @param {string} config.icon - 图标名称
 * @param {string} config.color - 颜色主题 'primary'|'success'|'warning'|'error'|'purple'
 * @param {string} config.url - 点击跳转链接
 * @param {Function} config.onClick - 点击回调
 * @param {string} config.size - 卡片尺寸 'normal'|'small'|'large'
 * @param {string} config.trend - 趋势 'up'|'down'|'flat'
 * @param {string} config.trendValue - 趋势值
 */
class StatCard {
    constructor(config = {}) {
        this.config = {
            label: '指标名称',
            value: 0,
            unit: '',
            icon: 'chart-line',
            color: 'primary',
            url: '',
            onClick: null,
            size: 'normal',
            trend: '',
            trendValue: '',
            ...config
        };
        
        this.element = null;
    }
    
    /**
     * 渲染统计卡片
     * @param {string} targetSelector - 目标容器选择器
     */
    render(targetSelector) {
        const target = document.querySelector(targetSelector);
        if (!target) return;
        
        // 创建卡片元素
        this.element = document.createElement('div');
        
        // 添加基础类
        this.element.className = 'stat-card';
        
        // 添加卡片尺寸类
        if (this.config.size !== 'normal') {
            this.element.classList.add(`size-${this.config.size}`);
        }
        
        // 设置HTML内容
        this.element.innerHTML = this._renderCardContent();
        
        // 添加到目标容器
        target.appendChild(this.element);
        
        // 绑定事件
        this._bindEvents();
    }
    
    /**
     * 渲染卡片内容
     * @returns {string} 卡片内容HTML
     */
    _renderCardContent() {
        const { label, value, unit, icon, color, trend, trendValue } = this.config;
        
        // 构建背景类名
        const bgClass = `bg-icon-${color}`;
        const iconClass = `icon-${color}`;
        
        // 构建趋势HTML
        let trendHtml = '';
        if (trend) {
            const trendIcon = trend === 'up' ? 'arrow-up' : (trend === 'down' ? 'arrow-down' : 'minus');
            const trendClass = trend === 'up' ? 'trend-up' : (trend === 'down' ? 'trend-down' : 'trend-flat');
            
            trendHtml = `
                <div class="stat-trend ${trendClass}">
                    <i class="fas fa-${trendIcon} mr-1"></i>
                    <span>${trendValue}</span>
                </div>
            `;
        }
        
        // 返回卡片内容
        return `
            <div class="flex items-center justify-between">
                <div>
                    <p class="stat-label">${label}</p>
                    <div class="flex items-end">
                        <p class="stat-value">${value}<span class="stat-unit">${unit}</span></p>
                        ${trendHtml}
                    </div>
                </div>
                <div class="stat-icon-wrapper ${bgClass}">
                    <i class="fas fa-${icon} ${iconClass}"></i>
                </div>
            </div>
        `;
    }
    
    /**
     * 绑定事件
     */
    _bindEvents() {
        const { url, onClick } = this.config;
        
        // 添加点击效果
        if (url || onClick) {
            this.element.classList.add('clickable');
            
            this.element.addEventListener('click', (e) => {
                // 如果有自定义点击事件，则调用
                if (onClick) {
                    onClick(e);
                    return;
                }
                
                // 否则，如果有URL，则跳转
                if (url) {
                    window.location.href = url;
                }
            });
        }
    }
    
    /**
     * 更新统计值
     * @param {string|number} value - 新的统计值
     * @param {string} trendValue - 新的趋势值
     * @param {string} trend - 新的趋势方向
     */
    updateValue(value, trendValue = null, trend = null) {
        // 更新配置
        this.config.value = value;
        
        if (trendValue !== null) {
            this.config.trendValue = trendValue;
        }
        
        if (trend !== null) {
            this.config.trend = trend;
        }
        
        // 更新DOM
        this._updateValueInDom();
    }
    
    /**
     * 更新DOM中的统计值
     */
    _updateValueInDom() {
        // 更新统计值
        const valueElement = this.element.querySelector('.stat-value');
        if (valueElement) {
            const unitElement = valueElement.querySelector('.stat-unit');
            const unitText = unitElement ? unitElement.outerHTML : `<span class="stat-unit">${this.config.unit}</span>`;
            valueElement.innerHTML = `${this.config.value}${unitText}`;
        }
        
        // 更新趋势信息
        if (this.config.trend) {
            let trendElement = this.element.querySelector('.stat-trend');
            const trendIcon = this.config.trend === 'up' ? 'arrow-up' : (this.config.trend === 'down' ? 'arrow-down' : 'minus');
            const trendClass = this.config.trend === 'up' ? 'trend-up' : (this.config.trend === 'down' ? 'trend-down' : 'trend-flat');
            
            if (trendElement) {
                // 更新现有趋势元素
                trendElement.className = `stat-trend ${trendClass}`;
                trendElement.innerHTML = `
                    <i class="fas fa-${trendIcon} mr-1"></i>
                    <span>${this.config.trendValue}</span>
                `;
            } else {
                // 创建新的趋势元素
                trendElement = document.createElement('div');
                trendElement.className = `stat-trend ${trendClass}`;
                trendElement.innerHTML = `
                    <i class="fas fa-${trendIcon} mr-1"></i>
                    <span>${this.config.trendValue}</span>
                `;
                
                const valueContainer = this.element.querySelector('.flex.items-end');
                if (valueContainer) {
                    valueContainer.appendChild(trendElement);
                }
            }
        } else {
            // 如果没有趋势信息，移除趋势元素
            const trendElement = this.element.querySelector('.stat-trend');
            if (trendElement) {
                trendElement.remove();
            }
        }
    }
    
    /**
     * 更新卡片颜色
     * @param {string} color - 新的颜色主题
     */
    updateColor(color) {
        const iconWrapper = this.element.querySelector('.stat-icon-wrapper');
        const icon = this.element.querySelector('.fas');
        
        if (!iconWrapper || !icon) return;
        
        // 移除旧的颜色类
        iconWrapper.classList.forEach(className => {
            if (className.startsWith('bg-icon-')) {
                iconWrapper.classList.remove(className);
            }
        });
        
        icon.classList.forEach(className => {
            if (className.startsWith('icon-')) {
                icon.classList.remove(className);
            }
        });
        
        // 添加新的颜色类
        iconWrapper.classList.add(`bg-icon-${color}`);
        icon.classList.add(`icon-${color}`);
        
        // 更新配置
        this.config.color = color;
    }
}

// 导出组件
window.StatCard = StatCard; 