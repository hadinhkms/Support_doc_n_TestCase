// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', '.auth/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: [
      'tests/**/*.ts',
      'deep-engine-tests/**/*.ts',
      'playwright.config.ts',
      'deep-engine.config.ts',
    ],
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  {
    // Chỉ áp cho file test nghiệp vụ, không áp cho page object / helper.
    files: ['tests/**/*.spec.ts', 'tests/**/*.setup.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,

      // --- Bắt buộc theo .github/copilot-instructions.md, muc 8-9 ---
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-wait-for-selector': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/valid-expect': 'error',

      // Chặn test bị tắt âm thầm.
      'playwright/no-skipped-test': ['error', { allowConditional: true }],

      'no-restricted-syntax': [
        'error',
        {
          // Traceability REQ -> AC -> TC -> script.
          selector:
            "CallExpression[callee.name='test'] > Literal:first-child[value!=/^TC-[0-9]{3}/]",
          message: 'Test title phải bắt đầu bằng mã TC-xxx để trace về test case.',
        },
        {
          // CSS selector phụ thuộc layout (.class, #id, :nth-...).
          // `$`, `$$`, `$eval` đã được no-element-handle / no-eval bắt.
          selector:
            "CallExpression[callee.property.name='locator'] > Literal[value=/^(\\.|#)|:nth-/]",
          message:
            'Selector CSS phụ thuộc layout. Dùng getByRole / getByLabel / getByTestId (docs/selector-convention.md).',
        },
      ],
    },
  },

  {
    // Harness tự kiểm chứng (HM-00 .. HM-08) chạy độc lập qua deep-engine.config.ts.
    files: ['deep-engine-tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-page-pause': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      'playwright/valid-expect': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='test'] > Literal:first-child[value!=/^HM-[0-9]{2}\\s+-\\s+/]",
          message:
            'Harness test title trong deep-engine-tests/ phải bắt đầu bằng mã HM-xx - <mô tả>.',
        },
      ],
    },
  },
);
