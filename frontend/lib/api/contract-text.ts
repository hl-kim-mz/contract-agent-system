// lib/api/contract-text.ts
// Feature: 원문 텍스트 뷰 (/contracts/:id — 원문 탭)
// Screen: ContractDetailPage > tab='text'
// API: GET /contracts/:id/text

export interface ParsedClause {
  id: string;          // clause_001
  type: string;        // liability | ip | ...
  title: string;       // 제N조 (조항명)
  content: string;     // 원문 텍스트 전체
  paragraph: number;
  has_risk: boolean;   // 리스크 리포트에서 탐지된 조항 여부
  risk_level?: string; // HIGH | MEDIUM | LOW
}

export interface ContractText {
  contract_id: string;
  file_name: string;
  customer_name: string;
  contract_type: string;
  raw_text_preview: string; // 상단 요약 텍스트 (계약서 앞부분)
  clauses: ParsedClause[];
  entities: {
    party_a: string | { role?: string; name: string; representative?: string | null } | null;
    party_b: string | { role?: string; name: string; representative?: string | null } | null;
    contract_date: string | null;
    total_amount: string | null;
    contract_period: string | null;
  };
}

const MOCK: Record<string, ContractText> = {
  ctr_001: {
    contract_id: 'ctr_001',
    file_name: 'A사_SI도급계약서_v2.docx',
    customer_name: '주식회사 A사',
    contract_type: 'SI',
    raw_text_preview: `소프트웨어 개발 용역 계약서

본 계약은 주식회사 A사(이하 '갑')와 메가존클라우드 주식회사(이하 '을') 간에 2026년 5월 30일 다음과 같이 체결한다.

갑: 주식회사 A사 / 대표이사 홍길동 / 서울특별시 강남구 테헤란로 123
을: 메가존클라우드 주식회사 / 대표이사 이주완 / 경기도 과천시 코오롱로 100

계약금액: 금 이십억원정 (₩2,000,000,000)
계약기간: 2026년 6월 1일 ~ 2026년 12월 31일 (7개월)`,
    entities: {
      party_a: '주식회사 A사',
      party_b: '메가존클라우드 주식회사',
      contract_date: '2026-05-30',
      total_amount: '2,000,000,000원',
      contract_period: '2026-06-01 ~ 2026-12-31',
    },
    clauses: [
      { id: 'clause_001', type: 'other', title: '제1조 (목적)', paragraph: 1, has_risk: false,
        content: '본 계약은 갑이 발주하는 차세대 클라우드 플랫폼 구축의 개발 용역에 관한 제반 사항을 정함을 목적으로 한다.' },
      { id: 'clause_002', type: 'ip', title: '제2조 (지식재산권)', paragraph: 2, has_risk: true, risk_level: 'HIGH',
        content: '본 계약에 의하여 개발된 소프트웨어, 소스코드, 설계문서, 데이터베이스 스키마 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다. 을이 기존에 보유한 기술 및 라이브러리를 포함한 모든 결과물의 권리를 갑이 소유한다.' },
      { id: 'clause_003', type: 'liability', title: '제3조 (손해배상)', paragraph: 3, has_risk: true, risk_level: 'HIGH',
        content: '을의 귀책사유로 인하여 갑에게 손해가 발생한 경우, 을은 그 손해의 전부를 배상하여야 한다. 배상액의 상한은 없으며, 간접손해 및 영업손실을 포함한 모든 손해를 포함한다.' },
      { id: 'clause_004', type: 'penalty', title: '제4조 (지체상금)', paragraph: 4, has_risk: true, risk_level: 'MEDIUM',
        content: '을이 납기일까지 용역을 완료하지 못하는 경우, 을은 지체일수 1일당 계약금액의 0.15%에 해당하는 지체상금을 갑에게 지급하여야 한다. 지체상금은 계약금액의 30%를 한도로 한다.' },
      { id: 'clause_005', type: 'change_request', title: '제5조 (변경요청)', paragraph: 5, has_risk: true, risk_level: 'HIGH',
        content: '갑은 프로젝트 진행 중 언제든지 요구사항을 변경할 수 있다. 을은 갑의 변경 요청에 성실히 응하여야 하며, 변경으로 인한 추가 비용 및 일정은 별도 협의한다.' },
      { id: 'clause_006', type: 'dispute', title: '제6조 (분쟁 해결)', paragraph: 6, has_risk: true, risk_level: 'MEDIUM',
        content: '본 계약과 관련하여 분쟁이 발생한 경우, 갑의 소재지를 관할하는 법원을 전속 관할 법원으로 한다.' },
      { id: 'clause_007', type: 'termination', title: '제7조 (계약의 해지)', paragraph: 7, has_risk: false,
        content: '갑 또는 을은 상대방이 본 계약의 중요한 조항을 위반하고, 서면 통지 후 30일 이내에 이를 시정하지 않는 경우 본 계약을 해지할 수 있다.' },
      { id: 'clause_008', type: 'confidentiality', title: '제8조 (비밀유지)', paragraph: 8, has_risk: false,
        content: '양 당사자는 본 계약과 관련하여 취득한 상대방의 기술, 영업, 재무 등에 관한 정보를 제3자에게 누설하거나 본 계약 목적 외에 사용하여서는 아니 된다. 비밀유지 의무는 계약 종료 후 3년간 존속한다.' },
    ],
  },
  ctr_002: {
    contract_id: 'ctr_002', file_name: 'B사_비밀유지계약서_v1.docx',
    customer_name: '주식회사 B사', contract_type: 'NDA',
    raw_text_preview: `비밀유지계약서

본 비밀유지계약서는 주식회사 B사(이하 '갑')와 메가존클라우드 주식회사(이하 '을') 간에 체결한다.`,
    entities: { party_a: '주식회사 B사', party_b: '메가존클라우드 주식회사', contract_date: '2026-05-01', total_amount: null, contract_period: null },
    clauses: [
      { id: 'clause_001', type: 'other', title: '제1조 (목적)', paragraph: 1, has_risk: false,
        content: '본 계약은 양 당사자가 클라우드 서비스 도입 검토를 위해 상호 교환하는 비밀정보를 보호하고 이용 범위를 정함을 목적으로 한다.' },
      { id: 'clause_002', type: 'confidentiality', title: '제2조 (비밀정보의 정의)', paragraph: 2, has_risk: false,
        content: '비밀정보라 함은 일방 당사자가 상대방에게 비밀로 표시하여 제공하는 기술적, 영업적, 재무적 정보 및 이에 준하는 일체의 정보를 의미한다.' },
      { id: 'clause_003', type: 'confidentiality', title: '제3조 (비밀유지 의무)', paragraph: 3, has_risk: false,
        content: '각 당사자는 상대방으로부터 제공받은 비밀정보를 본 계약의 목적 범위 내에서만 이용하고, 상대방의 사전 서면 동의 없이 제3자에게 누설하거나 공개하여서는 아니 된다.' },
      { id: 'clause_004', type: 'confidentiality', title: '제4조 (비밀유지 기간)', paragraph: 4, has_risk: true, risk_level: 'LOW',
        content: '본 계약에 따른 비밀유지 의무는 계약 체결일로부터 2년간 존속한다. 계약이 종료된 이후에도 비밀정보는 동일하게 보호된다.' },
    ],
  },
};

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** 계약서 원문 텍스트 및 파싱 조항 조회 — GET /contracts/:id/text */
export async function getContractText(contractId: string): Promise<ContractText | null> {
  if (USE_MOCK) { await delay(300); return MOCK[contractId] ?? null; }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/text`);
  if (res.status === 404) return null;
  const json = await res.json();
  return json.data as ContractText;
}

export const CLAUSE_TYPE_LABEL: Record<string, string> = {
  liability:      '손해배상',
  ip:             '지식재산권',
  confidentiality:'비밀유지',
  termination:    '해지/해제',
  dispute:        '분쟁해결',
  penalty:        '지체/위약',
  warranty:       '하자보수',
  change_request: '변경요청(CR)',
  renewal:        '갱신조건',
  other:          '일반',
};

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
