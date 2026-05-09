import { test, expect } from '@playwright/test';

test.describe('계약 상세 — 리스크 리포트 탭 (GET /contracts/:id/report)', () => {

  // ── ctr_001: HIGH 리스크 ────────────────────────────────────────

  test.describe('ctr_001 (HIGH 리스크)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contracts/ctr_001');
      await page.waitForSelector('text=A사_SI도급계약서_v2.docx');
    });

    test('헤더 - 파일명, 버전, 리스크 배지 표시', async ({ page }) => {
      await expect(page.locator('h1:has-text("A사_SI도급계약서_v2.docx")')).toBeVisible();
      await expect(page.getByText('v2', { exact: true })).toBeVisible();
      await expect(page.locator('span:has-text("HIGH 리스크")').first()).toBeVisible();
    });

    test('상태 Progress Bar 표시', async ({ page }) => {
      await expect(page.locator('text=업로드')).toBeVisible();
      await expect(page.locator('text=AI 분석')).toBeVisible();
      await expect(page.locator('text=검토 대기')).toBeVisible();
    });

    test('브레드크럼 - 계약서 목록 링크', async ({ page }) => {
      await expect(page.locator('button:has-text("계약서 목록")')).toBeVisible();
    });

    test('리포트 탭 기본 선택 상태', async ({ page }) => {
      await expect(page.locator('button:has-text("리스크 리포트")')).toBeVisible();
    });

    test('전체 리스크 요약 카드 표시', async ({ page }) => {
      await expect(page.locator('text=비표준 SI 도급 계약서로')).toBeVisible();
      await expect(page.locator('text=에스컬레이션 필요')).toBeVisible();
    });

    test('핵심 우려사항 3건 표시', async ({ page }) => {
      await expect(page.locator('text=배상한도 미설정').first()).toBeVisible();
      await expect(page.locator('text=IP 전부 이전').first()).toBeVisible();
      await expect(page.locator('text=CR 절차 미정의').first()).toBeVisible();
    });

    test('계약 정보 요약 (고객사, 금액, 일자)', async ({ page }) => {
      await expect(page.locator('p:has-text("고객사")').first()).toBeVisible();
      await expect(page.locator('text=주식회사 A사').first()).toBeVisible();
      await expect(page.locator('p:has-text("계약금액")').first()).toBeVisible();
    });

    test('조항별 리스크 5건 목록', async ({ page }) => {
      await expect(page.locator('h3:has-text("조항별 리스크")')).toBeVisible();
      await expect(page.locator('button:has-text("무제한 배상책임")')).toBeVisible();
      await expect(page.locator('button:has-text("IP 완전이전")')).toBeVisible();
      await expect(page.locator('button:has-text("CR 절차 미정의")')).toBeVisible();
      await expect(page.locator('button:has-text("과도한 지체상금")')).toBeVisible();
      await expect(page.locator('button:has-text("분쟁 관할 불리")')).toBeVisible();
    });

    test('조항 리스크 클릭 → 상세 펼치기 (위험 근거, 수정 권고, 재무 영향)', async ({ page }) => {
      await page.locator('button:has-text("무제한 배상책임")').click();
      await expect(page.locator('text=위험 근거')).toBeVisible();
      await expect(page.locator('text=수정 권고안')).toBeVisible();
      await expect(page.locator('text=재무 영향')).toBeVisible();
      await expect(page.locator('text=배상한도가 설정되지 않았습니다')).toBeVisible();
    });

    test('MZC 표준 대비 메시지 표시', async ({ page }) => {
      await expect(page.locator('text=MZC 표준 대비')).toBeVisible();
      await expect(page.locator('text=비표준 고객사 양식')).toBeVisible();
    });
  });

  // ── ctr_002: LOW 리스크 ─────────────────────────────────────────

  test.describe('ctr_002 (LOW 리스크)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contracts/ctr_002');
      await page.waitForSelector('text=B사_비밀유지계약서_v1.docx');
    });

    test('LOW 리스크 표시', async ({ page }) => {
      await expect(page.locator('span:has-text("LOW 리스크")').first()).toBeVisible();
    });

    test('에스컬레이션 불필요 표시', async ({ page }) => {
      await expect(page.locator('text=담당자 승인 가능')).toBeVisible();
    });

    test('조항 리스크 1건 (비밀유지 기간)', async ({ page }) => {
      await expect(page.locator('text=비밀유지 기간 미정')).toBeVisible();
    });
  });
});
