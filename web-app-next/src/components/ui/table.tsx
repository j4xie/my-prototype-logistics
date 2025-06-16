'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface TableColumn<T = any> {
  key: string;
  title: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
  responsive?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onRowClick?: (record: T, index: number) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

export function Table<T = any>({
  columns,
  data,
  loading = false,
  emptyText = '暂无数据',
  className,
  responsive = true,
  striped = true,
  hoverable = true,
  size = 'md',
  onRowClick,
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: 'asc',
  });

  // 排序处理
  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 排序数据
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a: any, b: any) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

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
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const paddingClasses = {
    sm: 'px-2 py-1',
    md: 'px-3 py-2',
    lg: 'px-4 py-3',
  };

  // 基础表格样式
  const tableClasses = cn(
    'w-full bg-white rounded-lg shadow-sm overflow-hidden',
    sizeClasses[size],
    className
  );

  // 加载状态
  if (loading) {
    return (
      <div className={tableClasses}>
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
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
      {sortedData.map((row: any, index) => (
        <div
          key={index}
          className={cn(
            'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
            onRowClick && 'cursor-pointer transition-shadow hover:shadow-md'
          )}
          onClick={() => onRowClick?.(row, index)}
        >
          {columns.map(column => (
            <div
              key={column.key}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm font-medium text-gray-600">
                {column.title}
              </span>
              <span className="text-sm text-gray-900">
                {column.render
                  ? column.render(row[column.key], row, index)
                  : row[column.key]}
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
      <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn(
                  'text-left font-medium text-gray-700',
                  paddingClasses[size],
                  column.sortable &&
                    'cursor-pointer select-none hover:bg-gray-100',
                  {
                    'text-center': column.align === 'center',
                    'text-right': column.align === 'right',
                  }
                )}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.title}</span>
                  {column.sortable && (
                    <div className="flex flex-col">
                      <svg
                        className={cn(
                          'h-3 w-3 transition-colors',
                          sortConfig.key === column.key &&
                            sortConfig.direction === 'asc'
                            ? 'text-[#1890FF]'
                            : 'text-gray-400'
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                      </svg>
                      <svg
                        className={cn(
                          '-mt-1 h-3 w-3 transition-colors',
                          sortConfig.key === column.key &&
                            sortConfig.direction === 'desc'
                            ? 'text-[#1890FF]'
                            : 'text-gray-400'
                        )}
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
          {sortedData.map((row: any, index) => (
            <tr
              key={index}
              className={cn(
                'transition-colors',
                striped && index % 2 === 1 && 'bg-gray-50',
                hoverable && 'hover:bg-gray-100',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row, index)}
            >
              {columns.map(column => (
                <td
                  key={column.key}
                  className={cn('text-gray-900', paddingClasses[size], {
                    'text-center': column.align === 'center',
                    'text-right': column.align === 'right',
                  })}
                >
                  {column.render
                    ? column.render(row[column.key], row, index)
                    : row[column.key]}
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
}
