import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 원문 보기 탭 (GET /contracts/:id/text)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts/ctr_001');
    await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
    await page.click('button:has-text("원문 보기")');
  });

  test('원문 탭 전환 및 렌더링', async ({ page }) => {
    await expect(page.locator('text=추출된 계약 정보')).toBeVisible();
  });

  test('추출 엔티티 정보 표시 (갑/을, 계약일, 금액, 기간)', async ({ page }) => {
    await expect(page.locator('text=갑 (이용자)')).toBeVisible();
    await expect(page.locator('text=주식회사 A사').first()).toBeVisible();
    await expect(page.locator('text=을 (공급자)')).toBeVisible();
    await expect(page.locator('text=메가존클라우드 주식회사').first()).toBeVisible();
    await expect(page.locator('text=계약일')).toBeVisible();
    await expect(page.locator('text=2026-05-30')).toBeVisible();
    await expect(page.locator('text=2,000,000,000원')).toBeVisible();
  });

  test('원문 미리보기 텍스트 표시', async ({ page }) => {
    await expect(page.locator('text=원문 앞부분')).toBeVisible();
    await expect(page.locator('text=소프트웨어 개발 용역 계약서')).toBeVisible();
  });

  test('조항 목록 8개 표시', async ({ page }) => {
    await expect(page.locator('text=조항 목록 (8개)')).toBeVisible();
    await expect(page.locator('text=제1조 (목적)')).toBeVisible();
    await expect(page.locator('text=제2조 (지식재산권)')).toBeVisible();
    await expect(page.locator('text=제3조 (손해배상)')).toBeVisible();
    await expect(page.locator('text=제4조 (지체상금)')).toBeVisible();
    await expect(page.locator('text=제5조 (변경요청)')).toBeVisible();
    await expect(page.locator('text=제6조 (분쟁 해결)')).toBeVisible();
    await expect(page.locator('text=제7조 (계약의 해지)')).toBeVisible();
    await expect(page.locator('text=제8조 (비밀유지)')).toBeVisible();
  });

  test('리스크 있는 조항 색상 배지 표시', async ({ page }) => {
    const highBadges = page.locator('button:has-text("제2조") span:has-text("HIGH")');
    await expect(highBadges).toBeVisible();
  });

  test('조항 클릭 → 원문 내용 펼치기', async ({ page }) => {
    await page.locator('button:has-text("제3조 (손해배상)")').click();
    await expect(page.locator('text=배상액의 상한은 없으며')).toBeVisible();
  });

  test('조항 유형 라벨 표시', async ({ page }) => {
    await expect(page.locator('text=손해배상').first()).toBeVisible();
    await expect(page.locator('text=지식재산권').first()).toBeVisible();
  });
});
