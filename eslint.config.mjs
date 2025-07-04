import neostandard from 'neostandard'

export default [
  ...neostandard({
    ignores: ['node_modules/**', 'test/**'],
    ts: false,
  }),
  {
    rules: {
      '@stylistic/space-before-function-paren': 'off',
    },
  },
]
