import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // 历史条目的记账权属于 React Router（history.state = { usr, key, idx }）。
    // 业务代码手写 window.history.* 会让 idx 断链，路由拦截器（useBlocker）静默失效；
    // 浮层也因此无法被系统返回手势关闭。只读 window.history.state 不受限制
    // ——lib/layers.ts 的 historyIndex 与 NavigationBootstrap 的根锚点需要它。
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.object.name='window'][callee.object.property.name='history']",
          message:
            '禁止手写 window.history.*：条目由 React Router 记账，手写会破坏 idx。请用 useLayer / useNavigate，详见 docs/guides/navigation-layers.md',
        },
        {
          selector: "CallExpression[callee.object.name='history']",
          message:
            '禁止裸用 history.*：请用 useLayer / useNavigate，详见 docs/guides/navigation-layers.md',
        },
      ],
    },
  },
  {
    files: ['**/lib/*Context.tsx', '**/lib/useToast.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
