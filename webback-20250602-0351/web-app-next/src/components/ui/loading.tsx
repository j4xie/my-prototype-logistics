import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots';
  color?: 'primary' | 'secondary' | 'gray';
  text?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  variant = 'spinner',
  color = 'primary',
  text,
  className,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    gray: 'text-gray-400',
  };

  const renderSpinner = () => (
    <svg
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
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
  );

  const renderDots = () => {
    const dotSize = {
      sm: 'w-1 h-1',
      md: 'w-1.5 h-1.5',
      lg: 'w-2 h-2',
      xl: 'w-3 h-3',
    };

    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded-full',
              dotSize[size],
              colorClasses[color].replace('text-', 'bg-')
            )}
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1s',
            }}
          />
        ))}
      </div>
    );
  };

  const renderLoading = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      {renderLoading()}
      {text && <p className={cn('text-sm', colorClasses[color])}>{text}</p>}
    </div>
  );
};
