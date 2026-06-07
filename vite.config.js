import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',   // static assets copied as-is

  build: {
    outDir:    'dist',
    emptyOutDir: true,

    // Minify everything
    minify:    'terser',
    terserOptions: {
      compress: { drop_console: false, passes: 2 },
      format:   { comments: false },
    },

    rollupOptions: {
      input: {
        index:            resolve(__dirname, 'index.html'),
        book:             resolve(__dirname, 'book.html'),
        login:            resolve(__dirname, 'login.html'),
        signup:           resolve(__dirname, 'signup.html'),
        'my-bookings':    resolve(__dirname, 'my-bookings.html'),
        community:        resolve(__dirname, 'community.html'),
        openplay:         resolve(__dirname, 'openplay.html'),
        policy:           resolve(__dirname, 'policy.html'),
        'auth-callback':  resolve(__dirname, 'auth-callback.html'),
        'admin-dashboard': resolve(__dirname, 'admin/dashboard.html'),
        'admin-pos':       resolve(__dirname, 'admin/pos.html'),
        'admin-index':     resolve(__dirname, 'admin/index.html'),
      },

      output: {
        // Group vendor (supabase) into its own chunk
        manualChunks(id) {
          if (id.includes('@supabase'))     return 'supabase';
          if (id.includes('node_modules')) return 'vendor';
        },
        // Hashed filenames for long-term cache
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  // Dev server (for local use once Node is installed)
  server: {
    port: 5173,
    open: true,
  },
});
