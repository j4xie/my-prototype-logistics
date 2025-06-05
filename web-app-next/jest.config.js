const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // TypeScript支持配置 - 解决Babel + TypeScript strict模式冲突
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        // 放宽Mock文件的类型检查
        skipLibCheck: true,
        noImplicitAny: false // 允许Mock Factory中的隐式any
      }
    }
  },

  // 为不同类型的测试使用不同的环境
  projects: [
    // React组件测试：使用jsdom环境
    {
      displayName: 'React Components',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/unit/components/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/tests/unit/hooks/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/**/*.test.{js,jsx,ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      // TypeScript转换器配置
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
            noImplicitAny: false, // 允许Mock中的隐式any
            skipLibCheck: true
          }
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@/store/(.*)$': '<rootDir>/src/store/$1',
        '^@/types/(.*)$': '<rootDir>/src/types/$1',
        '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
      },
    },
    // MSW和API测试：使用自定义MSW环境
    {
      displayName: 'MSW & API Tests',
      testEnvironment: '<rootDir>/tests/jest-environment-msw.js',
      testMatch: [
        '<rootDir>/tests/msw*.test.{js,jsx,ts,tsx}',
        '<rootDir>/tests/debug.test.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      maxWorkers: 1, // MSW在并发环境下可能有问题
      testTimeout: 15000, // 增加超时时间
      // TypeScript转换器配置 - 支持MSW
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
            noImplicitAny: false, // 关键：允许Mock Factory中的隐式any
            skipLibCheck: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
          }
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@/store/(.*)$': '<rootDir>/src/store/$1',
        '^@/types/(.*)$': '<rootDir>/src/types/$1',
        '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
      },
      transformIgnorePatterns: [
        'node_modules/(?!(msw|@mswjs|@bundled-es-modules|undici)/)'
      ],
    },
    // 其他测试：使用默认node环境
    {
      displayName: 'Unit Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
      ],
      testPathIgnorePatterns: [
        'tests/unit/components/',
        'tests/unit/hooks/',
        'tests/msw',
        'tests/debug.test.ts',
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      // TypeScript转换器配置
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx',
            noImplicitAny: false,
            skipLibCheck: true
          }
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@/store/(.*)$': '<rootDir>/src/store/$1',
        '^@/types/(.*)$': '<rootDir>/src/types/$1',
        '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
      },
    }
  ],

  // 全局配置
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],

  // 防止测试无限重试
  bail: 5, // 5个测试失败后停止

  // 清理配置
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // 避免监视文件变化导致内存问题
  watchman: false,

  // 优化模块解析
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 减少并发测试
  testRunner: 'jest-circus/runner',

  // 环境变量注入 - P1方案：架构级解决方案
  setupFiles: ['<rootDir>/tests/env.setup.js'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
