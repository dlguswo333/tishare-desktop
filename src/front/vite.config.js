import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
import process from 'node:process';

export default defineConfig({
  root: 'src/front',
  // In production mode the files should be served using relative paths.
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  publicDir: 'public',
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    outDir: '../../build',
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [commonjs(), svgr(), react()],
});
