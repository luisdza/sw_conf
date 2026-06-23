// Flat ESLint config (ESLint 9). Root package.json has "type": "module".
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // Never lint build output, deps, or the generated Prisma client.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.kiro/**",
      "**/*.md",
      "backend/prisma/migrations/**",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Backend: Node + TypeScript, no `any`.
    files: ["backend/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Frontend: browser + React hooks rules.
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
