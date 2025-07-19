import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 允许any类型用于工具函数和类型定义
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",  // 允许以下划线开头的未使用参数
        "varsIgnorePattern": "^_"   // 允许以下划线开头的未使用变量
      }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",  // 允许以下划线开头的未使用参数
        "varsIgnorePattern": "^_"   // 允许以下划线开头的未使用变量
      }],
    },
  },
];

export default eslintConfig;
