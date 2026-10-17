import { test, expect, type Page } from '@playwright/test';
import { gotoNav, waitForHydration, uniqueSuffix, apiGet, unwrap, type Role } from './helpers';

/**
 * S6 — Messaging (staff chat).
 *
 * Contract notes discovered from the source (recorded here because they drive
 * the assertions):
 *  - The page is a *demo* client: `CURRENT_USER_ID = '1'` is hardcoded, so every
 *    role acts as "Sarah Johnson" regardless of who is actually signed in
 *    (see the front_desk characterization test — BUG-S6-1).
 *  - The frontend encodes the DM recipient in `channelId` (not `recipientId`),
 *    and `CreateMessageInput` never sends `recipientId`, so every UI-sent
 *    message is stored server-side as a channel post (recipientId = null).
 *  - Messages *are* persisted: `addMessage` -> POST /messages, `markMessageRead`
 *    -> PUT /messages/{id}/read, `deleteMessage` -> DELETE /messages/{id}.
 *  - GET /messages is unscoped (any authenticated user reads every message) —
 *    recorded as BUG-S6-2 in the final report; not asserted here.
 *  - The inline composer never toasts (only the New Message modal does); the
 *    server also overrides senderId/senderName from the JWT, so a message the
 *    UI renders as "mine" is persisted under the *real* signer.
 */

/** Conversation rows contain "{role} · Online/Offline" — unique to the list. */
function conversationRows(page: Page) {
  return page.locator('button').filter({ hasText: /Online|Offline/ });
}

/** Thread bubbles use `p.whitespace-pre-wrap`; the sidebar preview does not. */
function bubble(page: Page, content: string) {
  return page.locator('p.whitespace-pre-wrap').filter({ hasText: content });
}

async function openMessaging(page: Page): Promise<void> {
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Messaging');
  await expect(page.getByPlaceholder('Search conversations...')).toBeVisible();
}

async function sendToFirstConversation(page: Page, content: string): Promise<void> {
  const rows = conversationRows(page);
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  const input = page.getByPlaceholder('Type a message...');
  await expect(input).toBeVisible();
  await input.fill(content);
  await input.press('Enter');
  // The inline composer commits straight to store+API with NO toast (only the
  // "New Message" modal toasts — see handleNewMessageSend vs handleSendMessage).
  await expect(bubble(page, content)).toBeVisible();
  await expect(input).toHaveValue('');
}

async function apiMessageRow(
  request: Parameters<typeof apiGet>[0],
  role: Role,
  content: string,
): Promise<{ found: Record<string, unknown> | undefined; status: number }> {
  const { status, body } = await apiGet(request, '/messages', role);
  const rows = (unwrap(body) as Record<string, unknown>[] | null) ?? [];
  return { found: rows.find((r) => r['content'] === content), status };
}

test.describe('S6 messaging — admin', () => {
  test('admin: page renders, conversations list, search filters, new-message modal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');
    await openMessaging(page);

    const rows = conversationRows(page);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // Search narrows to the empty-state when nothing matches.
    await page.getByPlaceholder('Search conversations...').fill('zzz-no-such-person');
    await expect(page.getByText('No conversations found')).toBeVisible();
    await page.getByPlaceholder('Search conversations...').fill('');
    await expect(rows.first()).toBeVisible();

    // New Message modal opens with a recipient picker + composer.
    // NOTE: two "New Message" buttons exist (sidebar CTA + one in the empty
    // thread); the sidebar CTA is first in DOM order.
    await page.getByRole('button', { name: 'New Message' }).first().click();
    await expect(page.getByRole('heading', { name: 'New Message' })).toBeVisible();
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
  });

  test('admin: send a DM — appears, persists to API, survives reload', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');
    await openMessaging(page);

    const content = `QA msg ${uniqueSuffix()}`;
    await sendToFirstConversation(page, content);

    // Persisted server-side: exactly one row, recipient encoded via channelId.
    await expect
      .poll(async () => (await apiMessageRow(request, 'admin', content)).found ? 1 : 0, { timeout: 15_000 })
      .toBe(1);
    const { found } = await apiMessageRow(request, 'admin', content);
    expect(found!['channelId']).toBeTruthy();
    expect(found!['recipientId'] ?? null).toBeNull();

    // Survives a reload (hydrated from GET /messages).
    await page.reload();
    await waitForHydration(page);
    await gotoNav(page, 'Messaging');
    await expect(page.getByText(content).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin: delete a sent message — removed from thread and API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');
    await openMessaging(page);

    const content = `QA del ${uniqueSuffix()}`;
    await sendToFirstConversation(page, content);

    await expect
      .poll(async () => (await apiMessageRow(request, 'admin', content)).found ? 1 : 0, { timeout: 15_000 })
      .toBe(1);

    const target = bubble(page, content);
    await target.hover();
    await page.getByTitle('Delete message').click();
    await expect(page.getByText('Message deleted').first()).toBeVisible();
    await expect(bubble(page, content)).toHaveCount(0);

    await expect
      .poll(async () => (await apiMessageRow(request, 'admin', content)).found ? 1 : 0, { timeout: 15_000 })
      .toBe(0);
  });

  test('admin: more-options actions — view profile, clear chat, block user', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');
    await openMessaging(page);

    const rows = conversationRows(page);
    await expect(rows.first()).toBeVisible();
    await rows.first().click();

    // View Profile
    await page.getByTitle('More Options').click();
    await page.getByRole('button', { name: 'View Profile' }).click();
    await expect(page.getByRole('heading', { name: 'User Profile' })).toBeVisible();
    await page.getByRole('heading', { name: 'User Profile' }).locator('..').getByRole('button').click();
    await expect(page.getByRole('heading', { name: 'User Profile' })).toBeHidden();

    // Clear Chat
    await page.getByTitle('More Options').click();
    await page.getByRole('button', { name: 'Clear Chat' }).click();
    await expect(page.getByText(/^Chat with .+ cleared$/)).toBeVisible();

    // Block User
    await page.getByTitle('More Options').click();
    await page.getByRole('button', { name: 'Block User' }).click();
    await expect(page.getByText(/has been blocked/)).toBeVisible();
  });
});

test.describe('S6 messaging — manager', () => {
  test('manager: send a DM — appears and persists to API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');
    await openMessaging(page);

    const content = `QA mgr msg ${uniqueSuffix()}`;
    await sendToFirstConversation(page, content);

    await expect
      .poll(async () => (await apiMessageRow(request, 'manager', content)).found ? 1 : 0, { timeout: 15_000 })
      .toBe(1);
  });
});

test.describe('S6 messaging — front_desk', () => {
  test('front_desk: messaging accessible; documents hardcoded "Sarah Johnson" identity (BUG-S6-1)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');
    await openMessaging(page);

    const rows = conversationRows(page);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // The signed-in front-desk user is treated as Sarah Johnson (id '1'): she
    // can never appear in her own conversation list, and the roster is the mock
    // fallback (front_desk cannot GET /users), not the real staff.
    const main = page.getByRole('main');
    await expect(main.getByText('Sarah Johnson', { exact: true })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Mike Chen' })).toHaveCount(1);

    // And sending still works (any authenticated user may POST /messages).
    const content = `QA fd msg ${uniqueSuffix()}`;
    await sendToFirstConversation(page, content);
  });
});
