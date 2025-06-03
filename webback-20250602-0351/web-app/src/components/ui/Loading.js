import React from 'react';

/**
 * 标准化的Loading加载组件
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.type - 加载样式类型 ('spinner', 'dots', 'pulse', 'bars')
 * @param {string} props.size - 尺寸 ('sm', 'md', 'lg', 'xl')
 * @param {string} props.color - 颜色 ('primary', 'secondary', 'white', 'gray')
 * @param {string} props.text - 加载文本
 * @param {boolean} props.overlay - 是否显示遮罩层
 * @param {string} props.className - 额外的CSS类名
 */
const Loading = ({
  type = 'spinner',
  size = 'md',
  color = 'primary',
  text = '',
  overlay = false,
  className = '',
  ...props
}) => {
  // 尺寸样式映射
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  // 颜色样式映射
  const colorClasses = {
    primary: 'text-[#1890FF]',
    secondary: 'text-gray-600',
    white: 'text-white',
    gray: 'text-gray-400'
  };

  // 文本尺寸映射
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // 旋转加载器
  const SpinnerLoader = () => (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
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

  // 点状加载器
  const DotsLoader = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            ${size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-4 h-4'}
            ${colorClasses[color]} bg-current rounded-full animate-pulse
          `}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );

  // 脉冲加载器
  const PulseLoader = () => (
    <div
      className={`
        ${sizeClasses[size]} ${colorClasses[color]} bg-current rounded-full animate-pulse
      `}
    />
  );

  // 条状加载器
  const BarsLoader = () => (
    <div className="flex items-end space-x-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`
            ${size === 'sm' ? 'w-1' : size === 'md' ? 'w-1.5' : size === 'lg' ? 'w-2' : 'w-3'}
            ${colorClasses[color]} bg-current animate-pulse
          `}
          style={{
            height: `${12 + (i % 2) * 8}px`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  );

  // 获取加载器组件
  const getLoader = () => {
    switch (type) {
      case 'dots':
        return <DotsLoader />;
      case 'pulse':
        return <PulseLoader />;
      case 'bars':
        return <BarsLoader />;
      case 'spinner':
      default:
        return <SpinnerLoader />;
    }
  };

  // 加载内容
  const LoadingContent = () => (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`} {...props}>
      {getLoader()}
      {text && (
        <span className={`${textSizeClasses[size]} ${colorClasses[color]} font-medium`}>
          {text}
        </span>
      )}
    </div>
  );

  // 如果需要遮罩层
  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <LoadingContent />
        </div>
      </div>
    );
  }

  return <LoadingContent />;
};

export default Loading; 