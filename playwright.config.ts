import { defineConfig } from '@playwright/test'

// The app renders in software (SwiftShader) in CI and sandboxes: 1-5 fps, so timeouts are generous
// and everything runs sequentially in one worker.
// Locally set PW_CHROMIUM_PATH (e.g. /opt/pw-browsers/chromium); in CI Playwright's own browser is used.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4185',
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
    command: 'npm run build && npx vite preview --port 4185 --strictPort',
    url: 'http://localhost:4185',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
