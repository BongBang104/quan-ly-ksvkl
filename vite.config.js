import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
    include: /\.(js|jsx)$/
  })],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  esbuild: {
    loader: 'jsx',
    include: /\.(js|jsx)$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx'
      }
    }
  }
});
