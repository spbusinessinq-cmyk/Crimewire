import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type UserConfig } from 'vite';

export default defineConfig(async ({ command }): Promise<UserConfig> => {
  const rawPort = process.env.PORT;
  const basePath = process.env.BASE_PATH || '/';

  // PORT is only required when running the dev server (not during production build)
  if (command === 'serve' && !rawPort) {
    throw new Error('PORT environment variable is required for the dev server.');
  }

  const port = rawPort ? Number(rawPort) : 5173;

  const isReplitDev =
    command === 'serve' &&
    process.env.NODE_ENV !== 'production' &&
    !!process.env.REPL_ID;

  // EdgeOne production builds always deploy to the site root.
  // Only use BASE_PATH when running inside Replit's dev proxy.
  const isEdgeOneBuild = command === 'build' && !process.env.REPL_ID;
  const base = isEdgeOneBuild ? '/' : basePath;

  const replitPlugins = isReplitDev
    ? [
        await import('@replit/vite-plugin-runtime-error-modal').then((m) => m.default()),
        await import('@replit/vite-plugin-cartographer').then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, '..') }),
        ),
        await import('@replit/vite-plugin-dev-banner').then((m) => m.devBanner()),
      ]
    : [];

  return {
    base,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
