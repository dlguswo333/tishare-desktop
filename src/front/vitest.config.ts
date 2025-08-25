import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [commonjs(), svgr(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
