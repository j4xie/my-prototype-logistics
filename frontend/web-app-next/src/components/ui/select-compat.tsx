'use client';

import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { Select as BaseSelect, SelectOption } from './select';

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({});

// 兼容的 Select 根组件
export const Select = ({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  open: controlledOpen,
  onOpenChange,
  ...props
}: {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalValue, setInternalValue] = useState(value || defaultValue || '');
  const [isOpen, setIsOpen] = useState(controlledOpen || false);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (controlledOpen !== undefined) {
      setIsOpen(controlledOpen);
    }
  }, [controlledOpen]);

  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const contextValue: SelectContextValue = {
    value: internalValue,
    onValueChange: handleValueChange,
    open: isOpen,
    onOpenChange: handleOpenChange,
  };

  // 提取选项从子组件
  const options: SelectOption[] = [];
  const extractOptions = (children: React.ReactNode): void => {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      
      if (child.type === SelectContent) {
        // 递归处理 SelectContent 的子组件
        extractOptions(child.props.children);
      } else if (child.type === SelectItem) {
        // 处理复杂的 children 结构
        let label = '';
        if (typeof child.props.children === 'string') {
          label = child.props.children;
        } else if (React.isValidElement(child.props.children)) {
          // 如果是 React 元素，尝试提取文本
          const extractText = (node: React.ReactNode): string => {
            if (typeof node === 'string') return node;
            if (React.isValidElement(node) && node.props.children) {
              return extractText(node.props.children);
            }
            if (Array.isArray(node)) {
              return node.map(extractText).join('');
            }
            return '';
          };
          label = extractText(child.props.children);
        } else {
          label = React.Children.toArray(child.props.children)
            .map(c => typeof c === 'string' ? c : '')
            .join('');
        }
        
        options.push({
          value: child.props.value,
          label: label,
          disabled: child.props.disabled
        });
      } else if (child.props?.children) {
        // 继续递归处理其他组件的子组件
        extractOptions(child.props.children);
      }
    });
  };

  extractOptions(children);

  let placeholder = '';
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectTrigger) {
      React.Children.forEach(child.props.children, (triggerChild) => {
        if (React.isValidElement(triggerChild) && triggerChild.type === SelectValue) {
          placeholder = triggerChild.props.placeholder || '';
        }
      });
    }
  });

  return (
    <SelectContext.Provider value={contextValue}>
      <BaseSelect
        value={internalValue}
        onChange={handleValueChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        {...props}
      />
    </SelectContext.Provider>
  );
};

// SelectTrigger - 触发器组件
export const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ children, className, ...props }, ref) => {
  return <>{children}</>;
});
SelectTrigger.displayName = 'SelectTrigger';

// SelectValue - 值显示组件
export const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ placeholder, ...props }, ref) => {
  return null; // 占位符会被父组件提取
});
SelectValue.displayName = 'SelectValue';

// SelectContent - 内容容器组件
export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { className?: string }
>(({ children, className, ...props }, ref) => {
  return <>{children}</>;
});
SelectContent.displayName = 'SelectContent';

// SelectItem - 选项组件
export const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    value: string; 
    className?: string;
    disabled?: boolean;
  }
>(({ children, value, className, disabled, ...props }, ref) => {
  return null; // 选项会被父组件提取
});
SelectItem.displayName = 'SelectItem';

// 导出原始组件以备需要
export { Select as RawSelect } from './select';
export type { SelectOption, SelectProps } from './select';