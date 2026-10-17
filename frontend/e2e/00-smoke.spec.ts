import { test, expect } from '@playwright/test';
import { gotoNav, waitForHydration, trackErrors, apiGet, unwrap, type Role } from './helpers';

const ROLES: Role[] = ['admin', 'manager', 'front_desk'];

for (const role of ROLES) {
  test.describe(`${role}`, () => {
    test('storage state has token; dashboard loads', async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== role, `storage state belongs to ${testInfo.project.name}`);
      const errors = trackErrors(page);
      await page.goto('/');
      await waitForHydration(page);

      // Logged in — sidebar visible
      await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 20_000 });
      await gotoNav(page, 'Dashboard');

      // No uncaught exceptions on dashboard
      expect(errors.pageErrors).toEqual([]);

      // Token present and /auth/me works
      const me = await apiGet(request, '/auth/me', role);
      expect(me.status).toBe(200);
      const user = unwrap(me.body) as { role?: string };
      const expectedRole = role === 'front_desk' ? 'front_desk' : role;
      expect(user.role).toBe(expectedRole);
    });
  });
}
