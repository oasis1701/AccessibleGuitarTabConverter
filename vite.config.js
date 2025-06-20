import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/AccessibleGuitarTabs/' : '/';
  
  return {
    base,
    plugins: [
      legacy({
        targets: ['defaults', 'not IE 11']
      })
    ],
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          converter: resolve(__dirname, 'converter.html'),
          myTabs: resolve(__dirname, 'my-tabs.html'),
          testFirebase: resolve(__dirname, 'test-firebase.html')
        }
      }
    },
    server: {
      port: 3000,
      open: true
    }
  };
});
