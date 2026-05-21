import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/target/**",
      "release/**",
      "eslint-report.json",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      "unused-imports/no-unused-imports": "error",

      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["backend/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  },
  {
    files: [
      "src/contexts/**/*.{ts,tsx}",
      "src/components/ui/**/*.{ts,tsx}",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
