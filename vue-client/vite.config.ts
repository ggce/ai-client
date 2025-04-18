import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',  // 后端服务地址
        changeOrigin: true
      }
    }
  },
  // 生产环境构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // 确保资源路径是相对路径，这样打包后的页面可以在Electron中正确加载
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
}) 