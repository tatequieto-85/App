import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: 'http://localhost:4173/index.html',
    reuseExistingServer: !process.env.CI
  },
  use: {
    baseURL: 'http://localhost:4173',
    // Con el Service Worker activo, page.route() no ve lo que el propio SW
    // pide desde su contexto (ver tests/unit/sw-cache-strategy.test.mjs, que
    // prueba esa parte aparte, sin navegador). Bloquearlo acá evita falsos
    // positivos/negativos en los mocks de red de estos tests.
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
