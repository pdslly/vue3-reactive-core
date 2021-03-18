import pkg from './package.json'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'

export default {
  input: './src/index.ts',
  plugins: [
    replace({
      preventAssignment: true,
      '__DEV__': 'false'
    }),
    typescript()
  ],
  output: [
    {
      format: 'cjs',
      file: pkg.main,
      sourcemap: false
    },
    {
      name: 'vue',
      format: 'es',
      file: pkg.module,
      sourcemap: false
    }
  ]
}