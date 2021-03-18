import pkg from './package.json'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'

export default {
  input: './src/index.ts',
  plugins: [
    replace({
      preventAssignment: true,
      '__DEV__': 'true'
    }),
    typescript(),
    serve({
      open: false,
      openPage: '/',
      host: 'localhost',
      port: 3000,
      contentBase: ['./example']
    }),
    livereload({
      watch: ['./example'],
      exts: ['html', 'css', 'js']
    })
  ],
  output: [
    {
      format: 'cjs',
      file: `./example/${pkg.main}`,
      sourcemap: false
    },
    {
      name: 'vue',
      format: 'es',
      file: `./example/${pkg.module}`,
      sourcemap: false
    }
  ]
}