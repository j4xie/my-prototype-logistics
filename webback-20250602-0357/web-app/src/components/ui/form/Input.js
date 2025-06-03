/**
 * @module Input
 * @description 食品溯源系统 - 标准化输入框组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

/**
 * 输入框组件
 * @param {Object} props - 组件属性
 * @param {string} props.type - 输入类型
 * @param {string} props.placeholder - 占位符文本
 * @param {string} props.value - 输入值
 * @param {Function} props.onChange - 值变化处理函数
 * @param {boolean} props.disabled - 是否禁用
 * @param {boolean} props.required - 是否必填
 * @param {string} props.error - 错误信息
 * @param {string} props.label - 标签文本
 * @param {string} props.className - 额外的CSS类名
 * @returns {JSX.Element} 输入框组件
 */
const Input = ({
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  disabled = false,
  required = false,
  error = '',
  label = '',
  className = '',
  ...props
}) => {
  const handleChange = (event) => {
    if (onChange) {
      onChange(event);
    }
  };

  // 基础样式类
  const baseClasses = [
    'w-full',
    'px-3',
    'py-2',
    'border',
    'rounded-lg',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-1'
  ];

  // 状态样式
  const stateClasses = error
    ? [
        'border-[#FF4D4F]',
        'focus:ring-[#FF4D4F]',
        'focus:border-[#FF4D4F]'
      ]
    : [
        'border-gray-300',
        'focus:ring-[#1890FF]',
        'focus:border-[#1890FF]'
      ];

  // 禁用状态样式
  const disabledClasses = disabled
    ? ['bg-gray-50', 'text-gray-500', 'cursor-not-allowed']
    : ['bg-white', 'text-gray-900'];

  // 组合所有样式类
  const inputClasses = [
    ...baseClasses,
    ...stateClasses,
    ...disabledClasses,
    className
  ].join(' ');

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-[#FF4D4F] ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={inputClasses}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id || 'input'}-error` : undefined}
        {...props}
      />
      {error && (
        <p
          id={`${props.id || 'input'}-error`}
          className="mt-1 text-sm text-[#FF4D4F]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default Input; 