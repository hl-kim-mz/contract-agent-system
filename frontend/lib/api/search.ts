// lib/api/search.ts
// Feature: 히스토리 검색 패널 (/contracts/:id — 우측 검색 패널)
// Screen: ContractDetailPage > 우측 SearchPanel
// Backend: GET /search?query=&customer= → Bedrock Knowledge Bases

export interface SearchSource {
  contract_id: string;
  customer_name: string;
  version: number;
  clause_content: string;
  relevance_score?: number;
}

export interface SearchResult {
  answer: string;
  sources: SearchSource[];
}

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── Mock 응답 (쿼리별 시나리오) ─────────────────────────────────
const MOCK_RESPONSES: { keywords: string[]; answer: string; sources: SearchSource[] }[] = [
  {
    keywords: ['CR', '변경요청', '범위변경'],
    answer: 'A사와의 과거 계약(v1)에서 CR 절차는 "양 당사자 서면 합의 후 추가 비용 정산" 방식으로 처리되었습니다. 당시 지체상금율은 0.1%/일이었으며 배상한도는 계약금액의 100%로 설정되어 있었습니다.',
    sources: [
      { contract_id: 'ctr_001', customer_name: 'A사', version: 1, clause_content: '용역 범위 변경은 양 당사자의 서면 합의로 처리하며, 추가 비용과 일정은 별도 변경계약서를 통해 정산한다.', relevance_score: 0.94 },
    ],
  },
  {
    keywords: ['배상', '배상한도', '손해배상'],
    answer: '과거 계약 이력을 확인한 결과, MZC는 주요 계약에서 "계약금액의 100% 이내"를 배상한도로 설정해왔습니다. B사 NDA(v1)에서는 "간접손해 제외" 조건이 명시되어 있습니다.',
    sources: [
      { contract_id: 'ctr_002', customer_name: 'B사', version: 1, clause_content: '배상책임은 계약금액의 100%를 초과하지 않으며, 간접손해 및 결과적 손해는 배상 범위에서 제외한다.', relevance_score: 0.91 },
    ],
  },
  {
    keywords: ['지체상금', '페널티'],
    answer: 'MZC 표준 계약에서 지체상금율은 0.05%/일 이하로 설정되어 왔습니다. 과거 A사 계약(v1)에서는 0.1%/일이었으나 협상을 통해 0.05%/일로 조정한 사례가 있습니다.',
    sources: [
      { contract_id: 'ctr_001', customer_name: 'A사', version: 1, clause_content: '지체일수 1일당 계약금액의 0.05%에 해당하는 지체상금을 지급한다. 총액은 계약금액의 10%를 초과하지 않는다.', relevance_score: 0.88 },
    ],
  },
];

// ─── API 함수 ─────────────────────────────────────────────────────

/**
 * 계약 히스토리 자연어 검색
 * Real: GET /search?query={query}&customer={customerName}
 * → Bedrock Knowledge Bases retrieve_and_generate
 */
export async function searchHistory(query: string, customerName?: string): Promise<SearchResult> {
  if (USE_MOCK) {
    await delay(800);
    const q = query.toLowerCase();
    const matched = MOCK_RESPONSES.find(r => r.keywords.some(k => q.includes(k)));
    if (matched) {
      return { answer: matched.answer, sources: matched.sources };
    }
    return {
      answer: `"${query}"에 대한 과거 계약 이력입니다. ${customerName ? `${customerName}과의 ` : ''}계약에서 관련 조항을 찾지 못했습니다. 다른 키워드로 검색해 보세요.`,
      sources: [],
    };
  }
  const params = new URLSearchParams({ query });
  if (customerName) params.append('customer', customerName);
  const res = await fetch(`${API_BASE}/search?${params}`);
  const json = await res.json();
  return json.data as SearchResult;
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
