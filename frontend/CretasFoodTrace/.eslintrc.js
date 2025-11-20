module.exports = {
  root: true,
  extends: [
    'expo',
    '@react-native',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    // ==========================================
    // 废弃API禁用规则 (2025-11-19添加)
    // ==========================================
    'no-restricted-imports': [
      'error',
      {
        paths: [
          // 禁止导入废弃的API Client文件
          {
            name: './services/api/attendanceApiClient',
            message: '❌ attendanceApiClient已废弃 (2025-11-19)，请使用 timeclockApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../api/attendanceApiClient',
            message: '❌ attendanceApiClient已废弃 (2025-11-19)，请使用 timeclockApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../../services/api/attendanceApiClient',
            message: '❌ attendanceApiClient已废弃 (2025-11-19)，请使用 timeclockApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: './services/api/employeeApiClient',
            message: '❌ employeeApiClient已废弃 (2025-11-19)，请使用 userApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../api/employeeApiClient',
            message: '❌ employeeApiClient已废弃 (2025-11-19)，请使用 userApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../../services/api/employeeApiClient',
            message: '❌ employeeApiClient已废弃 (2025-11-19)，请使用 userApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: './services/api/enhancedApiClient',
            message: '❌ enhancedApiClient已废弃 (2025-11-19)，请使用 apiClient 替代。详见: src/services/api/ENHANCED_API_CLIENT_INVESTIGATION.md',
          },
          {
            name: '../api/enhancedApiClient',
            message: '❌ enhancedApiClient已废弃 (2025-11-19)，请使用 apiClient 替代。详见: src/services/api/ENHANCED_API_CLIENT_INVESTIGATION.md',
          },
          {
            name: '../../services/api/enhancedApiClient',
            message: '❌ enhancedApiClient已废弃 (2025-11-19)，请使用 apiClient 替代。详见: src/services/api/ENHANCED_API_CLIENT_INVESTIGATION.md',
          },
          {
            name: './services/api/materialApiClient',
            message: '❌ materialApiClient已重命名 (2025-11-19)，请使用 materialQuickApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../api/materialApiClient',
            message: '❌ materialApiClient已重命名 (2025-11-19)，请使用 materialQuickApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
          {
            name: '../../services/api/materialApiClient',
            message: '❌ materialApiClient已重命名 (2025-11-19)，请使用 materialQuickApiClient 替代。详见: src/services/api/API_CLIENT_INDEX.md',
          },
        ],
        patterns: [
          {
            group: ['**/attendanceApiClient', '**/attendanceApiClient.ts'],
            message: '❌ attendanceApiClient已废弃，请使用 timeclockApiClient。',
          },
          {
            group: ['**/employeeApiClient', '**/employeeApiClient.ts'],
            message: '❌ employeeApiClient已废弃，请使用 userApiClient。',
          },
          {
            group: ['**/enhancedApiClient', '**/enhancedApiClient.ts'],
            message: '❌ enhancedApiClient已废弃，请使用 apiClient。',
          },
          {
            group: ['**/materialApiClient', '**/materialApiClient.ts'],
            message: '❌ materialApiClient已重命名，请使用 materialQuickApiClient。',
          },
        ],
      },
    ],

    // API Client命名规范
    'id-match': [
      'warn',
      '^[a-z][a-zA-Z0-9]*ApiClient$',
      {
        properties: false,
        classFields: false,
        onlyDeclarations: true,
        ignoreDestructuring: true,
      },
    ],

    // TypeScript相关规则
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // React Native相关规则
    'react-native/no-inline-styles': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      // API Client文件特殊规则
      files: ['src/services/api/*ApiClient.ts', 'src/services/api/*ApiClient.tsx'],
      rules: {
        // API Client必须导出单例
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ExportNamedDeclaration > ClassDeclaration',
            message: 'API Client类不应直接导出，应导出单例实例。示例: export const xxxApiClient = new XxxApiClient();',
          },
        ],
      },
    },
    // 注: 所有废弃API Client文件已删除 (2025-11-19)
    // - attendanceApiClient.ts
    // - employeeApiClient.ts
    // - enhancedApiClient.ts
    // - materialApiClient.ts
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};
