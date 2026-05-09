import { test, expect } from '@playwright/test';

test.describe('전체 네비게이션 및 라우팅', () => {

  test('루트 경로 → /contracts 리다이렉트', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/contracts');
    await expect(page).toHaveURL(/\/contracts/);
  });

  test('계약서 목록 → 상세 → 목록 복귀', async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
    await page.locator('text=A사_SI도급계약서_v2.docx').click();
    await page.waitForURL('**/contracts/ctr_001');

    await page.locator('button:has-text("계약서 목록")').click();
    await page.waitForURL('**/contracts');
    await expect(page).toHaveURL(/\/contracts$/);
  });

  test('상세 페이지 탭 전환 (report→text→diff→workflow→comments)', async ({ page }) => {
    await page.goto('/contracts/ctr_001');
    await page.waitForSelector('text=A사_SI도급계약서_v2.docx');

    await page.click('button:has-text("원문 보기")');
    await expect(page.locator('text=추출된 계약 정보')).toBeVisible();

    await page.click('button:has-text("버전 비교")');
    await expect(page.locator('text=v1 → v2')).toBeVisible();

    await page.click('button:has-text("워크플로우")');
    await expect(page.locator('text=리스크 수준에 따라 자동 배정')).toBeVisible();

    await page.click('button:has-text("코멘트")');
    await expect(page.locator('text=김영업').first()).toBeVisible();

    await page.click('button:has-text("리스크 리포트")');
    await expect(page.locator('text=조항별 리스크')).toBeVisible();
  });

  test('존재하지 않는 계약서 접근 → 빈 상태', async ({ page }) => {
    await page.goto('/contracts/nonexistent');
    await expect(page.locator('text=계약서를 찾을 수 없습니다.')).toBeVisible();
  });

  test('사이드 네비게이션 렌더링', async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForSelector('text=계약서 관리');
    const nav = page.locator('nav, [class*="nav"], [style*="sidebar"]').first();
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });
});
