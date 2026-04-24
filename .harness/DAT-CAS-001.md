# DAT-CAS-001 — Contract Agent System 데이터 모델

> 문서 타입: DAT (데이터)
> 도메인: CAS (Contract Agent System)
> 버전: v1.1 | 작성일: 2026-04-23
> DB: Amazon DynamoDB (ap-northeast-2) + Amazon S3 (파일 저장)

---

## 1. 스토리지 구조

| 저장소 | 용도 | 리소스명 |
|--------|------|---------|
| Amazon S3 | DOCX 파일 원본 보관 | `cas-contracts` 버킷 |
| DynamoDB | 계약서 메타데이터 + 분석 결과 | `cas-contracts` 테이블 |
| DynamoDB | 리스크 리포트 + 조항별 리스크 | `cas-risk-reports` 테이블 |
| DynamoDB | 워크플로우 검토 단계 | `cas-workflow-steps` 테이블 |

---

## 2. S3 파일 저장 구조

```
버킷: cas-contracts (ap-northeast-2)
  └── {contract_id}.docx    ← 업로드된 DOCX 원본
```

**boto3 업로드 패턴**
```python
s3 = boto3.client("s3", region_name="ap-northeast-2")
s3.put_object(
    Bucket="cas-contracts",
    Key=f"{contract_id}.docx",
    Body=file_bytes
)
# s3_key = f"{contract_id}.docx" → DynamoDB에 저장
```

---

## 3. DynamoDB 테이블: cas-contracts

**키 구조**
| 키 | 속성명 | 타입 |
|----|--------|------|
| 파티션 키(PK) | `id` | String |

**아이템 구조**
```json
{
  "id": "uuid-v4",
  "customer_name": "고객사명 (lower + trim 정규화)",
  "contract_type": "NDA | MSA | SI | SLA | Maintenance | Other",
  "version": 1,
  "status": "DRAFT | PARSING | REVIEWING | PENDING_APPROVAL | APPROVED | REJECTED | ERROR",
  "s3_key": "uuid.docx",
  "uploaded_at": "2026-04-23T10:00:00Z",
  "uploaded_by": "demo_user",
  "clauses": [
    {
      "id": "uuid-v4",
      "clause_type": "liability | ip | confidentiality | termination | dispute | penalty | other",
      "title": "조항명",
      "content": "원문 텍스트",
      "paragraph": 3
    }
  ],
  "diff_report": {
    "previous_contract_id": "uuid-v4",
    "diff_summary": "변경사항 요약",
    "risk_change": "LOW→HIGH | 동일 | 개선",
    "changes": [
      {
        "clause_id": "uuid",
        "change_type": "ADDED | REMOVED | MODIFIED",
        "previous_content": "...",
        "current_content": "...",
        "risk_impact": "리스크 증가 | 리스크 감소 | 중립",
        "highlight": "핵심 변경 포인트"
      }
    ]
  }
}
```

> `clauses`, `diff_report`는 DynamoDB List/Map 타입으로 중첩 저장.
> Diff 없는 경우 `diff_report` 필드 생략.

---

## 4. DynamoDB 테이블: cas-risk-reports

**키 구조**
| 키 | 속성명 | 타입 |
|----|--------|------|
| 파티션 키(PK) | `id` | String |
| GSI | `contract_id` | String |

**아이템 구조**
```json
{
  "id": "uuid-v4",
  "contract_id": "uuid-v4",
  "overall_risk": "HIGH | MEDIUM | LOW",
  "risk_summary": "전체 요약 1~2문장",
  "standard_deviation": "메가존 표준 계약 대비 주요 차이점",
  "key_concerns": ["우려사항1", "우려사항2", "우려사항3"],
  "created_at": "2026-04-23T10:05:00Z",
  "clause_risks": [
    {
      "id": "uuid-v4",
      "clause_id": "uuid-v4",
      "risk_level": "HIGH | MEDIUM | LOW",
      "risk_type": "무제한_배상책임 | IP_완전이전 | 일방적_해지권 | 과도한_페널티 | 기타",
      "reason": "위험 근거",
      "recommendation": "수정 제안",
      "financial_impact": "예상 손익 영향"
    }
  ]
}
```

---

## 5. DynamoDB 테이블: cas-workflow-steps

**키 구조**
| 키 | 속성명 | 타입 |
|----|--------|------|
| 파티션 키(PK) | `id` | String |
| GSI | `contract_id` | String |

**아이템 구조**
```json
{
  "id": "uuid-v4",
  "contract_id": "uuid-v4",
  "step_order": 1,
  "department": "법무팀 | 팀장 | 본부장 | 재무팀 | 기술법무",
  "assignee": "담당자명",
  "status": "PENDING | APPROVED | REJECTED",
  "comment": "검토 의견 (선택)",
  "signed_at": "2026-04-23T11:00:00Z",
  "created_at": "2026-04-23T10:05:00Z"
}
```

---

## 6. boto3 공통 패턴

```python
import boto3

dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")

# 저장
table = dynamodb.Table("cas-contracts")
table.put_item(Item={...})

# 조회
response = table.get_item(Key={"id": contract_id})
item = response.get("Item")

# GSI 조회 (contract_id 기준)
table = dynamodb.Table("cas-workflow-steps")
response = table.query(
    IndexName="contract_id-index",
    KeyConditionExpression="contract_id = :cid",
    ExpressionAttributeValues={":cid": contract_id}
)
```
