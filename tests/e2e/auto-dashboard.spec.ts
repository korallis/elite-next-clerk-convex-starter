// Playwright smoke test (disabled by default). Enable by removing .skip and running:
//   npm i -D @playwright/test && npx playwright install
//   npm run test:e2e
import { test, expect } from '@playwright/test';

test.describe.skip('Auto-Dashboard page', () => {
  test('renders form controls', async ({ page }) => {
    await page.goto('/dashboard/auto-dashboard');
    await expect(page.getByText('Auto‑Dashboard')).toBeVisible();
    await expect(page.getByText('Prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
  });
});
