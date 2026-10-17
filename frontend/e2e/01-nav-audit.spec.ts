import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { gotoNav, waitForHydration, trackErrors, NAV_PER_ROLE, NAV_FORBIDDEN, PAGE_TO_NAV, type Role } from './helpers';

const ROLES: Role[] = ['admin', 'manager', 'front_desk'];
const AUDIT_DIR = path.join('test-results', 'audit');

interface ButtonInventory {
  name: string;
  disabled: boolean;
  source: 'aria-label' | 'title' | 'text' | 'unnamed';
}

interface PageAudit {
  navLabel: string;
  visible: boolean;
  comingSoon: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  apiFailures: string[];
  buttons: ButtonInventory[];
  inputs: { placeholder: string; type: string }[];
  tabLabels: string[];
}

interface RoleAudit {
  role: Role;
  navVisible: string[];
  navMissing: string[];
  navForbiddenStillVisible: string[];
  pages: PageAudit[];
}

for (const role of ROLES) {
  test.describe(`${role} navigation audit`, () => {
    test('nav visibility + per-page load + button inventory', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== role, `storage state belongs to ${testInfo.project.name}`);
      test.setTimeout(180_000);

      const audit: RoleAudit = {
        role,
        navVisible: [],
        navMissing: [],
        navForbiddenStillVisible: [],
        pages: [],
      };

      await page.goto('/');
      await waitForHydration(page);
      await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 20_000 });

      // --- Nav visibility ---
      const navScope = page.getByRole('navigation', { name: /main navigation/i });
      for (const label of NAV_PER_ROLE[role]) {
        const visible = await navScope.getByRole('button', { name: label, exact: true }).first().isVisible().catch(() => false);
        if (visible) audit.navVisible.push(label);
        else audit.navMissing.push(label);
      }
      for (const label of NAV_FORBIDDEN[role]) {
        const visible = await navScope.getByRole('button', { name: label, exact: true }).first().isVisible().catch(() => false);
        if (visible) audit.navForbiddenStillVisible.push(label);
      }

      // --- Per-page audit for every accessible page ---
      const pagesToVisit = Object.entries(PAGE_TO_NAV)
        .filter(([, label]) => audit.navVisible.includes(label))
        .map(([id, label]) => ({ id, label }));

      for (const { id, label } of pagesToVisit) {
        const apiFailures: string[] = [];
        const onResponse = (res: { status(): number; url(): string; request(): { method(): string } }) => {
          if (res.status() >= 400 && res.url().includes('/api/v1')) {
            apiFailures.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
          }
        };
        page.on('response', onResponse);

        const errors = trackErrors(page);
        await gotoNav(page, label);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(400); // let client-side tabs/tables render

        const inventory = await page.evaluate(() => {
          const buttons: { name: string; disabled: boolean; source: string }[] = [];
          document.querySelectorAll('button').forEach((btn) => {
            const el = btn as HTMLButtonElement;
            if (el.offsetParent === null) return; // hidden
            const aria = el.getAttribute('aria-label');
            const title = el.getAttribute('title');
            const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60);
            let name = '';
            let source: string;
            if (aria) { name = aria; source = 'aria-label'; }
            else if (title) { name = title; source = 'title'; }
            else if (text) { name = text; source = 'text'; }
            else { name = '(unnamed)'; source = 'unnamed'; }
            buttons.push({ name, disabled: el.disabled, source });
          });

          const inputs: { placeholder: string; type: string }[] = [];
          document.querySelectorAll('input, select, textarea').forEach((inp) => {
            const el = inp as HTMLInputElement;
            if (el.offsetParent === null) return;
            inputs.push({
              placeholder: el.getAttribute('placeholder') ?? '',
              type: el.tagName.toLowerCase() + (el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''),
            });
          });

          const tabLabels: string[] = [];
          document.querySelectorAll('[role="tab"]').forEach((t) => {
            const txt = (t as HTMLElement).innerText.trim();
            if (txt) tabLabels.push(txt);
          });

          const comingSoon = Array.from(document.querySelectorAll('*')).some(
            (el) => el.children.length === 0 && (el.textContent ?? '').trim() === 'Coming Soon',
          );

          return { buttons, inputs, tabLabels, comingSoon };
        });

        audit.pages.push({
          navLabel: label,
          visible: true,
          comingSoon: inventory.comingSoon,
          pageErrors: errors.pageErrors,
          consoleErrors: errors.consoleErrors.slice(0, 20),
          apiFailures,
          buttons: inventory.buttons,
          inputs: inventory.inputs,
          tabLabels: inventory.tabLabels,
        });

        page.off('response', onResponse);
      }

      // Persist audit
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
      fs.writeFileSync(path.join(AUDIT_DIR, `${role}.json`), JSON.stringify(audit, null, 2));

      // Hard failures: missing nav items, forbidden items visible, any uncaught page exception
      expect(audit.navMissing, `Missing nav items for ${role}`).toEqual([]);
      expect(audit.navForbiddenStillVisible, `Forbidden nav visible for ${role}`).toEqual([]);
      const allPageErrors = audit.pages.flatMap((p) => p.pageErrors.map((e) => `${p.navLabel}: ${e}`));
      expect(allPageErrors, 'Uncaught page exceptions during navigation').toEqual([]);
    });
  });
}
