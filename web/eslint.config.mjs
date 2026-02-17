import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 忽略建置輸出和依賴目錄
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "coverage/**",
      ".firebase/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
      "scripts/**",
      "test-*.js",
      "app/privacy/**",
      "app/terms/**",
      "app/test-*/**",
    ],
  },

  // Next.js 核心規則
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 自訂規則
  {
    rules: {
      // 允許使用 any 型別（在必要時）
      "@typescript-eslint/no-explicit-any": "warn",

      // 允許未使用的變數（以底線開頭）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // 允許空函數
      "@typescript-eslint/no-empty-function": "warn",

      // 關閉 React Hook 依賴檢查的嚴格模式（開發時可能需要）
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
