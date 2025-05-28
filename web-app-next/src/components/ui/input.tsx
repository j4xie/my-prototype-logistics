import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    label,
    error,
    helperText,
    variant = 'default',
    startIcon,
    endIcon,
    loading = false,
    disabled,
    required,
    id,
    ...props
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputClasses = cn(
      // 基础样式
      'flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-gray-500',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      
      // 变体样式
      {
        'border-gray-200 bg-white focus-visible:ring-blue-500': variant === 'default' && !error,
        'border-gray-300 bg-gray-50 focus-visible:ring-blue-500': variant === 'filled' && !error,
        'border-2 border-gray-300 bg-transparent focus-visible:ring-blue-500': variant === 'outlined' && !error,
        'border-red-500 focus-visible:ring-red-500': error,
      },
      
      // 图标间距调整
      {
        'pl-10': startIcon,
        'pr-10': endIcon || loading,
      },
      
      className
    );

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {startIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {startIcon}
            </div>
          )}
          
          <input
            id={inputId}
            ref={ref}
            type={type}
            className={inputClasses}
            disabled={disabled || loading}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : 
              helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          
          {(endIcon || loading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {loading ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                endIcon
              )}
            </div>
          )}
        </div>
        
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-500"
            role="alert"
          >
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input'; 