import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 버전 비교 탭 (GET /contracts/:id/diff)', () => {

  // ── ctr_001: Diff 존재 ──────────────────────────────────────────

  test.describe('ctr_001 (v1→v2 diff 존재)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contracts/ctr_001');
      await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
      await page.click('button:has-text("버전 비교")');
    });

    test('Diff 탭 전환 및 요약 표시', async ({ page }) => {
      await expect(page.locator('text=v1 → v2')).toBeVisible();
      await expect(page.locator('text=MEDIUM→HIGH')).toBeVisible();
    });

    test('변경 요약 텍스트 표시', async ({ page }) => {
      await expect(page.locator('text=지체상금율이 0.1%→0.15%/일로')).toBeVisible();
    });

    test('범례 (추가, 삭제, 수정, 유지) 표시', async ({ page }) => {
      await expect(page.locator('span:has-text("추가")').first()).toBeVisible();
      await expect(page.locator('span:has-text("수정")').first()).toBeVisible();
      await expect(page.locator('span:has-text("유지")').first()).toBeVisible();
    });

    test('조항별 Diff 5건 표시', async ({ page }) => {
      await expect(page.locator('text=제3조 (손해배상)')).toBeVisible();
      await expect(page.locator('text=제4조 (지체상금)')).toBeVisible();
      await expect(page.locator('text=제5조 (변경요청)')).toBeVisible();
      await expect(page.locator('text=제1조 (목적)')).toBeVisible();
      await expect(page.locator('text=제2조 (지식재산권)')).toBeVisible();
    });

    test('리스크 증가 표시 (▲ 위험 증가)', async ({ page }) => {
      const riskUp = page.locator('text=▲ 위험 증가');
      await expect(riskUp.first()).toBeVisible();
    });

    test('MODIFIED 조항 클릭 → 이전/현재 내용 비교', async ({ page }) => {
      await page.locator('button:has-text("제3조 (손해배상)")').click();
      await expect(page.locator('text=이전 v1')).toBeVisible();
      await expect(page.locator('text=현재 v2')).toBeVisible();
      await expect(page.locator('text=주요 변경')).toBeVisible();
    });

    test('ADDED 조항 클릭 → 현재 내용만 표시', async ({ page }) => {
      await page.locator('button:has-text("제5조 (변경요청)")').click();
      await expect(page.locator('text=현재 v2')).toBeVisible();
      await expect(page.locator('text=갑은 계약 체결 후 언제든지')).toBeVisible();
    });
  });

  // ── ctr_002: Diff 없음 ─────────────────────────────────────────

  test.describe('ctr_002 (v1만 존재, diff 없음)', () => {
    test('Diff 데이터 없을 때 빈 상태 표시', async ({ page }) => {
      await page.goto('/contracts/ctr_002');
      await page.waitForSelector('text=B사_비밀유지계약서_v1.docx');
      await page.click('button:has-text("버전 비교")');
      await expect(page.locator('text=이전 버전이 없습니다.')).toBeVisible();
    });
  });
});
