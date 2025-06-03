'use client';

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';

// TypeScript接口定义
export interface MobileSearchProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'onFocus' | 'onBlur'
  > {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  suggestions?: string[];
  showSuggestions?: boolean;
  onSuggestionSelect?: (suggestion: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showCancelButton?: boolean;
  showSearchHistory?: boolean;
  searchHistory?: string[];
  onClearHistory?: () => void;
  maxSuggestions?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export interface QuickSearchBarProps {
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 移动端搜索组件
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 * 支持搜索建议、搜索历史、触摸优化和完整的可访问性
 */
export const MobileSearch = forwardRef<HTMLInputElement, MobileSearchProps>(
  (
    {
      placeholder = '搜索...',
      value = '',
      onChange,
      onSearch,
      onFocus,
      onBlur,
      suggestions = [],
      showSuggestions = false,
      onSuggestionSelect,
      className = '',
      disabled = false,
      autoFocus = false,
      showCancelButton = true,
      showSearchHistory = true,
      searchHistory = [],
      onClearHistory,
      maxSuggestions = 8,
      ariaLabel = '搜索',
      ariaDescribedBy = '',
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const internalRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 使用传入的ref或内部ref
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus, inputRef]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      setIsExpanded(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // 延迟处理，允许点击建议项
      setTimeout(() => {
        setIsFocused(false);
        if (!localValue) {
          setIsExpanded(false);
        }
        onBlur?.(e);
      }, 150);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange?.(newValue);
    };

    const handleSearch = () => {
      if (onSearch) {
        onSearch(localValue);
      }
      inputRef.current?.blur();
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 支持键盘导航
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // 可以添加建议列表导航逻辑
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // 可以添加建议列表导航逻辑
      }
    };

    const handleClearKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClearInput();
      }
    };

    const handleCancel = () => {
      setLocalValue('');
      setIsExpanded(false);
      setIsFocused(false);
      onChange?.('');
      inputRef.current?.blur();
    };

    const handleSuggestionClick = (suggestion: string) => {
      setLocalValue(suggestion);
      onChange?.(suggestion);
      onSuggestionSelect?.(suggestion);
      onSearch?.(suggestion);
      setIsExpanded(false);
      inputRef.current?.blur();
    };

    const handleClearInput = () => {
      setLocalValue('');
      onChange?.('');
      inputRef.current?.focus();
    };

    // 过滤和限制建议数量
    const filteredSuggestions = suggestions
      .filter(
        suggestion =>
          suggestion.toLowerCase().includes(localValue.toLowerCase()) &&
          suggestion.toLowerCase() !== localValue.toLowerCase()
      )
      .slice(0, maxSuggestions);

    // 过滤搜索历史
    const filteredHistory = searchHistory
      .filter(
        item =>
          item.toLowerCase().includes(localValue.toLowerCase()) &&
          item.toLowerCase() !== localValue.toLowerCase()
      )
      .slice(0, 5);

    const containerClasses = cn(
      'mobile-search-container max-w-[390px] mx-auto',
      isExpanded && 'expanded',
      className
    );

    return (
      <div
        className={containerClasses}
        ref={containerRef}
        role="search"
        aria-label={ariaLabel}
      >
        {/* 搜索输入框 */}
        <div
          className={cn(
            'flex items-center rounded-lg border bg-white shadow-sm transition-all duration-200',
            isFocused ? 'border-[#1890FF] shadow-md' : 'border-gray-200',
            disabled && 'opacity-50'
          )}
        >
          {/* 搜索图标 */}
          <div className="pr-2 pl-3" aria-hidden="true">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* 输入框 - 支持触摸交互 */}
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={
              isExpanded &&
              (filteredSuggestions.length > 0 || filteredHistory.length > 0)
            }
            aria-autocomplete="list"
            aria-describedby={ariaDescribedBy}
            aria-controls="search-suggestions"
            role="combobox"
            className={cn(
              'flex-1 border-none bg-transparent py-3 text-sm text-gray-900 placeholder-gray-500 outline-none',
              'focus:ring-0 focus:outline-none'
            )}
            style={{
              fontSize: '16px', // 防止iOS缩放
            }}
            {...props}
          />

          {/* 清除按钮 */}
          {localValue && (
            <button
              type="button"
              onClick={handleClearInput}
              onKeyDown={handleClearKeyDown}
              aria-label="清除搜索内容"
              className={cn(
                'mr-1 rounded p-2 transition-colors duration-200',
                'focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-1 focus:outline-none',
                'hover:bg-gray-100 active:bg-gray-200'
              )}
              tabIndex={0}
            >
              <svg
                className="h-4 w-4 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* 取消按钮 */}
          {showCancelButton && isExpanded && (
            <button
              type="button"
              onClick={handleCancel}
              className={cn(
                'rounded px-3 py-2 text-sm font-medium text-[#1890FF] transition-colors duration-200',
                'hover:bg-blue-50 active:bg-blue-100',
                'focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-1 focus:outline-none'
              )}
            >
              取消
            </button>
          )}
        </div>

        {/* 建议列表和搜索历史 */}
        {isExpanded && (isFocused || localValue) && (
          <div
            id="search-suggestions"
            className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            role="listbox"
          >
            {/* 搜索建议 */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="px-4 py-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
                  搜索建议
                </div>
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={`suggestion-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'flex w-full items-center px-4 py-3 text-left transition-colors duration-200',
                      'hover:bg-gray-50 focus:bg-gray-50 active:bg-gray-100',
                      'focus:ring-2 focus:ring-[#1890FF] focus:outline-none focus:ring-inset'
                    )}
                    role="option"
                    aria-selected={false}
                  >
                    <svg
                      className="mr-3 h-4 w-4 flex-shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="truncate text-sm text-gray-900">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 搜索历史 */}
            {showSearchHistory && filteredHistory.length > 0 && (
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <span className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                    搜索历史
                  </span>
                  {onClearHistory && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className={cn(
                        'rounded px-2 py-1 text-xs text-[#1890FF] transition-colors duration-200',
                        'hover:bg-blue-50 active:bg-blue-100',
                        'focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-1 focus:outline-none'
                      )}
                    >
                      清除
                    </button>
                  )}
                </div>
                {filteredHistory.map((item, index) => (
                  <button
                    key={`history-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(item)}
                    className={cn(
                      'flex w-full items-center px-4 py-3 text-left transition-colors duration-200',
                      'hover:bg-gray-50 focus:bg-gray-50 active:bg-gray-100',
                      'focus:ring-2 focus:ring-[#1890FF] focus:outline-none focus:ring-inset'
                    )}
                    role="option"
                    aria-selected={false}
                  >
                    <svg
                      className="mr-3 h-4 w-4 flex-shrink-0 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="truncate text-sm text-gray-900">
                      {item}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 无结果提示 */}
            {localValue &&
              filteredSuggestions.length === 0 &&
              filteredHistory.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  <svg
                    className="mx-auto mb-2 h-8 w-8 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm">暂无搜索结果</p>
                </div>
              )}
          </div>
        )}
      </div>
    );
  }
);

MobileSearch.displayName = 'MobileSearch';

/**
 * 快速搜索栏组件
 * 适用于页面顶部的快速搜索
 */
export const QuickSearchBar: React.FC<QuickSearchBarProps> = ({
  onSearch,
  placeholder = '快速搜索',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  if (isExpanded) {
    return (
      <MobileSearch
        placeholder={placeholder}
        onSearch={onSearch}
        onBlur={handleCollapse}
        autoFocus={true}
        className={className}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleExpand}
      className={cn(
        'mx-auto flex w-full max-w-[390px] items-center rounded-lg bg-gray-100 px-3 py-2 transition-colors duration-200',
        'hover:bg-gray-200 active:bg-gray-300',
        'focus:ring-2 focus:ring-[#1890FF] focus:ring-offset-2 focus:outline-none',
        className
      )}
      aria-label={`展开搜索框: ${placeholder}`}
    >
      <svg
        className="mr-2 h-4 w-4 flex-shrink-0 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span className="truncate text-sm text-gray-500">{placeholder}</span>
    </button>
  );
};

QuickSearchBar.displayName = 'QuickSearchBar';

export default MobileSearch;
