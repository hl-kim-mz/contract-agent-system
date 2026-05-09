'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getComments, createComment, deleteComment,
  parseContentWithMentions, extractMentions, relativeTime,
  TEAM_MEMBERS,
  type Comment,
} from '@/lib/api/comments';

interface Props {
  contractId: string;
  currentUserId?: string; // 현재 로그인 유저 (Mock: 'usr_001')
}

export default function CommentThread({ contractId, currentUserId = 'usr_001' }: Props) {
  const [comments, setComments]     = useState<Comment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [input, setInput]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo]       = useState<Comment | null>(null);
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPos, setMentionPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await getComments(contractId);
    setComments(data);
    setLoading(false);
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  // 최신 댓글로 스크롤
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length, loading]);

  // textarea 입력 핸들링 — @ 감지
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\S*)$/);
    if (atMatch) {
      setShowMention(true);
      setMentionFilter(atMatch[1]);
      setMentionPos(cursor - atMatch[0].length);
    } else {
      setShowMention(false);
    }
  };

  const insertMention = (memberName: string) => {
    const before = input.slice(0, mentionPos);
    const after  = input.slice(textareaRef.current?.selectionStart ?? mentionPos);
    const newVal = `${before}@${memberName} ${after}`;
    setInput(newVal);
    setShowMention(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const mentions = extractMentions(input);
      const newComment = await createComment(contractId, {
        content: input.trim(),
        mentions,
        parent_id: replyTo?.id ?? null,
        author_id: currentUserId,
      });
      setComments(prev => [...prev, newComment]);
      setInput('');
      setReplyTo(null);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    await deleteComment(contractId, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  // 최상위 댓글 + 답글 구조화
  const threads = comments.filter(c => !c.parent_id);
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  const filteredMembers = TEAM_MEMBERS.filter(m =>
    m.name.includes(mentionFilter) || m.department.includes(mentionFilter)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* 댓글 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingTop: 24 }}>불러오는 중…</p>
        ) : threads.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 40, color: '#d1d5db' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>아직 댓글이 없습니다.<br/>첫 번째 댓글을 남겨보세요.</p>
          </div>
        ) : (
          threads.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={replies(comment.id)}
              currentUserId={currentUserId}
              onReply={() => setReplyTo(comment)}
              onDelete={handleDelete}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 답글 대상 표시 */}
      {replyTo && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: '#eff6ff', borderTop: '1px solid #bfdbfe',
          fontSize: 12, color: '#1d4ed8',
        }}>
          <span>↩ <strong>{replyTo.author.name}</strong>님의 댓글에 답글 작성 중</span>
          <button onClick={() => setReplyTo(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{ padding: '12px 0 0', borderTop: '1px solid #f3f4f6', position: 'relative' }}>

        {/* @멘션 드롭다운 */}
        {showMention && filteredMembers.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            backgroundColor: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 50, marginBottom: 4, overflow: 'hidden',
          }}>
            {filteredMembers.map(member => (
              <button
                key={member.id}
                onClick={() => insertMention(member.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              >
                <Avatar member={member} size={24} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{member.name}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{member.department}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Avatar member={TEAM_MEMBERS.find(m => m.id === currentUserId) ?? TEAM_MEMBERS[0]} size={30} />
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
                if (e.key === 'Escape') setShowMention(false);
              }}
              placeholder="댓글을 입력하세요… @이름 으로 팀원을 언급할 수 있어요  (Cmd/Ctrl+Enter로 전송)"
              rows={2}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                border: '1px solid #d1d5db', borderRadius: 6,
                outline: 'none', resize: 'none', color: '#111827',
                lineHeight: 1.5, boxSizing: 'border-box',
                fontFamily: '-apple-system, sans-serif',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 500,
              color: '#fff',
              backgroundColor: !input.trim() || submitting ? '#93c5fd' : '#1d4ed8',
              border: 'none', borderRadius: 6,
              cursor: !input.trim() || submitting ? 'not-allowed' : 'pointer',
              flexShrink: 0, alignSelf: 'flex-end',
            }}
          >
            {submitting ? '…' : '전송'}
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, marginLeft: 38 }}>
          @ 입력으로 팀원 언급 · Cmd/Ctrl+Enter로 전송
        </p>
      </div>
    </div>
  );
}

// ── 댓글 아이템 ──────────────────────────────────────────────────
function CommentItem({
  comment, replies, currentUserId, onReply, onDelete,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId: string;
  onReply: () => void;
  onDelete: (id: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const parts = parseContentWithMentions(comment.content);
  const isOwn = comment.author.id === currentUserId;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{ display: 'flex', gap: 8, padding: '8px 0', borderRadius: 6 }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <Avatar member={comment.author} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{comment.author.name}</span>
            <span style={{ fontSize: 10, color: '#9ca3af', padding: '1px 6px', backgroundColor: '#f3f4f6', borderRadius: 10 }}>
              {comment.author.department}
            </span>
            {comment.clause_ref && (
              <span style={{ fontSize: 10, color: '#1d4ed8', padding: '1px 6px', backgroundColor: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                📎 {comment.clause_ref}
              </span>
            )}
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 2 }}>{relativeTime(comment.created_at)}</span>

            {/* 액션 버튼 */}
            {showActions && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <button onClick={onReply}
                  style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, backgroundColor: '#f3f4f6' }}>
                  답글
                </button>
                {isOwn && (
                  <button onClick={() => onDelete(comment.id)}
                    style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, backgroundColor: '#fef2f2' }}>
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 댓글 내용 (멘션 하이라이트) */}
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, wordBreak: 'break-word' }}>
            {parts.map((part, i) =>
              part.type === 'mention' ? (
                <span key={i} style={{ color: '#1d4ed8', fontWeight: 600, backgroundColor: '#eff6ff', padding: '0 2px', borderRadius: 3 }}>
                  {part.value}
                </span>
              ) : (
                <span key={i}>{part.value}</span>
              )
            )}
          </p>
        </div>
      </div>

      {/* 답글 목록 */}
      {replies.length > 0 && (
        <div style={{ marginLeft: 38, borderLeft: '2px solid #f3f4f6', paddingLeft: 12 }}>
          {replies.map(reply => {
            const replyParts = parseContentWithMentions(reply.content);
            return (
              <div key={reply.id} style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
                <Avatar member={reply.author} size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{reply.author.name}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{relativeTime(reply.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                    {replyParts.map((part, i) =>
                      part.type === 'mention' ? (
                        <span key={i} style={{ color: '#1d4ed8', fontWeight: 600, backgroundColor: '#eff6ff', padding: '0 2px', borderRadius: 3 }}>
                          {part.value}
                        </span>
                      ) : (
                        <span key={i}>{part.value}</span>
                      )
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 아바타 ────────────────────────────────────────────────────────
function Avatar({ member, size }: { member: { name: string; initials: string; color: string }; size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: member.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      letterSpacing: '-0.03em',
    }}>
      {member.initials}
    </div>
  );
}
