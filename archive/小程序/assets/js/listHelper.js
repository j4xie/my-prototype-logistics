/*
 * 列表操作助手 - 溯源商城高保真原型系统
 * 提供排序、筛选、分页等功能
 */

class ListHelper {
  /**
   * 排序数据
   * @param {Array} data - 原始数据
   * @param {string} sortBy - 排序字段
   * @param {string} order - 排序方向 ('asc' | 'desc')
   * @returns {Array} 排序后的数据
   */
  static sort(data, sortBy, order = 'asc') {
    if (!data || !sortBy) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // 处理嵌套属性（如 'price.base'）
      if (sortBy.includes('.')) {
        const keys = sortBy.split('.');
        aVal = keys.reduce((obj, key) => obj?.[key], a);
        bVal = keys.reduce((obj, key) => obj?.[key], b);
      }

      // 处理null和undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // 字符串比较
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'zh-CN');
        return order === 'asc' ? comparison : -comparison;
      }

      // 数字比较
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * 筛选数据
   * @param {Array} data - 原始数据
   * @param {Object} filters - 筛选条件 {field: value}
   * @returns {Array} 筛选后的数据
   */
  static filter(data, filters) {
    if (!data || !filters) return data;

    return data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        // 跳过空值
        if (value === null || value === '' || value === undefined) continue;

        // 获取字段值
        let itemValue = item[key];

        // 处理嵌套属性
        if (key.includes('.')) {
          const keys = key.split('.');
          itemValue = keys.reduce((obj, k) => obj?.[k], item);
        }

        // 字符串模糊匹配
        if (typeof value === 'string' && typeof itemValue === 'string') {
          if (!itemValue.toLowerCase().includes(value.toLowerCase())) {
            return false;
          }
        }
        // 数组包含检查
        else if (Array.isArray(value)) {
          if (!value.includes(itemValue)) {
            return false;
          }
        }
        // 精确匹配
        else {
          if (itemValue !== value) {
            return false;
          }
        }
      }
      return true;
    });
  }

  /**
   * 分页
   * @param {Array} data - 原始数据
   * @param {number} page - 当前页码（从1开始）
   * @param {number} pageSize - 每页条数
   * @returns {Object} 分页结果
   */
  static paginate(data, page, pageSize) {
    if (!data) return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };

    const total = data.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: data.slice(start, end),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: end < total
    };
  }

  /**
   * 组合操作：筛选 + 排序 + 分页
   * @param {Array} data - 原始数据
   * @param {Object} options - 选项
   * @returns {Object} 处理后的结果
   */
  static process(data, options = {}) {
    const {
      filters = {},
      sortBy = null,
      order = 'asc',
      page = 1,
      pageSize = 10
    } = options;

    // 筛选
    let result = this.filter(data, filters);

    // 排序
    if (sortBy) {
      result = this.sort(result, sortBy, order);
    }

    // 分页
    const paginated = this.paginate(result, page, pageSize);

    return {
      ...paginated,
      filters,
      sortBy,
      order
    };
  }

  /**
   * 搜索（多字段模糊匹配）
   * @param {Array} data - 原始数据
   * @param {string} keyword - 搜索关键词
   * @param {Array} searchFields - 搜索字段列表
   * @returns {Array} 搜索结果
   */
  static search(data, keyword, searchFields = []) {
    if (!keyword || !data) return data;

    const lowerKeyword = keyword.toLowerCase();

    return data.filter(item => {
      // 如果指定了搜索字段，只在这些字段中搜索
      if (searchFields.length > 0) {
        return searchFields.some(field => {
          let value = item[field];

          // 处理嵌套属性
          if (field.includes('.')) {
            const keys = field.split('.');
            value = keys.reduce((obj, key) => obj?.[key], item);
          }

          return value && String(value).toLowerCase().includes(lowerKeyword);
        });
      }

      // 否则在所有字符串字段中搜索
      return Object.values(item).some(value => {
        return value && typeof value === 'string' && value.toLowerCase().includes(lowerKeyword);
      });
    });
  }

  /**
   * 分组
   * @param {Array} data - 原始数据
   * @param {string} groupBy - 分组字段
   * @returns {Object} 分组结果 {groupValue: [items]}
   */
  static groupBy(data, groupBy) {
    if (!data || !groupBy) return {};

    return data.reduce((groups, item) => {
      let key = item[groupBy];

      // 处理嵌套属性
      if (groupBy.includes('.')) {
        const keys = groupBy.split('.');
        key = keys.reduce((obj, k) => obj?.[k], item);
      }

      // 默认分组键
      if (key === null || key === undefined) {
        key = '未分组';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);

      return groups;
    }, {});
  }

  /**
   * 统计
   * @param {Array} data - 原始数据
   * @param {string} field - 统计字段
   * @returns {Object} 统计结果
   */
  static aggregate(data, field) {
    if (!data || !field) return {};

    const values = data.map(item => {
      let value = item[field];

      // 处理嵌套属性
      if (field.includes('.')) {
        const keys = field.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      return typeof value === 'number' ? value : 0;
    });

    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;
    const avg = count > 0 ? sum / count : 0;
    const max = count > 0 ? Math.max(...values) : 0;
    const min = count > 0 ? Math.min(...values) : 0;

    return { sum, count, avg, max, min };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ListHelper;
}
