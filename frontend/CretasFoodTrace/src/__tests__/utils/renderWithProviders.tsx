/**
 * 测试渲染工具
 * 提供包含Store、Navigation等Provider的渲染函数
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';

/**
 * 自定义渲染选项
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** 是否包含Navigation容器 */
  withNavigation?: boolean;
  /** 是否包含Paper Provider */
  withPaper?: boolean;
  /** 初始导航状态 */
  navigationState?: any;
}

/**
 * 使用所有必要Provider包裹组件进行渲染
 * @param ui 要渲染的React组件
 * @param options 渲染选项
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    withNavigation = true,
    withPaper = true,
    navigationState,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    let wrappedChildren = children;

    // 包裹Paper Provider
    if (withPaper) {
      wrappedChildren = <PaperProvider>{wrappedChildren}</PaperProvider>;
    }

    // 包裹Navigation Container
    if (withNavigation) {
      wrappedChildren = (
        <NavigationContainer initialState={navigationState}>
          {wrappedChildren}
        </NavigationContainer>
      );
    }

    return <>{wrappedChildren}</>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * 快捷方式：只渲染Paper Provider
 */
export function renderWithPaper(ui: ReactElement, options?: RenderOptions) {
  return renderWithProviders(ui, { withNavigation: false, withPaper: true, ...options });
}

/**
 * 快捷方式：只渲染Navigation Container
 */
export function renderWithNavigation(ui: ReactElement, options?: RenderOptions) {
  return renderWithProviders(ui, { withNavigation: true, withPaper: false, ...options });
}

/**
 * 等待异步渲染完成
 * @param callback 等待的条件
 * @param options 等待选项
 */
export async function waitForAsync(
  callback: () => void | Promise<void>,
  options = { timeout: 3000 }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Async operation timed out'));
    }, options.timeout);

    Promise.resolve(callback())
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
