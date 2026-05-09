// lib/api/comments.ts
// 계약서별 댓글(코멘트) API — Mock ↔ Real 전환 포인트

export interface TeamMember {
  id: string;
  name: string;
  department: string;
  initials: string;
  color: string; // avatar bg color
}

export interface Comment {
  id: string;
  contract_id: string;
  author: TeamMember;
  content: string;           // @멘션 포함 원문
  mentions: string[];        // 언급된 팀원 ID 목록
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;  // null이면 최상위, 값이 있으면 답글
  clause_ref: string | null; // 특정 조항 참조 (예: "clause_003")
}

// ─── 팀원 목록 (Mock — 실제로는 /users 또는 /team-members API) ────
export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'usr_001', name: '김영업', department: '영업팀',  initials: '김영', color: '#1d4ed8' },
  { id: 'usr_002', name: '박계약', department: '계약팀',  initials: '박계', color: '#16a34a' },
  { id: 'usr_003', name: '이법무', department: '법무팀',  initials: '이법', color: '#7c3aed' },
  { id: 'usr_004', name: '최재무', department: '재무팀',  initials: '최재', color: '#d97706' },
  { id: 'usr_005', name: '정본부', department: '본부장실', initials: '정본', color: '#0891b2' },
];

// ─── Mock 댓글 데이터 ─────────────────────────────────────────────
let MOCK_COMMENTS: Record<string, Comment[]> = {
  ctr_001: [
    {
      id: 'cmt_001',
      contract_id: 'ctr_001',
      author: TEAM_MEMBERS[0], // 김영업
      content: '@박계약 고객사에서 오늘 계약서 수정본 보내왔습니다. 제3조 배상 조항이 문제인데 검토 부탁드립니다.',
      mentions: ['usr_002'],
      created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      updated_at: null,
      parent_id: null,
      clause_ref: 'clause_003',
    },
    {
      id: 'cmt_002',
      contract_id: 'ctr_001',
      author: TEAM_MEMBERS[1], // 박계약
      content: '확인했습니다. 배상한도 미설정은 저희 표준에서 벗어나서 수정 요청해야 합니다. @이법무 법무팀 의견도 필요할 것 같아요.',
      mentions: ['usr_003'],
      created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      updated_at: null,
      parent_id: 'cmt_001',
      clause_ref: 'clause_003',
    },
    {
      id: 'cmt_003',
      contract_id: 'ctr_001',
      author: TEAM_MEMBERS[2], // 이법무
      content: '제4조 지체상금 0.15%는 과도합니다. AI 분석 결과대로 0.05% 이하로 협상하는 게 맞고, CR 절차(제5조)도 서면 합의 조항 반드시 추가해야 합니다. @김영업 고객사에 수정안 전달해주세요.',
      mentions: ['usr_001'],
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      updated_at: null,
      parent_id: null,
      clause_ref: null,
    },
    {
      id: 'cmt_004',
      contract_id: 'ctr_001',
      author: TEAM_MEMBERS[3], // 최재무
      content: '계약금액 20억이라 재무팀 병렬 검토 필요합니다. @정본부 내일 회의 전에 검토 의견 올리겠습니다.',
      mentions: ['usr_005'],
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      updated_at: null,
      parent_id: null,
      clause_ref: null,
    },
  ],
  ctr_002: [
    {
      id: 'cmt_010',
      contract_id: 'ctr_002',
      author: TEAM_MEMBERS[0],
      content: 'NDA 검토 완료됐습니다. 비밀유지 기간 2년인 부분만 3년으로 조정 요청했습니다.',
      mentions: [],
      created_at: new Date(Date.now() - 86000000).toISOString(),
      updated_at: null,
      parent_id: null,
      clause_ref: null,
    },
  ],
};

let commentIdCounter = 100;

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── API 함수 ─────────────────────────────────────────────────────

/** 댓글 목록 조회 */
export async function getComments(contractId: string): Promise<Comment[]> {
  if (USE_MOCK) {
    await delay(200);
    return (MOCK_COMMENTS[contractId] ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/comments`);
  const json = await res.json();
  return json.data as Comment[];
}

/** 댓글 작성 */
export async function createComment(
  contractId: string,
  payload: { content: string; mentions: string[]; parent_id?: string | null; clause_ref?: string | null; author_id?: string }
): Promise<Comment> {
  if (USE_MOCK) {
    await delay(300);
    const author = TEAM_MEMBERS.find(m => m.id === (payload.author_id ?? 'usr_001')) ?? TEAM_MEMBERS[0];
    const newComment: Comment = {
      id: `cmt_${++commentIdCounter}`,
      contract_id: contractId,
      author,
      content: payload.content,
      mentions: payload.mentions ?? [],
      created_at: new Date().toISOString(),
      updated_at: null,
      parent_id: payload.parent_id ?? null,
      clause_ref: payload.clause_ref ?? null,
    };
    if (!MOCK_COMMENTS[contractId]) MOCK_COMMENTS[contractId] = [];
    MOCK_COMMENTS[contractId].push(newComment);
    return newComment;
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return json.data as Comment[];
}

/** 댓글 삭제 */
export async function deleteComment(contractId: string, commentId: string): Promise<void> {
  if (USE_MOCK) {
    await delay(200);
    MOCK_COMMENTS[contractId] = (MOCK_COMMENTS[contractId] ?? []).filter(c => c.id !== commentId);
    return;
  }
  await fetch(`${API_BASE}/contracts/${contractId}/comments/${commentId}`, { method: 'DELETE' });
}

// ─── 유틸 ────────────────────────────────────────────────────────

/** content 문자열에서 @멘션 파싱 → 멘션된 팀원 ID 추출 */
export function extractMentions(content: string): string[] {
  const names = TEAM_MEMBERS.map(m => m.name);
  const found: string[] = [];
  for (const member of TEAM_MEMBERS) {
    if (content.includes(`@${member.name}`)) found.push(member.id);
  }
  return found;
}

/** content 문자열의 @멘션을 하이라이트 span 배열로 변환 (React 렌더링용) */
export function parseContentWithMentions(content: string): Array<{ type: 'text' | 'mention'; value: string; memberId?: string }> {
  const parts: Array<{ type: 'text' | 'mention'; value: string; memberId?: string }> = [];
  let remaining = content;

  while (remaining.length > 0) {
    let earliest = -1;
    let earliestMember: TeamMember | null = null;

    for (const m of TEAM_MEMBERS) {
      const idx = remaining.indexOf(`@${m.name}`);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        earliestMember = m;
      }
    }

    if (earliest === -1 || !earliestMember) {
      parts.push({ type: 'text', value: remaining });
      break;
    }

    if (earliest > 0) {
      parts.push({ type: 'text', value: remaining.slice(0, earliest) });
    }
    parts.push({ type: 'mention', value: `@${earliestMember.name}`, memberId: earliestMember.id });
    remaining = remaining.slice(earliest + `@${earliestMember.name}`.length);
  }

  return parts;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
