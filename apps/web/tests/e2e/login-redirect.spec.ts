import { test, expect } from '@playwright/test';

test('unauthenticated user is sent to /login from /dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Se connecter')).toBeVisible();
});

test('home redirects to /dashboard which redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
