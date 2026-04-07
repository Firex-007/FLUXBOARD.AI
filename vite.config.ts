import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const isSSL = process.env.VITE_DEV_SSL === 'true';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    isSSL ? basicSsl() : null,
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    https: isSSL ? {} : undefined,
    port: 5173
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
        'react/jsx-runtime', 
        'react/jsx-dev-runtime', 
        'react', 
        'react-dom',
        '@splinetool/react-spline',
        '@splinetool/runtime'
    ],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
