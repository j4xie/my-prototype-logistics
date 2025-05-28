import React, { useState } from 'react';

/**
 * 标准化的Select下拉选择组件
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.label - 标签文本
 * @param {string} props.value - 当前选中值
 * @param {Function} props.onChange - 值变化回调
 * @param {Array} props.options - 选项数组 [{value, label}]
 * @param {string} props.placeholder - 占位符文本
 * @param {boolean} props.required - 是否必填
 * @param {boolean} props.disabled - 是否禁用
 * @param {string} props.error - 错误信息
 * @param {string} props.size - 尺寸 ('sm', 'md', 'lg')
 * @param {string} props.className - 额外的CSS类名
 * @param {string} props.id - 组件ID
 */
const Select = ({
  label,
  value = '',
  onChange,
  options = [],
  placeholder = '请选择...',
  required = false,
  disabled = false,
  error = '',
  size = 'md',
  className = '',
  id,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // 尺寸样式映射
  const sizeClasses = {
    sm: 'h-8 text-sm px-2',
    md: 'h-10 text-base px-3',
    lg: 'h-12 text-lg px-4'
  };

  // 基础样式
  const baseClasses = `
    w-full border rounded-lg transition-all duration-200 
    focus:outline-none focus:ring-2 focus:ring-[#1890FF] focus:border-[#1890FF]
    ${sizeClasses[size]}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}
    ${error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'}
    ${className}
  `;

  // 获取选中选项的标签
  const selectedOption = options.find(option => option.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  // 处理选择
  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  // 键盘导航
  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          handleSelect(options[focusedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
        }
        break;
    }
  };

  return (
    <div className="relative">
      {/* 标签 */}
      {label && (
        <label 
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* 选择框 */}
      <div className="relative">
        <div
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          tabIndex={disabled ? -1 : 0}
          className={baseClasses}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          {...props}
        >
          <span className={`block truncate ${!selectedOption ? 'text-gray-500' : 'text-gray-900'}`}>
            {displayText}
          </span>
          
          {/* 下拉箭头 */}
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>

        {/* 下拉选项 */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            <ul role="listbox" className="py-1">
              {options.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={`
                    px-3 py-2 cursor-pointer transition-colors duration-150
                    ${option.value === value ? 'bg-[#1890FF] text-white' : 'text-gray-900'}
                    ${index === focusedIndex ? 'bg-gray-100' : ''}
                    ${option.value === value && index === focusedIndex ? 'bg-[#1890FF]' : ''}
                    hover:bg-gray-100
                  `}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 错误信息 */}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default Select; 