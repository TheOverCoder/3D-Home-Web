import { defineConfig } from '@playwright/test'

// The app renders in software (SwiftShader) in CI and sandboxes: 1-5 fps, so timeouts are generous
// and everything runs sequentially in one worker.
// Locally set PW_CHROMIUM_PATH (e.g. /opt/pw-browsers/chromium); in CI Playwright's own browser is used.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined
// The address the app is built and served on: 4185, or E2E_PORT (a second copy of the tree tested beside the first:
// outside CI a server already answering is reused, so two copies on one port would test the wrong build).
const port = Number(process.env.E2E_PORT) || 4185

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 640, height: 360 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
