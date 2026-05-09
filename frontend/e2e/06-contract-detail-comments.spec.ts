import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 코멘트 탭 (GET/POST/DELETE /contracts/:id/comments)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts/ctr_001');
    await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
    await page.click('button:has-text("코멘트")');
  });

  // ── GET /contracts/ctr_001/comments ─────────────────────────────

  test('코멘트 목록 4건 로딩', async ({ page }) => {
    await expect(page.locator('text=김영업').first()).toBeVisible();
    await expect(page.locator('text=박계약').first()).toBeVisible();
    await expect(page.locator('text=이법무').first()).toBeVisible();
    await expect(page.locator('text=최재무').first()).toBeVisible();
  });

  test('코멘트 내용 표시', async ({ page }) => {
    await expect(page.locator('text=고객사에서 오늘 계약서 수정본 보내왔습니다').first()).toBeVisible();
  });

  test('@멘션 하이라이트 표시', async ({ page }) => {
    await expect(page.locator('text=@박계약').first()).toBeVisible();
    await expect(page.locator('text=@이법무').first()).toBeVisible();
  });

  test('코멘트 작성자 아바타/이니셜 표시', async ({ page }) => {
    await expect(page.locator('text=김영').first()).toBeVisible();
  });

  test('부서 정보 표시', async ({ page }) => {
    await expect(page.locator('text=영업팀').first()).toBeVisible();
  });

  // ── POST /contracts/ctr_001/comments ────────────────────────────

  test('코멘트 입력 필드 존재', async ({ page }) => {
    await expect(page.locator('textarea[placeholder*="댓글"]').first()).toBeVisible();
  });

  test('새 코멘트 작성 및 전송', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="댓글"]').first();
    await textarea.fill('E2E 테스트 코멘트');
    await page.locator('button:has-text("전송")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=E2E 테스트 코멘트')).toBeVisible();
  });

  // ── ctr_002: 코멘트 1건 ────────────────────────────────────────

  test('ctr_002 코멘트 1건 표시', async ({ page }) => {
    await page.goto('/contracts/ctr_002');
    await page.waitForSelector('text=B사_비밀유지계약서_v1.docx');
    await page.click('button:has-text("코멘트")');
    await expect(page.locator('text=NDA 검토 완료됐습니다')).toBeVisible();
  });
});
