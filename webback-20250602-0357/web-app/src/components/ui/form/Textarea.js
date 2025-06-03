import React, { forwardRef } from 'react';

/**
 * Textarea组件 - 符合Neo Minimal iOS-Style Admin UI设计规范
 * 支持响应式设计和移动端适配
 */
const Textarea = forwardRef(({
  label,
  placeholder = '',
  value = '',
  onChange,
  onBlur,
  onFocus,
  error,
  disabled = false,
  required = false,
  rows = 4,
  maxLength,
  className = '',
  id,
  name,
  autoFocus = false,
  resize = 'vertical', // 'none', 'vertical', 'horizontal', 'both'
  ...props
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseClasses = [
    'w-full',
    'px-3 py-2',
    'text-base',
    'border border-gray-300',
    'rounded-lg',
    'bg-white',
    'text-gray-900',
    'placeholder-gray-500',
    'transition-all duration-200',
    'focus:outline-none',
    'focus:ring-2 focus:ring-[#1890FF] focus:border-[#1890FF]',
    // 移动端优化
    'touch-manipulation',
    'text-base', // 防止iOS缩放
    // 响应式字体大小
    'sm:text-sm',
  ];

  // 错误状态样式
  if (error) {
    baseClasses.push(
      'border-[#FF4D4F]',
      'focus:ring-[#FF4D4F]',
      'focus:border-[#FF4D4F]'
    );
  }

  // 禁用状态样式
  if (disabled) {
    baseClasses.push(
      'bg-gray-50',
      'text-gray-400',
      'cursor-not-allowed',
      'border-gray-200'
    );
  }

  // 调整大小样式
  const resizeClasses = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  };

  baseClasses.push(resizeClasses[resize] || 'resize-y');

  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }
  };

  const handleFocus = (e) => {
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label 
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-[#FF4D4F] ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className={baseClasses.join(' ')}
          {...props}
        />
        
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {value.length}/{maxLength}
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-[#FF4D4F]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea; 