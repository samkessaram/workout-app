import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    tailwindcss(),
    svelte(),
    svelteTesting(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Workout',
        short_name: 'Workout',
        description: 'Offline workout logger and progressive-overload coach',
        display: 'standalone',
        orientation: 'portrait',
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
})
