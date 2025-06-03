/**
 * 溯源记录视图组件
 * 负责溯源记录的展示和渲染
 * 
 * @version 1.0.0
 */

import { traceUtils } from '../utils/utils';
import { traceUI } from '../ui/ui';

/**
 * 溯源记录视图模块
 */
export const TraceRecordView = (function() {
  // 默认配置
  const defaultConfig = {
    showTimeline: true,
    showLocation: true,
    showDetailLink: true,
    showStatus: true,
    dateFormat: 'yyyy-MM-dd HH:mm',
    statusColors: {
      completed: '#3FC06D', // 绿色
      verified: '#3FC06D',  // 绿色
      pending: '#F5A623',   // 橙色
      review: '#F5A623',    // 橙色
      error: '#F05656',     // 红色
      rejected: '#F05656',  // 红色
      draft: '#9CA3AF'      // 灰色
    },
    productIcons: {
      meat: 'drumstick-bite',
      poultry: 'kiwi-bird',
      dairy: 'cheese',
      fish: 'fish',
      fruit: 'apple-alt',
      vegetable: 'carrot',
      grain: 'seedling',
      default: 'box'
    },
    timeFormatOptions: {
      relative: true,     // 显示相对时间（如"3天前"）
      absolute: true      // 显示绝对时间（如"2025-03-15 14:30"）
    },
    templates: {
      listItem: null,     // 自定义列表项模板
      detail: null,       // 自定义详情模板
      timeline: null      // 自定义时间线模板
    }
  };
  
  // 内部状态
  let config = { ...defaultConfig };
  
  /**
   * 初始化模块
   * @param {Object} options - 配置选项
   * @returns {Object} 公共API
   */
  function init(options = {}) {
    // 合并配置
    config = { 
      ...config, 
      ...options,
      statusColors: { ...config.statusColors, ...(options.statusColors || {}) },
      productIcons: { ...config.productIcons, ...(options.productIcons || {}) },
      timeFormatOptions: { ...config.timeFormatOptions, ...(options.timeFormatOptions || {}) },
      templates: { ...config.templates, ...(options.templates || {}) }
    };
    
    // 返回公共API
    return {
      renderList,
      renderDetail,
      renderStatusTag,
      renderTimeline,
      getStatusColor,
      getStatusText,
      getProductIcon,
      formatRecordTime,
      createRecordCard,
      getConfig,
      setConfig
    };
  }
  
  /**
   * 渲染溯源记录列表
   * @param {Array} records - 溯源记录数组
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 渲染选项
   * @returns {HTMLElement} 渲染后的容器
   */
  function renderList(records, container, options = {}) {
    if (!records || !records.length) {
      renderEmptyState(container, options.emptyMessage || '暂无溯源记录');
      return container;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 应用列表选项
    const listOptions = {
      onItemClick: options.onItemClick || null,
      highlightId: options.highlightId || null,
      ...options
    };
    
    // 添加每个记录的卡片
    records.forEach(record => {
      const card = createRecordCard(record, listOptions);
      container.appendChild(card);
    });
    
    return container;
  }
  
  /**
   * 渲染单个溯源记录的详情视图
   * @param {Object} record - 溯源记录
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 渲染选项
   * @returns {HTMLElement} 渲染后的容器
   */
  function renderDetail(record, container, options = {}) {
    if (!record) {
      renderEmptyState(container, options.emptyMessage || '未找到溯源记录');
      return container;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 创建详情视图
    if (config.templates.detail) {
      // 使用自定义模板
      const detailHtml = typeof config.templates.detail === 'function'
        ? config.templates.detail(record, options)
        : config.templates.detail;
        
      container.innerHTML = detailHtml;
    } else {
      // 使用默认模板
      createDetailView(record, container, options);
    }
    
    // 如果配置了显示时间线，则添加时间线
    if (config.showTimeline && options.showTimeline !== false) {
      const timelineContainer = document.createElement('div');
      timelineContainer.className = 'trace-timeline-container mt-6';
      renderTimeline(record, timelineContainer, options);
      container.appendChild(timelineContainer);
    }
    
    return container;
  }
  
  /**
   * 创建默认的详情视图
   * @param {Object} record - 溯源记录
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 选项
   * @private
   */
  function createDetailView(record, container, options = {}) {
    // 创建标题部分
    const header = document.createElement('div');
    header.className = 'trace-detail-header mb-4 pb-3 border-b border-gray-200';
    
    // 产品信息
    const productInfo = document.createElement('div');
    productInfo.className = 'flex items-center mb-3';
    
    const iconClass = getProductIcon(record.productType);
    
    productInfo.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
        <i class="fas fa-${iconClass} text-[#00467F]"></i>
      </div>
      <div>
        <h1 class="text-xl font-bold text-gray-800">${record.productName || '未知产品'}</h1>
        <div class="text-sm text-gray-500">ID: ${record.id || ''}</div>
      </div>
      ${config.showStatus ? `<div class="ml-auto">${renderStatusTag(record.status).outerHTML}</div>` : ''}
    `;
    
    header.appendChild(productInfo);
    
    // 基本信息
    const basicInfo = document.createElement('div');
    basicInfo.className = 'grid grid-cols-2 md:grid-cols-3 gap-4 text-sm';
    
    // 添加基本信息字段
    const fields = [
      { label: '批次号', value: record.batchNumber || '-' },
      { label: '位置', value: record.location || '-' },
      { label: '操作人', value: (record.handler?.name || record.handlerName || record.details?.operator || '-') },
      { label: '操作类型', value: record.stage || record.operation || '-' },
      { label: '时间', value: formatRecordTime(record.timestamp || record.createdAt) },
    ];
    
    fields.forEach(field => {
      const fieldEl = document.createElement('div');
      fieldEl.className = 'flex flex-col';
      fieldEl.innerHTML = `
        <span class="text-gray-500">${field.label}</span>
        <span class="font-medium">${field.value}</span>
      `;
      basicInfo.appendChild(fieldEl);
    });
    
    header.appendChild(basicInfo);
    container.appendChild(header);
    
    // 详情部分
    const details = document.createElement('div');
    details.className = 'trace-detail-content';
    
    // 添加详情内容
    if (record.description || record.details?.notes) {
      const description = document.createElement('div');
      description.className = 'mb-4';
      description.innerHTML = `
        <h2 class="text-lg font-medium mb-2">描述</h2>
        <p class="text-gray-700">${record.description || record.details?.notes || '-'}</p>
      `;
      details.appendChild(description);
    }
    
    // 添加附加数据
    const additionalData = record.details || record.additionalData;
    if (additionalData && typeof additionalData === 'object') {
      const dataPanel = document.createElement('div');
      dataPanel.className = 'mb-4';
      dataPanel.innerHTML = `<h2 class="text-lg font-medium mb-2">附加数据</h2>`;
      
      const dataGrid = document.createElement('div');
      dataGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm';
      
      // 排除已经显示的字段
      const excludeKeys = ['notes', 'operator', 'attachments'];
      
      Object.keys(additionalData).forEach(key => {
        if (excludeKeys.includes(key)) return;
        
        const value = additionalData[key];
        if (value === undefined || value === null) return;
        
        const fieldEl = document.createElement('div');
        fieldEl.className = 'flex flex-col';
        
        // 格式化字段名称
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        
        // 格式化值
        let formattedValue = value;
        if (Array.isArray(value)) {
          formattedValue = value.join(', ');
        } else if (typeof value === 'object') {
          formattedValue = JSON.stringify(value, null, 2);
        }
        
        fieldEl.innerHTML = `
          <span class="text-gray-500">${formattedKey}</span>
          <span class="font-medium">${formattedValue}</span>
        `;
        dataGrid.appendChild(fieldEl);
      });
      
      if (dataGrid.children.length > 0) {
        dataPanel.appendChild(dataGrid);
        details.appendChild(dataPanel);
      }
    }
    
    // 添加附件
    const attachments = record.attachments || record.details?.attachments;
    if (attachments && attachments.length > 0) {
      const attachmentsEl = document.createElement('div');
      attachmentsEl.className = 'mb-4';
      attachmentsEl.innerHTML = `<h2 class="text-lg font-medium mb-2">附件</h2>`;
      
      const attachmentList = document.createElement('div');
      attachmentList.className = 'flex flex-wrap gap-2';
      
      attachments.forEach(attachment => {
        let url, name, type;
        
        // 处理不同格式的附件数据
        if (typeof attachment === 'string') {
          url = attachment;
          name = attachment.split('/').pop();
          type = getAttachmentType(attachment);
        } else if (typeof attachment === 'object') {
          url = attachment.url;
          name = attachment.name || url.split('/').pop();
          type = attachment.type || getAttachmentType(url);
        }
        
        const attEl = document.createElement('a');
        attEl.href = url;
        attEl.target = '_blank';
        attEl.className = 'flex items-center p-2 border rounded hover:bg-gray-50';
        
        // 根据附件类型显示不同图标
        let icon = 'file';
        if (type === 'image') icon = 'image';
        else if (type === 'pdf') icon = 'file-pdf';
        else if (type === 'video') icon = 'file-video';
        
        attEl.innerHTML = `
          <i class="fas fa-${icon} mr-2 text-blue-500"></i>
          <span class="text-sm">${name}</span>
        `;
        
        attachmentList.appendChild(attEl);
      });
      
      attachmentsEl.appendChild(attachmentList);
      details.appendChild(attachmentsEl);
    }
    
    container.appendChild(details);
    
    // 添加操作按钮
    if (options.showActions !== false) {
      const actions = document.createElement('div');
      actions.className = 'trace-detail-actions mt-6 flex justify-end';
      
      const viewMoreBtn = document.createElement('button');
      viewMoreBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600';
      viewMoreBtn.textContent = '查看相关记录';
      
      actions.appendChild(viewMoreBtn);
      container.appendChild(actions);
    }
  }
  
  /**
   * 获取附件类型
   * @param {string} url - 附件URL
   * @returns {string} 附件类型
   * @private
   */
  function getAttachmentType(url) {
    if (!url) return 'unknown';
    
    const ext = url.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return 'image';
    } else if (ext === 'pdf') {
      return 'pdf';
    } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
      return 'video';
    } else {
      return 'document';
    }
  }
  
  /**
   * 渲染时间线
   * @param {Object|Array} data - 记录或记录数组
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 选项
   * @returns {HTMLElement} 渲染后的容器
   */
  function renderTimeline(data, container, options = {}) {
    // 确保容器存在
    if (!container) return null;
    
    // 清空容器
    container.innerHTML = '';
    
    // 获取记录数组
    let records;
    let currentRecord;
    
    if (Array.isArray(data)) {
      records = data;
      currentRecord = options.currentRecord || null;
    } else {
      // 单个记录的情况，假设它相关的记录在relatedRecords中
      currentRecord = data;
      records = data.relatedRecords || [data];
    }
    
    if (!records || records.length === 0) {
      renderEmptyState(container, options.emptyMessage || '没有时间线数据');
      return container;
    }
    
    // 按时间降序排序
    records = [...records].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.createdAt);
      const dateB = new Date(b.timestamp || b.createdAt);
      return dateB - dateA;
    });
    
    // 创建时间线元素
    const timeline = document.createElement('div');
    timeline.className = 'timeline-container';
    
    // 添加每条记录到时间线
    records.forEach((record, index) => {
      const isCurrent = currentRecord && (record.id === currentRecord.id || 
        (options.highlightPredicate && options.highlightPredicate(record, currentRecord)));
      
      const timelineItem = createTimelineItem(record, isCurrent, index);
      timeline.appendChild(timelineItem);
    });
    
    container.appendChild(timeline);
    return container;
  }
  
  /**
   * 创建时间线项
   * @param {Object} record - 溯源记录
   * @param {boolean} isCurrent - 是否为当前高亮记录
   * @param {number} index - 索引
   * @returns {HTMLElement} 时间线项元素
   * @private
   */
  function createTimelineItem(record, isCurrent, index) {
    // 使用自定义模板
    if (config.templates.timeline) {
      const itemHtml = typeof config.templates.timeline === 'function'
        ? config.templates.timeline(record, isCurrent, index)
        : config.templates.timeline;
        
      const div = document.createElement('div');
      div.innerHTML = itemHtml;
      return div.firstChild;
    }
    
    // 使用默认模板
    const item = document.createElement('div');
    item.className = `timeline-item flex mb-4 ${isCurrent ? 'timeline-item-active' : ''}`;
    
    // 根据状态设置颜色
    const statusColor = getStatusColor(record.status);
    
    // 格式化时间
    const time = formatRecordTime(record.timestamp || record.createdAt);
    
    // 创建左侧时间线
    const timelineBar = document.createElement('div');
    timelineBar.className = 'timeline-bar mr-4 flex flex-col items-center';
    timelineBar.innerHTML = `
      <div class="timeline-dot w-4 h-4 rounded-full ${isCurrent ? 'bg-blue-500' : `bg-[${statusColor}]`}"></div>
      <div class="timeline-line w-0.5 flex-grow mt-2 ${index === 0 ? 'hidden' : ''} bg-gray-200"></div>
    `;
    
    // 创建右侧内容
    const content = document.createElement('div');
    content.className = 'timeline-content flex-grow pb-4';
    
    const header = document.createElement('div');
    header.className = 'flex justify-between mb-1';
    
    const title = document.createElement('div');
    title.className = 'font-medium';
    title.textContent = record.productName || '溯源记录';
    
    const timestamp = document.createElement('div');
    timestamp.className = 'text-sm text-gray-500';
    timestamp.textContent = time;
    
    header.appendChild(title);
    header.appendChild(timestamp);
    content.appendChild(header);
    
    // 添加状态标签
    const statusDiv = document.createElement('div');
    statusDiv.className = 'mb-2';
    statusDiv.appendChild(renderStatusTag(record.status));
    content.appendChild(statusDiv);
    
    // 添加位置和操作人信息
    const details = document.createElement('div');
    details.className = 'text-sm text-gray-600';
    
    const location = record.location ? `<div>📍 ${record.location}</div>` : '';
    const operator = record.details?.operator || record.handler?.name || record.handlerName
      ? `<div>👤 操作人: ${record.details?.operator || record.handler?.name || record.handlerName}</div>`
      : '';
    const notes = record.details?.notes || record.description
      ? `<div class="mt-1">${record.details?.notes || record.description}</div>`
      : '';
    
    details.innerHTML = `${location}${operator}${notes}`;
    content.appendChild(details);
    
    item.appendChild(timelineBar);
    item.appendChild(content);
    
    return item;
  }
  
  /**
   * 创建记录卡片
   * @param {Object} record - 溯源记录
   * @param {Object} options - 选项
   * @returns {HTMLElement} 卡片元素
   */
  function createRecordCard(record, options = {}) {
    // 使用自定义模板
    if (config.templates.listItem) {
      const cardHtml = typeof config.templates.listItem === 'function'
        ? config.templates.listItem(record, options)
        : config.templates.listItem;
        
      const div = document.createElement('div');
      div.innerHTML = cardHtml;
      
      // 添加点击事件
      if (options.onItemClick) {
        div.firstChild.addEventListener('click', () => {
          options.onItemClick(record);
        });
      }
      
      return div.firstChild;
    }
    
    // 使用默认模板
    const card = document.createElement('div');
    card.className = `
      trace-record-card p-4 rounded-md border mb-3 hover:shadow-md transition
      ${options.highlightId === record.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
    `;
    
    // 添加点击事件
    if (options.onItemClick) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        options.onItemClick(record);
      });
    }
    
    // 卡片头部：产品名称和状态
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-3';
    
    // 产品名称部分
    const productInfo = document.createElement('div');
    productInfo.className = 'flex items-center';
    
    const iconClass = getProductIcon(record.productType);
    
    productInfo.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
        <i class="fas fa-${iconClass} text-[#00467F] text-sm"></i>
      </div>
      <div>
        <h3 class="font-medium">${record.productName || '未知产品'}</h3>
        <div class="text-xs text-gray-500">ID: ${record.id.slice(0, 8)}...</div>
      </div>
    `;
    
    header.appendChild(productInfo);
    
    // 状态标签
    if (config.showStatus) {
      header.appendChild(renderStatusTag(record.status));
    }
    
    card.appendChild(header);
    
    // 卡片内容：信息字段
    const content = document.createElement('div');
    content.className = 'grid grid-cols-2 gap-2 text-sm mb-3';
    
    // 批次号
    if (record.batchNumber) {
      const batch = document.createElement('div');
      batch.innerHTML = `
        <span class="text-gray-500">批次:</span>
        <span>${record.batchNumber}</span>
      `;
      content.appendChild(batch);
    }
    
    // 位置
    if (config.showLocation && record.location) {
      const location = document.createElement('div');
      location.innerHTML = `
        <span class="text-gray-500">位置:</span>
        <span>${record.location}</span>
      `;
      content.appendChild(location);
    }
    
    // 操作人
    const operator = record.handler?.name || record.handlerName || record.details?.operator;
    if (operator) {
      const operatorEl = document.createElement('div');
      operatorEl.innerHTML = `
        <span class="text-gray-500">操作人:</span>
        <span>${operator}</span>
      `;
      content.appendChild(operatorEl);
    }
    
    // 时间
    const time = document.createElement('div');
    time.innerHTML = `
      <span class="text-gray-500">时间:</span>
      <span>${formatRecordTime(record.timestamp || record.createdAt)}</span>
    `;
    content.appendChild(time);
    
    card.appendChild(content);
    
    // 描述
    if (record.description || record.details?.notes) {
      const description = document.createElement('div');
      description.className = 'text-sm text-gray-700 mb-3';
      description.textContent = record.description || record.details?.notes || '';
      card.appendChild(description);
    }
    
    // 查看详情链接
    if (config.showDetailLink && !options.hideDetailLink) {
      const footer = document.createElement('div');
      footer.className = 'flex justify-end';
      
      const link = document.createElement('a');
      link.className = 'text-xs text-blue-500 hover:text-blue-700';
      link.textContent = '查看详情 →';
      
      if (options.onItemClick) {
        link.style.cursor = 'pointer';
        link.addEventListener('click', (e) => {
          e.stopPropagation(); // 防止触发卡片的点击事件
          options.onItemClick(record);
        });
      } else {
        link.href = `#/trace/detail/${record.id}`;
      }
      
      footer.appendChild(link);
      card.appendChild(footer);
    }
    
    return card;
  }
  
  /**
   * 渲染状态标签
   * @param {string} status - 状态值
   * @returns {HTMLElement} 状态标签元素
   */
  function renderStatusTag(status) {
    const { color, text } = getStatusInfo(status);
    
    const tag = document.createElement('span');
    tag.className = `
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      bg-opacity-10 text-${color}
    `;
    tag.style.backgroundColor = `${color}25`; // 10% 透明度
    tag.style.color = color;
    tag.textContent = text;
    
    return tag;
  }
  
  /**
   * 获取状态信息
   * @param {string} status - 状态值
   * @returns {Object} 状态颜色和文本
   * @private
   */
  function getStatusInfo(status) {
    const color = getStatusColor(status);
    const text = getStatusText(status);
    
    return {
      color,
      text
    };
  }
  
  /**
   * 获取状态颜色
   * @param {string} status - 状态值
   * @returns {string} 颜色代码
   */
  function getStatusColor(status) {
    return config.statusColors[status] || '#9CA3AF'; // 默认灰色
  }
  
  /**
   * 获取状态文本
   * @param {string} status - 状态值
   * @returns {string} 状态显示文本
   */
  function getStatusText(status) {
    const statusTextMap = {
      completed: '已完成',
      pending: '待处理',
      verified: '已验证',
      review: '审核中',
      error: '错误',
      rejected: '已拒绝',
      draft: '草稿',
      'in-transit': '运输中'
    };
    
    return statusTextMap[status] || status;
  }
  
  /**
   * 获取产品类型图标
   * @param {string} productType - 产品类型
   * @returns {string} 图标类名
   */
  function getProductIcon(productType) {
    if (!productType) return config.productIcons.default;
    
    // 转换为小写并移除空格
    const type = productType.toLowerCase().replace(/\s+/g, '');
    
    return config.productIcons[type] || config.productIcons.default;
  }
  
  /**
   * 格式化记录时间
   * @param {string|Date} datetime - 日期时间
   * @returns {string} 格式化后的时间字符串
   */
  function formatRecordTime(datetime) {
    if (!datetime) return '-';
    
    let output = '';
    
    // 相对时间
    if (config.timeFormatOptions.relative) {
      const relativeTime = traceUtils.getRelativeTimeString(datetime);
      output += relativeTime;
    }
    
    // 同时显示绝对时间
    if (config.timeFormatOptions.relative && config.timeFormatOptions.absolute) {
      output += ' (';
    }
    
    // 绝对时间
    if (config.timeFormatOptions.absolute) {
      const formattedDate = traceUtils.formatDate(datetime, config.dateFormat);
      output += formattedDate;
    }
    
    if (config.timeFormatOptions.relative && config.timeFormatOptions.absolute) {
      output += ')';
    }
    
    return output;
  }
  
  /**
   * 渲染空状态
   * @param {HTMLElement} container - 容器元素
   * @param {string} message - 显示消息
   * @private
   */
  function renderEmptyState(container, message) {
    container.innerHTML = `
      <div class="trace-empty-state flex flex-col items-center justify-center py-10">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i class="fas fa-search text-gray-400 text-xl"></i>
        </div>
        <div class="text-gray-500">${message}</div>
      </div>
    `;
  }
  
  /**
   * 获取当前配置
   * @returns {Object} 当前配置的副本
   */
  function getConfig() {
    return { ...config };
  }
  
  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   * @returns {Object} 更新后的配置
   */
  function setConfig(newConfig) {
    config = { 
      ...config, 
      ...newConfig,
      statusColors: { ...config.statusColors, ...(newConfig.statusColors || {}) },
      productIcons: { ...config.productIcons, ...(newConfig.productIcons || {}) },
      timeFormatOptions: { ...config.timeFormatOptions, ...(newConfig.timeFormatOptions || {}) },
      templates: { ...config.templates, ...(newConfig.templates || {}) }
    };
    
    return { ...config };
  }
  
  // 创建一个默认实例用于测试
  const defaultInstance = init();
  
  // 暴露公共API
  return {
    init,
    renderList: defaultInstance.renderList,
    renderDetail: defaultInstance.renderDetail,
    renderStatusTag: defaultInstance.renderStatusTag,
    renderTimeline: defaultInstance.renderTimeline,
    getStatusColor: defaultInstance.getStatusColor,
    getStatusText: defaultInstance.getStatusText,
    getProductIcon: defaultInstance.getProductIcon,
    formatRecordTime: defaultInstance.formatRecordTime,
    createRecordCard: defaultInstance.createRecordCard,
    getConfig: defaultInstance.getConfig,
    setConfig: defaultInstance.setConfig
  };
})();

export default TraceRecordView; 