// Mock Types for Jest Environment
// 解决Jest Mock Factory TypeScript类型冲突

declare module 'jest' {
  interface Mock<T = any, Y extends any[] = any> {
    (...args: Y): T;
  }
}

// Mock Image Props Interface
interface MockImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  [key: string]: any;
}

// Mock Router Interface
interface MockRouter {
  push: (url: string) => Promise<boolean>;
  replace: (url: string) => Promise<boolean>;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (url: string) => Promise<void>;
  pathname: string;
  query: Record<string, string | string[]>;
  asPath: string;
  route: string;
  [key: string]: any;
}

// Mock Next.js Components
declare global {
  namespace jest {
    interface Expect {
      toBeInTheDocument(): any;
      toHaveClass(className: string): any;
      toHaveTextContent(text: string): any;
    }
  }

  // Mock Function Types for Jest
  type MockFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;

  // Console Mock Types
  interface ConsoleMock {
    error: MockFunction<typeof console.error>;
    warn: MockFunction<typeof console.warn>;
    log: MockFunction<typeof console.log>;
    info: MockFunction<typeof console.info>;
  }
}

export { MockImageProps, MockRouter, ConsoleMock };
