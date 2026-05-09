import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 워크플로우 탭 (GET /contracts/:id/workflow, POST /workflow/:stepId/approve)', () => {

  // ── ctr_001: 3단계 워크플로우 (모두 PENDING) ────────────────────

  test.describe('ctr_001 (PENDING 단계들)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contracts/ctr_001');
      await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
      await page.click('button:has-text("워크플로우")');
    });

    test('워크플로우 탭 전환 및 설명 표시', async ({ page }) => {
      await expect(page.locator('text=리스크 수준에 따라 자동 배정된 검토 단계입니다')).toBeVisible();
    });

    test('검토 단계 4건 표시 (계약팀, 법무팀, 본부장, 재무팀)', async ({ page }) => {
      await expect(page.locator('text=계약팀')).toBeVisible();
      await expect(page.locator('text=법무팀')).toBeVisible();
      await expect(page.locator('text=본부장')).toBeVisible();
      await expect(page.locator('text=재무팀')).toBeVisible();
    });

    test('역할 라벨 표시', async ({ page }) => {
      await expect(page.locator('text=1차 검토자')).toBeVisible();
      await expect(page.locator('text=법무 검토')).toBeVisible();
      await expect(page.locator('text=최종 승인')).toBeVisible();
      await expect(page.locator('text=병렬 검토')).toBeVisible();
    });

    test('병렬 배지 표시', async ({ page }) => {
      await expect(page.locator('span:has-text("병렬")').first()).toBeVisible();
    });

    test('1단계(계약팀) 승인/반려 버튼 표시 (활성 상태)', async ({ page }) => {
      await expect(page.locator('button:has-text("승인")')).toBeVisible();
      await expect(page.locator('button:has-text("반려")')).toBeVisible();
    });

    test('검토 의견 입력 필드 표시', async ({ page }) => {
      await expect(page.locator('input[placeholder="검토 의견 입력 (선택)"]')).toBeVisible();
    });

    test('승인 버튼 클릭 → 단계 승인 처리', async ({ page }) => {
      await page.locator('button:has-text("승인")').click();
      await page.waitForTimeout(600);
      await expect(page.locator('text=승인 완료').first()).toBeVisible();
    });
  });

  // ── ctr_002: 이미 승인된 워크플로우 ────────────────────────────

  test.describe('ctr_002 (이미 승인 완료)', () => {
    test('승인 완료 상태 및 코멘트 표시', async ({ page }) => {
      await page.goto('/contracts/ctr_002');
      await page.waitForSelector('text=B사_비밀유지계약서_v1.docx');
      await page.click('button:has-text("워크플로우")');
      await expect(page.locator('text=영업팀')).toBeVisible();
      await expect(page.locator('text=이상 없음. 승인합니다.')).toBeVisible();
      await expect(page.locator('text=승인 완료').first()).toBeVisible();
    });
  });

  // ── ctr_003: 1단계 승인, 2단계 대기 ─────────────────────────────

  test.describe('ctr_003 (부분 승인)', () => {
    test('1단계 승인 + 2단계 대기 상태', async ({ page }) => {
      await page.goto('/contracts/ctr_003');
      await page.waitForSelector('text=C사_기본계약서_v1.docx');
      await page.click('button:has-text("워크플로우")');
      await expect(page.locator('text=계약팀')).toBeVisible();
      await expect(page.locator('text=담당임원')).toBeVisible();
    });
  });
});
