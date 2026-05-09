import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 이력 검색 패널 (GET /search)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts/ctr_001');
    await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
  });

  test('검색 패널 렌더링', async ({ page }) => {
    await expect(page.locator('text=계약 이력 검색')).toBeVisible();
    await expect(page.locator('input[placeholder*="과거 계약 이력"]')).toBeVisible();
  });

  test('추천 검색어 버튼 3개 표시', async ({ page }) => {
    await expect(page.locator('button:has-text("CR 조항 이력")')).toBeVisible();
    await expect(page.locator('button:has-text("배상 조항 변화")')).toBeVisible();
    await expect(page.locator('button:has-text("지체상금 기준")')).toBeVisible();
  });

  test('빈 상태 안내 메시지 표시', async ({ page }) => {
    await expect(page.locator('text=과거 계약 이력을')).toBeVisible();
    await expect(page.locator('text=자연어로 검색하세요')).toBeVisible();
  });

  // ── 검색 키워드: CR ────────────────────────────────────────────

  test('변경요청 관련 검색 → AI 답변 + 참조 계약서 표시', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="과거 계약 이력"]');
    await searchInput.fill('변경요청');
    await page.locator('button:has-text("검색")').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('text=AI 답변')).toBeVisible();
    await expect(page.locator('text=참조 계약서')).toBeVisible();
  });

  // ── 검색 키워드: 배상 ──────────────────────────────────────────

  test('배상 관련 검색 → 결과 표시', async ({ page }) => {
    await page.locator('button:has-text("배상 조항 변화")').click();
    await page.locator('button:has-text("검색")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=AI 답변')).toBeVisible();
    await expect(page.locator('text=계약금액의 100% 이내')).toBeVisible();
  });

  // ── 검색 키워드: 지체상금 ──────────────────────────────────────

  test('지체상금 검색 → 결과 표시', async ({ page }) => {
    await page.locator('button:has-text("지체상금 기준")').click();
    await page.locator('button:has-text("검색")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=AI 답변')).toBeVisible();
    await expect(page.locator('text=0.05%/일 이하')).toBeVisible();
  });

  // ── 매칭 안 되는 검색어 ────────────────────────────────────────

  test('매칭 안 되는 검색어 → 기본 응답', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="과거 계약 이력"]');
    await searchInput.fill('특수 조항');
    await page.locator('button:has-text("검색")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=AI 답변')).toBeVisible();
    await expect(page.locator('text=관련 조항을 찾지 못했습니다')).toBeVisible();
  });

  // ── Enter 키로 검색 ────────────────────────────────────────────

  test('Enter 키로 검색 실행', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="과거 계약 이력"]');
    await searchInput.fill('배상');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=AI 답변')).toBeVisible();
  });
});
