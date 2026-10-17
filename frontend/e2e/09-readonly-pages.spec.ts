import { test, expect } from '@playwright/test';
import { gotoNav, waitForHydration, trackErrors } from './helpers';

/**
 * S9 — Read-only pages: Analytics, Reports (+CSV export), Forecasting, Integrations,
 * Settings, AI Enhancements. These pages have no CRUD to exercise; the goal is to prove
 * they render without crashing, their tabs work, and role-based nav visibility holds.
 *
 * Nav -> component mapping (App.tsx): analytics/forecast -> ForecastingPage,
 * reports -> ReportsPage, integrations/settings/admin -> their pages, ai-enhancements -> AIEnhancements.
 */

const READONLY_PAGES: Array<{ label: string; heading: string }> = [
  { label: 'Analytics', heading: 'Forecasting & Predictions' },
  { label: 'Reports', heading: 'Reports & Analytics' },
  { label: 'Forecasting', heading: 'Forecasting & Predictions' },
  { label: 'Integrations', heading: 'Integrations' },
  { label: 'Settings', heading: 'Settings' },
  { label: 'AI Enhancements', heading: 'AI Enhancements' },
];

test.describe('read-only pages — admin render', () => {
  for (const { label, heading } of READONLY_PAGES) {
    test(`admin: "${label}" renders without crashing`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'admin');
      const errors = trackErrors(page);

      await page.goto('/');
      await waitForHydration(page);
      await gotoNav(page, label);

      await expect(
        page.getByRole('heading', { level: 1, name: heading, exact: true }),
      ).toBeVisible();

      expect(errors.pageErrors, `uncaught exceptions on ${label}`).toEqual([]);
    });
  }
});

test.describe('read-only pages — interactive surfaces', () => {
  test('admin: Forecasting tabs switch (Occupancy / Revenue / Demand)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Forecasting');

    await expect(
      page.getByRole('heading', { name: /^Occupancy Forecast/, exact: false }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Revenue Forecast', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: /^Revenue Forecast/, exact: false }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Demand Analysis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Demand Drivers', exact: true })).toBeVisible();
  });

  test('admin: Reports CSV export triggers a download', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Reports');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Reports & Analytics', exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export as CSV', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });
});

test.describe('read-only pages — role visibility', () => {
  test('manager: sees Analytics/Reports/Forecasting/Integrations/AI Enhancements but not Admin/Settings', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');

    await page.goto('/');
    await waitForHydration(page);
    const scope = page.getByRole('navigation', { name: /main navigation/i });

    for (const label of ['Analytics', 'Reports', 'Forecasting', 'Integrations', 'AI Enhancements']) {
      await expect(scope.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    for (const label of ['Admin', 'Settings']) {
      await expect(scope.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
  });

  test('front_desk: none of the privileged nav items are exposed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    await page.goto('/');
    await waitForHydration(page);
    const scope = page.getByRole('navigation', { name: /main navigation/i });

    for (const label of [
      'Analytics',
      'Reports',
      'Forecasting',
      'Integrations',
      'Settings',
      'AI Enhancements',
      'Admin',
    ]) {
      await expect(scope.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
  });
});
