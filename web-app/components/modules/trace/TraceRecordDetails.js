/**
 * 溯源记录详情组件
 * 用于显示和管理单个溯源记录的详细信息
 * 
 * @version 1.0.0
 */

import { traceUtils } from '../utils/utils';
import { traceStore } from '../store/store';
import { traceData } from '../data/data';
import { TraceRecordView } from './TraceRecordView';

/**
 * 溯源记录详情模块
 */
export const TraceRecordDetails = (function() {
  // 默认配置
  const defaultConfig = {
    enableEdit: false,      // 是否允许编辑
    enableVerify: true,     // 是否允许验证
    enableExport: true,     // 是否允许导出
    enableShare: true,      // 是否允许分享
    enableBlockchain: true, // 是否启用区块链验证
    autoLoad: true,         // 是否自动加载数据
    showRelatedRecords: true, // 是否显示相关记录
    maxRelatedRecords: 5,     // 最大相关记录数量
    callbacks: {
      onLoad: null,         // 加载记录后的回调
      onEdit: null,         // 编辑记录后的回调
      onVerify: null,       // 验证记录后的回调
      onExport: null,       // 导出记录后的回调
      onShare: null,        // 分享记录后的回调
      onError: null         // 错误处理回调
    }
  };
  
  // 内部状态
  let config = { ...defaultConfig };
  let currentRecord = null;
  let relatedRecords = [];
  let isLoading = false;
  let errorMessage = '';
  let view = null;
  
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
      callbacks: { ...config.callbacks, ...(options.callbacks || {}) }
    };
    
    // 初始化视图模块
    view = TraceRecordView.init({
      showTimeline: true,
      showDetailLink: false
    });
    
    // 返回公共API
    return {
      load,
      refresh,
      getRecord,
      renderTo,
      verify,
      exportRecord,
      shareRecord,
      generateQRCode,
      getRelatedRecords,
      getConfig,
      setConfig
    };
  }
  
  /**
   * 加载溯源记录
   * @param {string} recordId - 记录ID
   * @param {Object} options - 加载选项
   * @returns {Promise<Object>} 溯源记录对象
   */
  function load(recordId, options = {}) {
    if (!recordId) {
      errorMessage = '记录ID不能为空';
      if (config.callbacks.onError) {
        config.callbacks.onError(new Error(errorMessage));
      }
      return Promise.reject(new Error(errorMessage));
    }
    
    isLoading = true;
    errorMessage = '';
    
    // 使用本地缓存
    const useCache = options.useCache !== false;
    
    return traceData.getTraceRecord(recordId, { useCache })
      .then(record => {
        currentRecord = record;
        
        // 如果配置了显示相关记录，就加载相关记录
        if (config.showRelatedRecords) {
          return loadRelatedRecords(record);
        }
        
        return record;
      })
      .then(record => {
        isLoading = false;
        
        // 触发加载完成回调
        if (config.callbacks.onLoad) {
          config.callbacks.onLoad(record);
        }
        
        return record;
      })
      .catch(error => {
        isLoading = false;
        errorMessage = `加载溯源记录失败: ${error.message}`;
        
        if (config.callbacks.onError) {
          config.callbacks.onError(error);
        }
        
        throw error;
      });
  }
  
  /**
   * 刷新当前记录
   * @returns {Promise<Object>} 刷新后的记录
   */
  function refresh() {
    if (!currentRecord || !currentRecord.id) {
      return Promise.reject(new Error('没有当前记录可刷新'));
    }
    
    return load(currentRecord.id, { useCache: false });
  }
  
  /**
   * 获取当前记录
   * @returns {Object} 当前记录
   */
  function getRecord() {
    return currentRecord;
  }
  
  /**
   * 渲染记录详情到容器
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 渲染选项
   * @returns {HTMLElement} 渲染后的容器
   */
  function renderTo(container, options = {}) {
    if (!container) {
      throw new Error('容器元素不能为空');
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 如果正在加载，显示加载状态
    if (isLoading) {
      renderLoading(container);
      return container;
    }
    
    // 如果有错误消息，显示错误
    if (errorMessage) {
      renderError(container, errorMessage);
      return container;
    }
    
    // 如果没有记录，显示空状态
    if (!currentRecord) {
      renderEmpty(container, options.emptyMessage || '未找到溯源记录');
      return container;
    }
    
    // 创建详情容器
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'trace-record-details';
    
    // 添加操作按钮
    if (options.showActions !== false) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'trace-record-actions flex justify-end space-x-2 mb-4';
      
      // 添加各种操作按钮
      if (config.enableExport) {
        const exportButton = createActionButton('导出', 'file-export', () => {
          exportRecord();
        });
        actionsContainer.appendChild(exportButton);
      }
      
      if (config.enableShare) {
        const shareButton = createActionButton('分享', 'share-alt', () => {
          shareRecord();
        });
        actionsContainer.appendChild(shareButton);
      }
      
      if (config.enableVerify && !currentRecord.verified) {
        const verifyButton = createActionButton('验证', 'check-circle', () => {
          verify();
        });
        actionsContainer.appendChild(verifyButton);
      }
      
      const qrButton = createActionButton('二维码', 'qrcode', () => {
        generateQRCode();
      });
      actionsContainer.appendChild(qrButton);
      
      if (config.enableEdit) {
        const editButton = createActionButton('编辑', 'edit', () => {
          if (config.callbacks.onEdit) {
            config.callbacks.onEdit(currentRecord);
          }
        });
        actionsContainer.appendChild(editButton);
      }
      
      detailsContainer.appendChild(actionsContainer);
    }
    
    // 渲染记录详情
    const recordContainer = document.createElement('div');
    view.renderDetail(currentRecord, recordContainer, {
      showTimeline: true,
      timelineRecords: relatedRecords
    });
    detailsContainer.appendChild(recordContainer);
    
    // 如果有相关记录且配置显示相关记录
    if (config.showRelatedRecords && relatedRecords.length && options.showRelatedRecords !== false) {
      // 创建相关记录容器
      const relatedContainer = document.createElement('div');
      relatedContainer.className = 'trace-related-records mt-8';
      
      // 添加标题
      const relatedTitle = document.createElement('h2');
      relatedTitle.className = 'text-lg font-semibold mb-4';
      relatedTitle.textContent = '相关溯源记录';
      relatedContainer.appendChild(relatedTitle);
      
      // 过滤掉当前记录，并限制显示数量
      const filteredRecords = relatedRecords
        .filter(record => record.id !== currentRecord.id)
        .slice(0, config.maxRelatedRecords);
      
      // 创建相关记录列表
      const relatedList = document.createElement('div');
      view.renderList(filteredRecords, relatedList, {
        onItemClick: (record) => {
          // 加载选中的记录
          load(record.id).then(() => {
            // 重新渲染
            renderTo(container, options);
          });
        }
      });
      
      relatedContainer.appendChild(relatedList);
      detailsContainer.appendChild(relatedContainer);
    }
    
    container.appendChild(detailsContainer);
    return container;
  }
  
  /**
   * 验证记录
   * @returns {Promise<Object>} 验证后的记录
   */
  function verify() {
    if (!currentRecord) {
      return Promise.reject(new Error('没有当前记录可验证'));
    }
    
    if (currentRecord.verified) {
      return Promise.resolve(currentRecord);
    }
    
    return traceData.verifyRecord(currentRecord.id)
      .then(verifiedRecord => {
        currentRecord = verifiedRecord;
        
        if (config.callbacks.onVerify) {
          config.callbacks.onVerify(verifiedRecord);
        }
        
        return verifiedRecord;
      })
      .catch(error => {
        errorMessage = `验证记录失败: ${error.message}`;
        
        if (config.callbacks.onError) {
          config.callbacks.onError(error);
        }
        
        throw error;
      });
  }
  
  /**
   * 导出记录
   * @param {string} format - 导出格式 (pdf, json, csv)
   * @returns {Promise<string>} 导出文件的URL
   */
  function exportRecord(format = 'pdf') {
    if (!currentRecord) {
      return Promise.reject(new Error('没有当前记录可导出'));
    }
    
    return traceData.exportRecord(currentRecord.id, format)
      .then(exportUrl => {
        if (config.callbacks.onExport) {
          config.callbacks.onExport(exportUrl, format);
        }
        
        return exportUrl;
      })
      .catch(error => {
        errorMessage = `导出记录失败: ${error.message}`;
        
        if (config.callbacks.onError) {
          config.callbacks.onError(error);
        }
        
        throw error;
      });
  }
  
  /**
   * 分享记录
   * @param {string} method - 分享方式 (link, email, qrcode)
   * @returns {Promise<Object>} 分享结果
   */
  function shareRecord(method = 'link') {
    if (!currentRecord) {
      return Promise.reject(new Error('没有当前记录可分享'));
    }
    
    return traceData.shareRecord(currentRecord.id, method)
      .then(shareResult => {
        if (config.callbacks.onShare) {
          config.callbacks.onShare(shareResult, method);
        }
        
        return shareResult;
      })
      .catch(error => {
        errorMessage = `分享记录失败: ${error.message}`;
        
        if (config.callbacks.onError) {
          config.callbacks.onError(error);
        }
        
        throw error;
      });
  }
  
  /**
   * 生成记录二维码
   * @param {Object} options - 二维码选项
   * @returns {Promise<string>} 二维码图像的URL
   */
  function generateQRCode(options = {}) {
    if (!currentRecord) {
      return Promise.reject(new Error('没有当前记录可生成二维码'));
    }
    
    const qrOptions = {
      size: options.size || 200,
      includeProductInfo: options.includeProductInfo !== false,
      includeBatchInfo: options.includeBatchInfo !== false,
      ...options
    };
    
    return traceData.generateRecordQRCode(currentRecord.id, qrOptions)
      .then(qrCodeUrl => {
        // 可以在这里显示二维码图像或执行其他操作
        return qrCodeUrl;
      })
      .catch(error => {
        errorMessage = `生成二维码失败: ${error.message}`;
        
        if (config.callbacks.onError) {
          config.callbacks.onError(error);
        }
        
        throw error;
      });
  }
  
  /**
   * 获取相关记录
   * @returns {Array} 相关记录数组
   */
  function getRelatedRecords() {
    return relatedRecords;
  }
  
  /**
   * 加载相关记录
   * @param {Object} record - 当前记录
   * @returns {Promise<Object>} 当前记录
   * @private
   */
  function loadRelatedRecords(record) {
    if (!record || !record.id) {
      relatedRecords = [];
      return Promise.resolve(record);
    }
    
    // 使用产品ID或批次号加载相关记录
    const productId = record.productId;
    const batchNumber = record.batchNumber;
    
    if (!productId && !batchNumber) {
      relatedRecords = [];
      return Promise.resolve(record);
    }
    
    let promise;
    
    if (productId) {
      promise = traceData.getTraceRecordsByProduct(productId);
    } else {
      promise = traceData.getTraceRecordsByBatch(batchNumber);
    }
    
    return promise
      .then(records => {
        relatedRecords = records || [];
        return record;
      })
      .catch(error => {
        // 如果加载相关记录失败，不影响主记录的显示
        console.error('加载相关记录失败:', error);
        relatedRecords = [];
        return record;
      });
  }
  
  /**
   * 渲染加载状态
   * @param {HTMLElement} container - 容器元素
   * @private
   */
  function renderLoading(container) {
    container.innerHTML = `
      <div class="trace-loading flex flex-col items-center justify-center py-10">
        <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <div class="text-gray-500">正在加载溯源记录...</div>
      </div>
    `;
  }
  
  /**
   * 渲染错误状态
   * @param {HTMLElement} container - 容器元素
   * @param {string} message - 错误消息
   * @private
   */
  function renderError(container, message) {
    container.innerHTML = `
      <div class="trace-error flex flex-col items-center justify-center py-10">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
        </div>
        <div class="text-red-500 font-medium mb-2">加载失败</div>
        <div class="text-gray-500">${message}</div>
        <button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
          <i class="fas fa-redo mr-1"></i> 重试
        </button>
      </div>
    `;
    
    // 添加重试按钮事件
    const retryButton = container.querySelector('button');
    retryButton.addEventListener('click', () => {
      if (currentRecord && currentRecord.id) {
        load(currentRecord.id, { useCache: false })
          .then(() => renderTo(container));
      }
    });
  }
  
  /**
   * 渲染空状态
   * @param {HTMLElement} container - 容器元素
   * @param {string} message - 显示消息
   * @private
   */
  function renderEmpty(container, message) {
    container.innerHTML = `
      <div class="trace-empty flex flex-col items-center justify-center py-10">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i class="fas fa-search text-gray-400 text-xl"></i>
        </div>
        <div class="text-gray-500">${message}</div>
      </div>
    `;
  }
  
  /**
   * 创建操作按钮
   * @param {string} text - 按钮文本
   * @param {string} icon - 图标名称
   * @param {Function} onClick - 点击处理函数
   * @returns {HTMLElement} 按钮元素
   * @private
   */
  function createActionButton(text, icon, onClick) {
    const button = document.createElement('button');
    button.className = 'trace-action-button px-3 py-1.5 bg-[#00467F] text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center';
    button.innerHTML = `<i class="fas fa-${icon} mr-1"></i> ${text}`;
    button.addEventListener('click', onClick);
    return button;
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
      callbacks: { ...config.callbacks, ...(newConfig.callbacks || {}) }
    };
    
    return { ...config };
  }
  
  // 暴露公共API
  return {
    init
  };
})();

export default TraceRecordDetails; 