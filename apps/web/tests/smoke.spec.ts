import { test, expect } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

test.beforeAll(async ({ request }) => {
  // The API must be up with the seeded demo branch (CityCare).
  const health = await request.get(`${API}/api/v1/health`);
  expect(health.ok()).toBeTruthy();
});

test('public join flow: branch -> service -> token page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /টোকেন নিন|Get a token/ })).toBeVisible();
  // Branch select lists the seeded CityCare branch.
  await expect(page.locator('select').first()).toContainText('CityCare');
  await page.locator('select').first().selectOption({ index: 1 });
  await expect(page.locator('select').nth(1)).toContainText('Doctor Consultation');
  await page.locator('input[placeholder*="01"]').fill('01719999999');
  await page.getByRole('button', { name: /টোকেন নিন|Get token/ }).click();
  // Lands on the token page with a token number and an ETA.
  await expect(page).toHaveURL(/\/t\/[a-f0-9]{12}/);
  await expect(page.locator('.token-no')).toHaveText(/^A-\d+$/);
  await expect(page.getByText(/জন আপনার আগে|people ahead|You are next/)).toBeVisible();
});

test('TV display and kiosk pages render for the seeded branch', async ({ page, request }) => {
  const branches = await (await request.get(`${API}/api/v1/public/branches`)).json();
  const branchId = branches[0].id as string;
  await page.goto(`/display/${branchId}`);
  await expect(page.getByText(/Now serving|এখন সেবা/)).toBeVisible();
  await page.goto(`/kiosk/${branchId}`);
  await expect(page.getByRole('button', { name: /Doctor Consultation/ }).first()).toBeVisible();
});

test('login as owner reaches the manager dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('owner@citycare.example');
  await page.locator('input[type="password"]').fill('Owner123!');
  await page.getByRole('button', { name: /^লগইন$|^Log in$/ }).click();
  await expect(page).toHaveURL(/\/manager$/);
  await expect(page.getByText(/অপেক্ষমাণ|Waiting/)).toBeVisible();
});

test('counter page without a session redirects to login', async ({ page }) => {
  await page.goto('/counter');
  await expect(page).toHaveURL(/\/login$/);
});
