import { test, expect, type Page } from '@playwright/test';
import { gotoNav, waitForHydration, uniqueSuffix, apiGet, unwrap, type Role } from './helpers';

/**
 * S6 — Messaging (staff chat).
 *
 * Contract notes from the source (they drive the assertions):
 *  - One conversation row per other signed-in user; the session user never
 *    appears in their own list. Rows without history show "No messages yet",
 *    and every row carries a "{role} · Active/On Leave/Inactive" status line.
 *  - The DM recipient rides in `channelId` (`CreateMessageInput` never sends
 *    `recipientId`), so every UI-sent message lands server-side as a channel
 *    post with recipientId = null.
 *  - addMessage -> POST /messages, markMessageRead -> PUT /messages/{id}/read,
 *    deleteMessage -> DELETE /messages/{id} (the delete control only renders
 *    for admin/manager — `canManage`).
 *  - GET /messages is unscoped: any authenticated caller reads every message.
 *    Known gap, not asserted here.
 *  - The server stamps senderId/senderName from the JWT, so a message the UI
 *    renders as "mine" is persisted under the real signer.
 *  - Only the New Message modal toasts ("Message sent"); the inline composer
 *    commits silently.
 */

/** Conversation rows carry the "{role} · {status}" line — unique to the list. */
function conversationRows(page: Page) {
  return page.locator('button').filter({ hasText: /· (Active|On Leave|Inactive)/ });
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
    const recipientPicker = page.locator('#new-message-recipient');
    await expect(recipientPicker).toBeVisible();
    // Picker is fed from the roster: placeholder plus at least one colleague.
    expect(await recipientPicker.locator('option').count()).toBeGreaterThan(1);
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    await page.getByRole('heading', { name: 'New Message' }).locator('..').getByRole('button').click();
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
  test('front_desk: roster conversations reflect the real signed-in user', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');
    await openMessaging(page);

    const rows = conversationRows(page);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // The session user never appears as their own conversation, and the list
    // comes from the API roster (GET /users is open to every signed-in role),
    // not the old mock fallback.
    const main = page.getByRole('main');
    await expect(main.getByText('Front Desk', { exact: true })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Admin User' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Mike Chen' })).toHaveCount(0);

    // Sending still works (any authenticated user may POST /messages).
    const content = `QA fd msg ${uniqueSuffix()}`;
    await sendToFirstConversation(page, content);
  });
});
