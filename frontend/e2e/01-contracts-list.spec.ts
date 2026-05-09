import { test, expect } from '@playwright/test';

test.describe('계약서 목록 페이지 (/contracts)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForSelector('h1:has-text("계약서 관리")');
  });

  // ── GET /contracts ──────────────────────────────────────────────

  test('페이지 로딩 및 헤더 렌더링', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('계약서 관리');
    await expect(page.locator('text=MZC 계약 검토 및 리스크 분석 현황')).toBeVisible();
  });

  test('계약서 목록 5건 표시', async ({ page }) => {
    const rows = page.locator('div[style*="gridTemplateColumns"] >> nth=1').locator('..');
    await expect(page.locator('text=A사_SI도급계약서_v2.docx')).toBeVisible();
    await expect(page.locator('text=B사_비밀유지계약서_v1.docx')).toBeVisible();
    await expect(page.locator('text=C사_기본계약서_v1.docx')).toBeVisible();
    await expect(page.locator('text=D물류_유지보수계약서_v3.docx')).toBeVisible();
    await expect(page.locator('text=E테크_시스템구축계약서_v1.docx')).toBeVisible();
  });

  test('통계 카드 4개 표시', async ({ page }) => {
    await expect(page.locator('p:has-text("전체 계약")')).toBeVisible();
    await expect(page.locator('p:has-text("HIGH 리스크")')).toBeVisible();
    await expect(page.locator('p:has-text("결재 대기")')).toBeVisible();
    await expect(page.locator('p:has-text("승인 완료")')).toBeVisible();
  });

  test('고객사명 표시', async ({ page }) => {
    await expect(page.locator('text=주식회사 A사')).toBeVisible();
    await expect(page.locator('text=주식회사 B사')).toBeVisible();
    await expect(page.locator('text=주식회사 C사')).toBeVisible();
  });

  test('리스크 배지 표시 (HIGH, MED, LOW)', async ({ page }) => {
    await expect(page.locator('span:has-text("HIGH")').first()).toBeVisible();
    await expect(page.locator('span:has-text("LOW")').first()).toBeVisible();
    await expect(page.locator('span:has-text("MED")').first()).toBeVisible();
  });

  // ── 상태 필터 ───────────────────────────────────────────────────

  test('필터 탭 전체 렌더링', async ({ page }) => {
    for (const label of ['전체', '분석 중', '검토 대기', '결재 대기', '승인 완료', '반려']) {
      await expect(page.locator(`button:has-text("${label}")`)).toBeVisible();
    }
  });

  test('필터: 승인 완료 선택 시 B사만 표시', async ({ page }) => {
    await page.click('button:has-text("승인 완료")');
    await expect(page.locator('text=B사_비밀유지계약서_v1.docx')).toBeVisible();
    await expect(page.locator('text=A사_SI도급계약서_v2.docx')).not.toBeVisible();
  });

  test('필터: 반려 선택 시 E테크만 표시', async ({ page }) => {
    await page.click('button:has-text("반려")');
    await expect(page.locator('text=E테크_시스템구축계약서_v1.docx')).toBeVisible();
    await expect(page.locator('text=A사_SI도급계약서_v2.docx')).not.toBeVisible();
  });

  test('필터: 전체로 복귀 시 모든 계약서 표시', async ({ page }) => {
    await page.click('button:has-text("반려")');
    await page.click('button:has-text("전체")');
    await expect(page.locator('text=A사_SI도급계약서_v2.docx')).toBeVisible();
    await expect(page.locator('text=E테크_시스템구축계약서_v1.docx')).toBeVisible();
  });

  // ── 계약서 업로드 모달 (POST /contracts/analyze) ─────────────────

  test('업로드 버튼 존재', async ({ page }) => {
    await expect(page.locator('button:has-text("계약서 업로드")')).toBeVisible();
  });

  test('드래그 영역 존재', async ({ page }) => {
    await expect(page.locator('text=DOCX / PDF 파일을 드래그하거나 클릭해서 업로드')).toBeVisible();
  });

  // ── 계약서 클릭 → 상세 네비게이션 ──────────────────────────────

  test('계약서 클릭 시 상세 페이지 이동', async ({ page }) => {
    await page.locator('text=A사_SI도급계약서_v2.docx').click();
    await page.waitForURL('**/contracts/ctr_001');
    await expect(page).toHaveURL(/\/contracts\/ctr_001/);
  });

  // ── 금액 포맷 표시 ─────────────────────────────────────────────

  test('금액 포맷 (억원 단위) 표시', async ({ page }) => {
    await expect(page.locator('span:has-text("억원")').first()).toBeVisible();
  });
});
