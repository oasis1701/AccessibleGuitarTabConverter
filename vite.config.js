import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig(({ command, isPreview }) => {
  // GitHub Pages serves the site under the repo name; dev stays at root.
  const base =
    command === 'build' || isPreview ? '/AccessibleGuitarTabConverter/' : '/';
  
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
          myTabs: resolve(__dirname, 'my-tabs.html')
        }
      }
    },
    server: {
      port: 3000,
      open: true
    }
  };
});
