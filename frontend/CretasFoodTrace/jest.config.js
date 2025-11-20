module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',

  // 全局变量定义 - 修复 __DEV__ 未定义错误
  globals: {
    __DEV__: true,
  },

  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts'
  ],
  testMatch: [
    '**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/src/test/' // 忽略现有的测试目录
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**', // 排除现有测试目录
    '!src/__tests__/**', // 排除测试目录本身
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
    '!src/mocks/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2)$': 'jest-transform-stub',
    'react-native': 'react-native'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  }
};