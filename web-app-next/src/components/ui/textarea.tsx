import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  showCharCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    label,
    error,
    helperText,
    resize = 'vertical',
    showCharCount = false,
    disabled,
    required,
    maxLength,
    value,
    id,
    ...props
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    
    // 计算字符数
    const characterCount = typeof value === 'string' ? value.length : 0;
    
    // 调整大小样式映射
    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    const textareaClasses = cn(
      // 基础样式
      'flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm',
      'placeholder:text-gray-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors',
      
      // 调整大小
      resizeClasses[resize],
      
      // 移动端优化
      'touch-manipulation text-base sm:text-sm',
      
      // 错误状态
      {
        'border-red-500 focus-visible:ring-red-500': error,
        'bg-gray-50': disabled,
      },
      
      className
    );

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          <textarea
            id={textareaId}
            ref={ref}
            className={textareaClasses}
            disabled={disabled}
            required={required}
            maxLength={maxLength}
            value={value}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${textareaId}-error` : 
              helperText ? `${textareaId}-helper` : undefined
            }
            {...props}
          />
          
          {(showCharCount || maxLength) && (
            <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 px-1 rounded">
              {maxLength ? `${characterCount}/${maxLength}` : characterCount}
            </div>
          )}
        </div>
        
        {error && (
          <p
            id={`${textareaId}-error`}
            className="text-sm text-red-500"
            role="alert"
          >
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p
            id={`${textareaId}-helper`}
            className="text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea'; 