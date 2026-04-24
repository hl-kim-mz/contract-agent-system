# WFR-CAS-001 — Contract Agent System 화면 흐름

> 문서 타입: WFR (와이어프레임/화면 흐름)
> 도메인: CAS (Contract Agent System)
> 버전: v1.0 | 작성일: 2026-04-23

---

## 1. 화면 목록

| 화면 ID | 화면명 | 경로 | 연결 API |
|---------|--------|------|----------|
| SCR-001 | 대시보드 | `/` | GET /contracts |
| SCR-002 | 계약서 업로드 | `/upload` | POST /contracts/upload |
| SCR-003 | 분석 진행 | `/contracts/:id/analyze` | GET /contracts/:id (폴링) |
| SCR-004 | 계약서 상세 | `/contracts/:id` | GET /contracts/:id |
| SCR-005 | 리스크 리포트 | `/contracts/:id/report` | GET /contracts/:id/report |
| SCR-006 | Diff 뷰 | `/contracts/:id/diff` | GET /contracts/:id/diff |
| SCR-007 | 워크플로우 | `/contracts/:id/workflow` | GET/POST /contracts/:id/workflow |

---

## 2. 화면 흐름 다이어그램

```
[SCR-001 대시보드]
  ├─ "새 계약서 업로드" 클릭 ──────────────────→ [SCR-002 업로드]
  └─ 목록에서 계약서 클릭 ─────────────────────→ [SCR-004 계약서 상세]

[SCR-002 업로드]
  └─ DOCX 업로드 + 정보 입력 + "분석 시작" 클릭
       → POST /contracts/upload
       → POST /contracts/:id/analyze
       → [SCR-003 분석 진행]

[SCR-003 분석 진행]  ← 폴링: GET /contracts/:id (2초 간격)
  ├─ status: PARSING    → "파싱 중..." 표시
  ├─ status: REVIEWING  → "리스크 분석 중..." 표시
  ├─ status: PENDING_APPROVAL → [SCR-005 리스크 리포트]로 자동 이동
  └─ status: ERROR      → 오류 메시지 + "재시도" 버튼

[SCR-004 계약서 상세]
  ├─ "리스크 리포트" 탭 클릭 ─────────────────→ [SCR-005 리스크 리포트]
  ├─ "Diff 뷰" 탭 클릭 ───────────────────────→ [SCR-006 Diff 뷰]
  └─ "워크플로우" 탭 클릭 ────────────────────→ [SCR-007 워크플로우]

[SCR-005 리스크 리포트]
  └─ "검토 진행" 클릭 ─────────────────────────→ [SCR-007 워크플로우]

[SCR-006 Diff 뷰]
  └─ (이전 버전 없으면 "Diff 없음" 안내 메시지)

[SCR-007 워크플로우]
  ├─ "승인" 클릭 → POST /workflow/:step_id/approve → 다음 단계로 진행
  ├─ "반려" 클릭 → POST /workflow/:step_id/reject  → contract.status = REJECTED
  └─ 모든 단계 APPROVED → contract.status = APPROVED → 완료 배지 표시
```

---

## 3. 화면별 주요 UI 요소

### SCR-001 대시보드
- 계약서 목록 테이블: 고객사명 / 계약 유형 / 버전 / 상태 배지 / 업로드일
- 상태 필터: 전체 / PENDING_APPROVAL / APPROVED / ERROR
- 전체 현황 요약 카드: 전체 건수 / HIGH 리스크 건수 / 대기 승인 건수

### SCR-002 업로드
- DOCX 드래그&드롭 영역 (파일명·크기 미리보기)
- 고객사명 입력 (text input)
- 계약 유형 선택 (select: NDA/MSA/SI/SLA/Maintenance/Other)
- "분석 시작" 버튼

### SCR-003 분석 진행
- Agent 단계별 진행 상태 (스피너 → 체크 아이콘):
  1. 문서 파싱
  2. 리스크 분석
  3. 검토 라우팅 생성
- 단계별 완료 시 체크 표시 (폴링 기반)

### SCR-005 리스크 리포트
- 전체 리스크 레벨 배지 (HIGH/MEDIUM/LOW 색상)
- 핵심 우려사항 3개 요약 카드
- 조항별 리스크 목록 (리스크 레벨 / 유형 / 근거 / 권고사항)
- 메가존 표준 계약 대비 차이점 섹션

### SCR-006 Diff 뷰
- 변경사항 요약 + 리스크 변화 방향 (↑↓→)
- 조항별 diff: 이전/현재 텍스트 2단 비교 (추가=초록, 삭제=빨강, 수정=노랑)

### SCR-007 워크플로우
- 검토 단계 목록 (순서 / 부서 / 담당자 / 상태 / 승인일시)
- 현재 단계: "승인" / "반려" 버튼 + 의견 입력창
- 완료 시 Mock 서명 타임스탬프 표시

---

## 4. 데모 시나리오 흐름 (해커톤 발표용)

```
1. SCR-001 → 계약서 목록 확인 (사전 업로드 샘플 2건 표시)
2. SCR-002 → 새 계약서 DOCX 업로드
3. SCR-003 → 3단계 분석 진행 실시간 확인
4. SCR-005 → HIGH 리스크 3건 리포트 확인
5. SCR-006 → 이전 버전 대비 페널티 조항 변경 시각화
6. SCR-007 → 법무팀 승인 → Mock 서명 완료
```
