/**
 * @file 输入验证器
 * @description 提供输入净化和验证功能，防止XSS和注入攻击
 * @version 1.0.0
 * @created 2025-07-22
 */

// 为了实现完整的安全净化，在实际应用中应使用如DOMPurify这样的库
// 这里提供一个简化版实现用于演示

/**
 * 净化输入字符串，移除潜在的XSS攻击载荷
 * @param {string} input 需要净化的输入
 * @param {Object} options 净化选项
 * @param {boolean} options.allowSomeHtml 是否允许基本HTML标签
 * @returns {string} 净化后的字符串
 */
function sanitizeInput(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const { allowSomeHtml = true } = options;
  
  // 移除所有脚本标签
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 移除所有javascript:协议
  sanitized = sanitized.replace(/javascript:/gi, 'removed:');
  
  // 移除所有事件处理程序
  const eventHandlers = [
    'onabort', 'onblur', 'onchange', 'onclick', 'ondblclick', 'onerror', 'onfocus',
    'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmousemove',
    'onmouseout', 'onmouseover', 'onmouseup', 'onreset', 'onresize', 'onscroll',
    'onselect', 'onsubmit', 'onunload'
  ];
  
  eventHandlers.forEach(handler => {
    const regex = new RegExp(`\\s${handler}\\s*=\\s*["']?[^>"']*["']?`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // 如果不允许任何HTML，则完全移除所有标签
  if (!allowSomeHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    return sanitized;
  }
  
  // 允许的安全标签
  const allowedTags = [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li',
    'nl', 'ol', 'p', 'pre', 'span', 'strike', 'strong', 'table',
    'tbody', 'td', 'th', 'thead', 'tr', 'ul'
  ];
  
  // 允许的安全属性
  const allowedAttributes = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['class', 'id', 'style'],
    'span': ['class', 'id', 'style'],
    'table': ['class', 'id', 'style', 'width', 'cellspacing', 'cellpadding', 'border'],
    'th': ['scope', 'colspan', 'rowspan', 'style', 'class'],
    'td': ['colspan', 'rowspan', 'style', 'class'],
    '*': ['class', 'id'] // 所有标签通用的属性
  };
  
  // 这里是一个简单的HTML解析和过滤逻辑
  // 在生产环境中，应使用专业库如DOMPurify或sanitize-html
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitized;
    
    // 递归处理DOM树
    function processNode(node) {
      if (node.nodeType === 1) { // 元素节点
        const tagName = node.tagName.toLowerCase();
        
        // 如果标签不在允许列表中，使用其文本内容替换
        if (!allowedTags.includes(tagName)) {
          const text = node.textContent;
          const textNode = document.createTextNode(text);
          node.parentNode.replaceChild(textNode, node);
          return;
        }
        
        // 移除不允许的属性
        const attributes = [...node.attributes];
        attributes.forEach(attr => {
          const attrName = attr.name.toLowerCase();
          
          // 检查该标签的特定允许属性
          const tagAllowedAttrs = allowedAttributes[tagName] || [];
          // 检查所有标签通用的允许属性
          const commonAllowedAttrs = allowedAttributes['*'] || [];
          
          if (!tagAllowedAttrs.includes(attrName) && !commonAllowedAttrs.includes(attrName)) {
            node.removeAttribute(attr.name);
          }
          
          // 特殊处理a标签的href属性，确保不包含javascript:
          if (tagName === 'a' && attrName === 'href') {
            const value = attr.value.toLowerCase();
            if (value.startsWith('javascript:')) {
              node.setAttribute('href', '#');
            }
          }
          
          // 特殊处理target属性，只允许_blank, _self等
          if (attrName === 'target') {
            const validTargets = ['_blank', '_self', '_parent', '_top'];
            if (!validTargets.includes(attr.value)) {
              node.setAttribute('target', '_self');
            }
          }
        });
        
        // 处理子节点
        [...node.childNodes].forEach(child => processNode(child));
      }
    }
    
    // 处理DOM
    processNode(tempDiv);
    
    // 获取净化后的HTML
    return tempDiv.innerHTML;
  } catch (error) {
    console.error('HTML净化失败', error);
    // 如果处理失败，移除所有标签
    return input.replace(/<[^>]*>/g, '');
  }
}

/**
 * 使用JSON Schema验证输入数据
 * @param {Object} data 要验证的数据对象
 * @param {Object} schema JSON Schema对象
 * @returns {boolean} 验证是否通过
 */
function validateSchemaInput(data, schema) {
  // 在实际项目中应使用完整的JSON Schema验证库如AJV
  // 这里提供一个简化的实现
  try {
    // 检查数据类型
    if (schema.type && typeof data !== schema.type) {
      if (!(schema.type === 'object' && data && typeof data === 'object')) {
        return false;
      }
    }
    
    // 检查必需字段
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined) {
          return false;
        }
      }
    }
    
    // 检查属性
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const value = data[propName];
        
        // 如果值不存在且不是必需的，则跳过
        if (value === undefined) {
          continue;
        }
        
        // 验证类型
        if (propSchema.type) {
          if (propSchema.type === 'string' && typeof value !== 'string') {
            return false;
          } else if (propSchema.type === 'number' && typeof value !== 'number') {
            return false;
          } else if (propSchema.type === 'integer' && (!Number.isInteger(value))) {
            return false;
          } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
            return false;
          } else if (propSchema.type === 'array' && !Array.isArray(value)) {
            return false;
          } else if (propSchema.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) {
            return false;
          }
        }
        
        // 验证字符串特定规则
        if (propSchema.type === 'string' && typeof value === 'string') {
          // 最小长度
          if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
            return false;
          }
          
          // 最大长度
          if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
            return false;
          }
          
          // 正则模式
          if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
            return false;
          }
          
          // 格式验证
          if (propSchema.format === 'date') {
            // 简单的ISO日期格式验证 (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              return false;
            }
            
            // 验证日期有效性
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              return false;
            }
          }
          
          // 枚举值
          if (propSchema.enum && Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
            return false;
          }
        }
        
        // 递归验证对象属性
        if (propSchema.type === 'object' && propSchema.properties && value) {
          if (!validateSchemaInput(value, propSchema)) {
            return false;
          }
        }
        
        // 验证数组
        if (propSchema.type === 'array' && Array.isArray(value)) {
          // 验证数组项
          if (propSchema.items) {
            for (const item of value) {
              if (!validateSchemaInput(item, propSchema.items)) {
                return false;
              }
            }
          }
          
          // 验证最小项目数
          if (propSchema.minItems !== undefined && value.length < propSchema.minItems) {
            return false;
          }
          
          // 验证最大项目数
          if (propSchema.maxItems !== undefined && value.length > propSchema.maxItems) {
            return false;
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Schema验证失败', error);
    return false;
  }
}

module.exports = {
  sanitizeInput,
  validateSchemaInput
}; 