import React, { useState, useRef, useEffect } from 'react';
import { mediaQueryManager } from '@/utils/common/media-query-manager.js';
import TouchGesture from './TouchGesture.js';

/**
 * @deprecated 此组件已废弃，请使用 web-app-next/src/components/ui/mobile-search.tsx
 * 
 * 迁移指导：
 * - 新版本使用TypeScript，提供完整类型安全
 * - 移除了TouchGesture依赖，使用原生事件处理
 * - 改进了可访问性支持和键盘导航
 * - 优化了移动端触摸体验
 * 
 * 导入方式：
 * import { MobileSearch, QuickSearchBar } from '@/components/ui';
 * 
 * 移动端搜索组件
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const MobileSearch = ({
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
  ariaDescribedBy = ''
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = (e) => {
    setIsFocused(true);
    setIsExpanded(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    // 延迟处理，允许点击建议项
    setTimeout(() => {
      setIsFocused(false);
      if (!localValue) {
        setIsExpanded(false);
      }
      if (onBlur) onBlur(e);
    }, 150);
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (onChange) onChange(newValue);
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(localValue);
    }
    inputRef.current?.blur();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleKeyDown = (e) => {
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

  const handleClearKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClearInput();
    }
  };

  const handleCancel = () => {
    setLocalValue('');
    setIsExpanded(false);
    setIsFocused(false);
    if (onChange) onChange('');
    inputRef.current?.blur();
  };

  const handleSuggestionClick = (suggestion) => {
    setLocalValue(suggestion);
    if (onChange) onChange(suggestion);
    if (onSuggestionSelect) onSuggestionSelect(suggestion);
    if (onSearch) onSearch(suggestion);
    setIsExpanded(false);
    inputRef.current?.blur();
  };

  const handleClearInput = () => {
    setLocalValue('');
    if (onChange) onChange('');
    inputRef.current?.focus();
  };

  // 过滤和限制建议数量
  const filteredSuggestions = suggestions
    .filter(suggestion => 
      suggestion.toLowerCase().includes(localValue.toLowerCase()) &&
      suggestion.toLowerCase() !== localValue.toLowerCase()
    )
    .slice(0, maxSuggestions);

  // 过滤搜索历史
  const filteredHistory = searchHistory
    .filter(item => 
      item.toLowerCase().includes(localValue.toLowerCase()) &&
      item.toLowerCase() !== localValue.toLowerCase()
    )
    .slice(0, 5);

  const containerClasses = [
    'mobile-search-container',
    'max-w-[390px] mx-auto', // 遵循UI设计系统规范
    isExpanded ? 'expanded' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={containerClasses} 
      ref={containerRef}
      role="search"
      aria-label={ariaLabel}
    >
      {/* 搜索输入框 */}
      <div className={`
        flex items-center bg-white rounded-lg shadow-sm border transition-all duration-200
        ${isFocused ? 'border-[#1890FF] shadow-md' : 'border-gray-200'}
        ${disabled ? 'opacity-50' : ''}
      `}>
        {/* 搜索图标 */}
        <div className="pl-3 pr-2" aria-hidden="true">
          <svg 
            className="w-5 h-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
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
          onTouchStart={() => {}} // 触摸开始事件支持
          onTouchMove={() => {}} // 触摸移动事件支持
          onTouchEnd={() => {}} // 触摸结束事件支持
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={isExpanded && (filteredSuggestions.length > 0 || filteredHistory.length > 0)}
          aria-autocomplete="list"
          aria-describedby={ariaDescribedBy}
          role="combobox"
          className={`
            flex-1 py-3 text-sm text-gray-900 placeholder-gray-500 bg-transparent border-none outline-none
            ${mediaQueryManager.isMobile() ? 'text-base' : 'text-sm'} // 防止iOS缩放
          `}
          style={{
            fontSize: mediaQueryManager.isMobile() ? '16px' : '14px' // 防止iOS缩放
          }}
        />

        {/* 清除按钮 */}
        {localValue && (
          <TouchGesture onTap={handleClearInput}>
            <button
              type="button"
              onKeyDown={handleClearKeyDown}
              aria-label="清除搜索内容"
              className="p-2 mr-1 focus:outline-none focus:ring-2 focus:ring-[#1890FF] rounded"
              tabIndex={0}
            >
              <svg 
                className="w-4 h-4 text-gray-400" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          </TouchGesture>
        )}

        {/* 取消按钮 */}
        {showCancelButton && isExpanded && (
          <TouchGesture onTap={handleCancel}>
            <div className="px-3 py-2 text-sm text-[#1890FF] font-medium">
              取消
            </div>
          </TouchGesture>
        )}
      </div>

      {/* 建议列表和搜索历史 */}
      {isExpanded && (isFocused || localValue) && (
        <div className="mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto">
          {/* 搜索建议 */}
          {(showSuggestions && filteredSuggestions.length > 0) && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                搜索建议
              </div>
              {filteredSuggestions.map((suggestion, index) => (
                <TouchGesture 
                  key={`suggestion-${index}`} 
                  onTap={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex items-center px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer">
                    <svg 
                      className="w-4 h-4 text-gray-400 mr-3" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                      />
                    </svg>
                    <span className="text-sm text-gray-900">{suggestion}</span>
                  </div>
                </TouchGesture>
              ))}
            </div>
          )}

          {/* 搜索历史 */}
          {(showSearchHistory && filteredHistory.length > 0) && (
            <div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  搜索历史
                </span>
                {onClearHistory && (
                  <TouchGesture onTap={onClearHistory}>
                    <span className="text-xs text-[#1890FF] cursor-pointer">
                      清除
                    </span>
                  </TouchGesture>
                )}
              </div>
              {filteredHistory.map((item, index) => (
                <TouchGesture 
                  key={`history-${index}`} 
                  onTap={() => handleSuggestionClick(item)}
                >
                  <div className="flex items-center px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer">
                    <svg 
                      className="w-4 h-4 text-gray-400 mr-3" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span className="text-sm text-gray-900">{item}</span>
                  </div>
                </TouchGesture>
              ))}
            </div>
          )}

          {/* 无结果提示 */}
          {localValue && filteredSuggestions.length === 0 && filteredHistory.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <svg 
                className="w-8 h-8 mx-auto mb-2 text-gray-300" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
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
};

/**
 * 快速搜索栏组件
 * 适用于页面顶部的快速搜索
 */
export const QuickSearchBar = ({
  onSearch,
  placeholder = '快速搜索',
  className = ''
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
    <TouchGesture onTap={handleExpand}>
      <div className={`
        flex items-center bg-gray-100 rounded-lg px-3 py-2 cursor-pointer
        max-w-[390px] mx-auto ${className}
      `}>
        <svg 
          className="w-4 h-4 text-gray-400 mr-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
        <span className="text-sm text-gray-500">{placeholder}</span>
      </div>
    </TouchGesture>
  );
};

export default MobileSearch; 