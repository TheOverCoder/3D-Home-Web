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
  // on CI, also each spec file's seconds and every flaky or failed test, in the job's summary (tests/e2e/fileTimes.ts:
  // the times scripts/ci-shards.mjs deals the shards out by, in tests/e2e/times.json)
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['./tests/e2e/fileTimes.ts']] : [['list']],
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
    // outside CI a server already answering on the port is used as it is, unless E2E_FRESH says never: a run killed
    // half way can leave an old build's server there, and the next run would test it
    reuseExistingServer: !process.env.CI && !process.env.E2E_FRESH,
    timeout: 300_000,
  },
})
