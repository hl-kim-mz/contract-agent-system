import { test, expect } from '@playwright/test';

test.describe('프롬프트 설정 페이지 (/settings/prompts)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/prompts');
    await page.waitForTimeout(500);
  });

  // ── GET /prompts ───────────────────────────────────────────────

  test('프롬프트 목록 페이지 로딩', async ({ page }) => {
    await expect(page.locator('text=기본 리스크 분석').first()).toBeVisible();
  });

  test('프롬프트 4건 표시', async ({ page }) => {
    await expect(page.locator('text=기본 리스크 분석').first()).toBeVisible();
    await expect(page.locator('text=NDA 전용 분석').first()).toBeVisible();
    await expect(page.locator('text=MSA 전용 분석').first()).toBeVisible();
    await expect(page.locator('text=SI 도급 전용 분석').first()).toBeVisible();
  });

  // ── GET /prompts/:id (프롬프트 선택) ────────────────────────────

  test('프롬프트 선택 → 상세 내용 표시', async ({ page }) => {
    await page.locator('text=기본 리스크 분석').first().click();
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('메가존클라우드');
  });

  test('NDA 프롬프트 선택 → NDA 특화 내용 표시', async ({ page }) => {
    await page.locator('text=NDA 전용 분석').first().click();
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea').first();
    const value = await textarea.inputValue();
    expect(value).toContain('NDA');
  });

  test('SI 프롬프트 선택 → SI 특화 내용 표시', async ({ page }) => {
    await page.locator('text=SI 도급 전용 분석').first().click();
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea').first();
    const value = await textarea.inputValue();
    expect(value).toContain('SI');
  });
});
