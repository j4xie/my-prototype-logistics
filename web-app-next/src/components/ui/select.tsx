'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  options = [],
  placeholder = '请选择...',
  required = false,
  disabled = false,
  error = '',
  helperText = '',
  size = 'md',
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState(value || defaultValue || '');
  const selectRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  // 同步外部value
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 尺寸样式
  const sizeClasses = {
    sm: 'h-8 text-sm px-2',
    md: 'h-10 text-base px-3',
    lg: 'h-12 text-lg px-4',
  };

  // 选择框样式
  const selectClasses = cn(
    'relative w-full rounded-md border transition-colors cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
    'disabled:cursor-not-allowed disabled:opacity-50',
    sizeClasses[size],
    {
      'border-gray-200 bg-white hover:border-gray-300': !error && !disabled,
      'border-red-500 focus:ring-red-500': error,
      'bg-gray-50': disabled,
    },
    className
  );

  // 获取选中选项
  const selectedOption = options.find(option => option.value === internalValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  // 处理选择
  const handleSelect = (optionValue: string) => {
    setInternalValue(optionValue);
    onChange?.(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          const option = options[focusedIndex];
          if (!option.disabled) {
            handleSelect(option.value);
          }
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
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev => {
            const nextIndex = prev < options.length - 1 ? prev + 1 : 0;
            return nextIndex;
          });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => {
            const prevIndex = prev > 0 ? prev - 1 : options.length - 1;
            return prevIndex;
          });
        }
        break;
    }
  };

  // 滚动到焦点项
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [focusedIndex, isOpen]);

  return (
    <div className="w-full space-y-2">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative" ref={selectRef}>
                  <div
            id={selectId}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={`${selectId}-listbox`}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${selectId}-error` : 
              helperText ? `${selectId}-helper` : undefined
            }
            tabIndex={disabled ? -1 : 0}
            className={selectClasses}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
          >
          <span className={cn(
            'block truncate pr-8',
            !selectedOption ? 'text-gray-500' : 'text-gray-900'
          )}>
            {displayText}
          </span>

          {/* 下拉箭头 */}
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform duration-200',
                isOpen && 'transform rotate-180'
              )}
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
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            <ul ref={listRef} id={`${selectId}-listbox`} role="listbox" className="py-1">
              {options.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === internalValue}
                  aria-disabled={option.disabled}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-sm transition-colors duration-150',
                    {
                      'bg-blue-600 text-white': option.value === internalValue,
                      'bg-gray-100': index === focusedIndex && option.value !== internalValue,
                      'text-gray-900 hover:bg-gray-50': !option.disabled && option.value !== internalValue,
                      'text-gray-400 cursor-not-allowed': option.disabled,
                    }
                  )}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <p
          id={`${selectId}-error`}
          className="text-sm text-red-500"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={`${selectId}-helper`}
          className="text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}; 