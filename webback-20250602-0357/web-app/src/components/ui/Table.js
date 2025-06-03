import React, { useState } from 'react';

/**
 * Table组件 - 响应式数据表格
 * 支持移动端适配，小屏幕时转换为卡片布局
 */
const Table = ({
  columns = [],
  data = [],
  loading = false,
  emptyText = '暂无数据',
  className = '',
  responsive = true,
  striped = true,
  hoverable = true,
  size = 'default', // 'small', 'default', 'large'
  onRowClick,
  ...props
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // 排序处理
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 排序数据
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  // 尺寸样式
  const sizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg'
  };

  const paddingClasses = {
    small: 'px-2 py-1',
    default: 'px-3 py-2',
    large: 'px-4 py-3'
  };

  // 基础表格样式
  const tableClasses = [
    'w-full',
    'bg-white',
    'rounded-lg',
    'shadow-sm',
    'overflow-hidden',
    sizeClasses[size],
    className
  ].join(' ');

  // 加载状态
  if (loading) {
    return (
      <div className={tableClasses}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1890FF]"></div>
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      </div>
    );
  }

  // 空数据状态
  if (!data || data.length === 0) {
    return (
      <div className={tableClasses}>
        <div className="flex items-center justify-center py-8 text-gray-500">
          {emptyText}
        </div>
      </div>
    );
  }

  // 移动端卡片布局
  const MobileCardLayout = () => (
    <div className="space-y-4">
      {sortedData.map((row, index) => (
        <div
          key={index}
          className={`
            bg-white rounded-lg shadow-sm border border-gray-200 p-4
            ${onRowClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
          `}
          onClick={() => onRowClick && onRowClick(row, index)}
        >
          {columns.map((column) => (
            <div key={column.key} className="flex justify-between items-center py-1">
              <span className="text-sm font-medium text-gray-600">
                {column.title}
              </span>
              <span className="text-sm text-gray-900">
                {column.render 
                  ? column.render(row[column.key], row, index)
                  : row[column.key]
                }
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // 桌面端表格布局
  const DesktopTableLayout = () => (
    <div className="overflow-x-auto">
      <table className="w-full" {...props}>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  text-left font-medium text-gray-700
                  ${paddingClasses[size]}
                  ${column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
                  ${column.width ? `w-${column.width}` : ''}
                `}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.title}</span>
                  {column.sortable && (
                    <div className="flex flex-col">
                      <svg
                        className={`w-3 h-3 ${
                          sortConfig.key === column.key && sortConfig.direction === 'asc'
                            ? 'text-[#1890FF]'
                            : 'text-gray-400'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedData.map((row, index) => (
            <tr
              key={index}
              className={`
                ${striped && index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}
                ${hoverable ? 'hover:bg-gray-100' : ''}
                ${onRowClick ? 'cursor-pointer' : ''}
                transition-colors
              `}
              onClick={() => onRowClick && onRowClick(row, index)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`
                    text-gray-900 ${paddingClasses[size]}
                    ${column.align === 'center' ? 'text-center' : ''}
                    ${column.align === 'right' ? 'text-right' : ''}
                  `}
                >
                  {column.render 
                    ? column.render(row[column.key], row, index)
                    : row[column.key]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={tableClasses}>
      {responsive ? (
        <>
          {/* 移动端显示卡片布局 */}
          <div className="block md:hidden">
            <MobileCardLayout />
          </div>
          {/* 桌面端显示表格布局 */}
          <div className="hidden md:block">
            <DesktopTableLayout />
          </div>
        </>
      ) : (
        <DesktopTableLayout />
      )}
    </div>
  );
};

export default Table; 