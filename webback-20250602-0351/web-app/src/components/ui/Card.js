/**
 * @module Card
 * @description 食品溯源系统 - 标准化卡片组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

/**
 * 卡片组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.title - 卡片标题
 * @param {React.ReactNode} props.extra - 额外内容（通常放在右上角）
 * @param {boolean} props.bordered - 是否显示边框
 * @param {boolean} props.hoverable - 是否可悬停
 * @param {string} props.className - 额外的CSS类名
 * @param {Function} props.onClick - 点击事件处理函数
 * @returns {JSX.Element} 卡片组件
 */
const Card = ({
  children,
  title,
  extra,
  bordered = true,
  hoverable = false,
  className = '',
  onClick,
  ...props
}) => {
  const handleClick = (event) => {
    if (onClick) {
      onClick(event);
    }
  };

  // 基础样式类
  const baseClasses = [
    'bg-white',
    'rounded-lg',
    'transition-all',
    'duration-200'
  ];

  // 边框样式
  const borderClasses = bordered
    ? ['border', 'border-gray-200']
    : ['shadow-sm'];

  // 悬停样式
  const hoverClasses = hoverable
    ? ['hover:shadow-md', 'hover:scale-[1.02]', 'cursor-pointer']
    : ['shadow-sm'];

  // 组合所有样式类
  const cardClasses = [
    ...baseClasses,
    ...borderClasses,
    ...hoverClasses,
    className
  ].join(' ');

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      } : undefined}
      {...props}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
          )}
          {extra && (
            <div className="flex items-center space-x-2">
              {extra}
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

/**
 * 卡片头部组件
 */
Card.Header = ({ children, className = '', ...props }) => (
  <div
    className={`p-4 border-b border-gray-200 ${className}`}
    {...props}
  >
    {children}
  </div>
);

/**
 * 卡片主体组件
 */
Card.Body = ({ children, className = '', ...props }) => (
  <div
    className={`p-4 ${className}`}
    {...props}
  >
    {children}
  </div>
);

/**
 * 卡片底部组件
 */
Card.Footer = ({ children, className = '', ...props }) => (
  <div
    className={`p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card; 