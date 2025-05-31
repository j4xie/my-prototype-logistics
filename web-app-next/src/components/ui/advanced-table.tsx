'use client';

import React from 'react';
import { Table, TableColumn } from './table';

interface AdvancedTableColumn extends TableColumn {
  sortable?: boolean;
  filterable?: boolean;
}

interface AdvancedTableProps {
  columns: AdvancedTableColumn[];
  data: Record<string, any>[];
  searchable?: boolean;
  pagination?: boolean;
  pageSize?: number;
}

export const AdvancedTable: React.FC<AdvancedTableProps> = ({
  columns,
  data,
  searchable = false,
  pagination = false,
  pageSize = 10
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortConfig, setSortConfig] = React.useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // 搜索过滤
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  // 排序
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredData, sortConfig]);

  // 分页
  const paginatedData = React.useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // 处理排序点击
  const handleSort = (columnKey: string) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 增强列配置，添加排序指示器
  const enhancedColumns: TableColumn[] = columns.map(col => ({
    ...col,
    sortable: col.sortable,
    render: col.render || ((value) => {
      // 如果有排序功能，在表头显示排序指示器
      if (col.sortable && sortConfig.key === col.key) {
        return (
          <div className="flex items-center justify-between">
            <span>{value}</span>
            <span className="text-xs text-blue-600">
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </span>
          </div>
        );
      }
      return value;
    })
  }));

  // 处理行点击以实现排序
  const handleRowClick = React.useCallback(() => {
    // 这里可以添加行点击逻辑
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      {/* 搜索框 */}
      {searchable && (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="搜索数据..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="搜索表格数据"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-2 py-2 text-gray-500 hover:text-gray-700"
              aria-label="清除搜索"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 排序控制 */}
      {columns.some(col => col.sortable) && (
        <div className="flex flex-wrap gap-2">
          {columns.filter(col => col.sortable).map(col => (
            <button
              key={col.key}
              onClick={() => handleSort(col.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                sortConfig.key === col.key
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
              aria-label={`按 ${col.title} 排序`}
            >
              {col.title} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>
      )}

      {/* 数据统计 */}
      <div className="text-sm text-gray-600">
        {searchTerm && (
          <span>搜索结果：{filteredData.length} 项 / </span>
        )}
        总计：{data.length} 项数据
      </div>

      {/* 表格 */}
      <Table
        columns={enhancedColumns}
        data={paginatedData}
        striped={true}
        hoverable={true}
        size="md"
        onRowClick={handleRowClick}
      />

      {/* 分页 */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedData.length)} 项，
            共 {sortedData.length} 项
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="上一页"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm bg-gray-100 rounded">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="下一页"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 